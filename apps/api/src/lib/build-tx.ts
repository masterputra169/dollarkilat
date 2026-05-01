/**
 * USDC TransferChecked transaction builder.
 *
 * Backend builds the FULL transaction message at quote time so neither the
 * blockhash, fee_payer, mint, destination, nor amount can be tampered with
 * after that point. Client receives the wire bytes, asks Privy to add the
 * user's signature, and returns the signed bytes — backend then adds the
 * fee-payer signature and submits.
 */

import {
  address,
  appendTransactionMessageInstruction,
  createNoopSigner,
  createTransactionMessage,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  type Address,
} from "@solana/kit";
import {
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  getTransferCheckedInstruction,
} from "@solana-program/token";
import { compileTransaction } from "@solana/transactions";
import { getTransactionEncoder } from "@solana/transactions";
import { env } from "../env.js";
import { USDC_DECIMALS } from "@dollarkilat/shared";
import { getFeePayer, getRpc } from "./fee-payer.js";

export interface BuildPaymentTxInput {
  /** User wallet address (authority on the transfer). */
  userOwner: Address;
  /** USDC lamports to transfer (already includes app fee). */
  amountLamports: bigint;
}

export interface BuiltPaymentTx {
  /** Base64 UNSIGNED transaction. Pass to Privy `useSignTransaction`. */
  unsignedTxBase64: string;
  /** User's USDC ATA (derived). Stored with the quote for downstream verify. */
  userUsdcAta: Address;
  /** Blockhash committed to the tx — frontend can show "valid until" hint. */
  blockhash: string;
  /** Fee payer pubkey that will co-sign — recorded with the transaction row. */
  feePayerAddress: Address;
}

export async function buildUSDCPaymentTx(
  input: BuildPaymentTxInput,
): Promise<BuiltPaymentTx> {
  const rpc = getRpc();
  const feePayer = await getFeePayer();
  const mint = address(env.USDC_MINT);
  const treasuryAta = address(env.TREASURY_USDC_ATA);

  // 1. Derive user's USDC ATA — this is the source account.
  const [userAta] = await findAssociatedTokenPda({
    owner: input.userOwner,
    mint,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });

  // 2. Build TransferChecked instruction. The user is the authority but
  //    isn't online to sign right now — use a NoopSigner placeholder so
  //    the message lays out correctly. Privy will replace the sig later.
  const userSigner = createNoopSigner(input.userOwner);
  const ix = getTransferCheckedInstruction({
    source: userAta,
    mint,
    destination: treasuryAta,
    authority: userSigner,
    amount: input.amountLamports,
    decimals: USDC_DECIMALS,
  });

  // 3. Recent blockhash for lifetime constraint.
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

  // 4. Compose the transaction message: v0, fee_payer = our wallet, lifetime
  //    = recent blockhash, single TransferChecked instruction.
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayer(feePayer.address, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
    (m) => appendTransactionMessageInstruction(ix, m),
  );

  // 5. Compile + serialize. compileTransaction produces a Transaction object
  //    with empty signatures slots; getTransactionEncoder writes the standard
  //    Solana wire format (compatible with web3.js + Privy).
  const transaction = compileTransaction(message);
  const wireBytes = getTransactionEncoder().encode(transaction) as Uint8Array;
  const unsignedTxBase64 = Buffer.from(wireBytes).toString("base64");

  return {
    unsignedTxBase64,
    userUsdcAta: userAta,
    blockhash: latestBlockhash.blockhash,
    feePayerAddress: feePayer.address,
  };
}
