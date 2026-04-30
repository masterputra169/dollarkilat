/**
 * Derive (and create on-chain if missing) the treasury USDC Associated Token
 * Account (ATA). The ATA is deterministic from {owner, mint, token-program},
 * so this script is idempotent — safe to re-run.
 *
 * Usage (from apps/api):
 *   npm run treasury:setup
 *
 * What it does:
 *   1. Compute the ATA address for FEE_PAYER's pubkey + USDC mint.
 *   2. Check if the account exists on-chain.
 *   3. If missing, sends a `createAssociatedTokenIdempotent` tx, signed/funded
 *      by the fee payer.
 *   4. Print the ATA address — paste into apps/api/.env.local as TREASURY_USDC_ATA.
 *
 * Why fee-payer = treasury owner: keeps moving parts to one keypair for
 * hackathon. In prod we split (treasury = multisig, fee-payer = ops).
 */

import {
  address,
  appendTransactionMessageInstruction,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  getSignatureFromTransaction,
} from "@solana/kit";
import {
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstructionAsync,
} from "@solana-program/token";
import bs58 from "bs58";

function envOrDie(name: string): string {
  const v = process.env[name];
  if (!v || v === "DEV_UNSET") {
    console.error(`❌ ${name} not set in apps/api/.env.local`);
    process.exit(1);
  }
  return v;
}

async function main() {
  const rpcUrl = envOrDie("HELIUS_RPC_URL");
  const usdcMint = envOrDie("USDC_MINT");
  const feePayerSecret = envOrDie("FEE_PAYER_PRIVATE_KEY");

  // Derive WS URL from RPC URL (Helius supports same path on wss://).
  const wsUrl = rpcUrl.replace(/^https?:/, (m) =>
    m === "https:" ? "wss:" : "ws:",
  );

  const rpc = createSolanaRpc(rpcUrl);
  const rpcSubscriptions = createSolanaRpcSubscriptions(wsUrl);

  // Fee payer = treasury owner.
  const secretBytes = bs58.decode(feePayerSecret);
  const signer = await createKeyPairSignerFromBytes(secretBytes);
  console.log(`Owner (fee payer): ${signer.address}`);
  console.log(`USDC mint:         ${usdcMint}`);

  // 1. Compute the deterministic ATA address.
  const [ata] = await findAssociatedTokenPda({
    owner: signer.address,
    mint: address(usdcMint),
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  console.log(`\nDerived ATA:       ${ata}`);

  // 2. Check whether it already exists.
  const accountInfo = await rpc.getAccountInfo(ata, { encoding: "base64" }).send();
  if (accountInfo.value) {
    console.log(`\n✅ ATA already exists on-chain — no tx needed.`);
    printEnvLine(ata);
    return;
  }

  console.log(`\nATA missing. Sending createAssociatedTokenIdempotent tx…`);

  // 3. Build + send creation tx (idempotent variant tolerates races).
  const ix = await getCreateAssociatedTokenIdempotentInstructionAsync({
    payer: signer,
    owner: signer.address,
    mint: address(usdcMint),
  });

  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(signer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
    (m) => appendTransactionMessageInstruction(ix, m),
  );

  const signedTx = await signTransactionMessageWithSigners(message);
  const sendAndConfirm = sendAndConfirmTransactionFactory({
    rpc,
    rpcSubscriptions,
  });
  await sendAndConfirm(signedTx, { commitment: "confirmed" });

  const sig = getSignatureFromTransaction(signedTx);
  console.log(`\n✅ ATA created.`);
  console.log(`   Signature: ${sig}`);
  printEnvLine(ata);
}

function printEnvLine(ata: string) {
  console.log(`\nUpdate apps/api/.env.local:`);
  console.log(`  TREASURY_USDC_ATA=${ata}`);
}

main().catch((err) => {
  console.error("❌ setup-treasury failed:", err);
  process.exit(1);
});
