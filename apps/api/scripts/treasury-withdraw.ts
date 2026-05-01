/**
 * Withdraw USDC from the treasury ATA to an arbitrary destination owner.
 *
 * Usage:
 *   npm run treasury:withdraw -- --to <RECIPIENT_OWNER_ADDRESS> --amount <USDC>
 *
 * Where:
 *   --to     = Solana wallet address of the recipient (NOT their ATA — we
 *              derive the destination ATA from this owner + USDC mint, and
 *              create it idempotently if missing).
 *   --amount = USDC amount as a decimal string ("10", "10.5", "0.001").
 *
 * Auth: signed by FEE_PAYER_PRIVATE_KEY (which is also the treasury owner
 * in our hackathon setup). Production splits these into separate keys.
 *
 * What this DOESN'T do:
 *   - No multi-sig prompt (single-key signing)
 *   - No daily limit enforcement (add for prod)
 *   - No reason / memo logged onchain (could add memo program later)
 */

import { parseArgs } from "node:util";
import {
  address as toAddress,
  appendTransactionMessageInstruction,
  createTransactionMessage,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Address,
  type KeyPairSigner,
} from "@solana/kit";
import {
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstructionAsync,
  getTransferCheckedInstruction,
} from "@solana-program/token";
import {
  getBase64EncodedWireTransaction,
  assertIsTransactionWithinSizeLimit,
} from "@solana/transactions";
import {
  getFeePayer,
  getRpc,
} from "../src/lib/fee-payer.js";
import { env } from "../src/env.js";
import { USDC_DECIMALS } from "@dollarkilat/shared";

// ── arg parsing ──────────────────────────────────────────────

const args = parseArgs({
  options: {
    to: { type: "string" },
    amount: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
  allowPositionals: false,
});

const recipient = args.values.to;
const amountStr = args.values.amount;
const dryRun = args.values["dry-run"] ?? false;

if (!recipient) die("Missing --to <RECIPIENT_OWNER_ADDRESS>");
if (!amountStr) die("Missing --amount <USDC>");

if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(recipient)) {
  die(`--to "${recipient}" tidak terlihat seperti alamat Solana valid.`);
}
if (!/^\d+(\.\d+)?$/.test(amountStr)) {
  die(`--amount "${amountStr}" harus angka desimal positif (mis. "10" atau "10.5").`);
}

// Convert "10.5" → 10500000n lamports (USDC has 6 decimals).
const amountLamports = decimalToLamports(amountStr, USDC_DECIMALS);
if (amountLamports <= 0n) die("--amount harus > 0");

// ── main ─────────────────────────────────────────────────────

await main();

async function main() {
  const rpc = getRpc();
  const feePayer = await getFeePayer();
  const usdcMint = toAddress(env.USDC_MINT);
  const treasuryAta = toAddress(env.TREASURY_USDC_ATA);

  console.log("\n──────── Treasury Withdraw ────────");
  console.log(`Network:        ${env.SOLANA_NETWORK}`);
  console.log(`Treasury ATA:   ${treasuryAta}`);
  console.log(`Owner / signer: ${feePayer.address}`);
  console.log(`Recipient:      ${recipient}`);
  console.log(`Amount:         ${amountStr} USDC (${amountLamports} lamports)`);
  console.log("───────────────────────────────────\n");

  // 1. Pre-flight: treasury balance check
  const balance = await rpc.getTokenAccountBalance(treasuryAta).send();
  const treasuryLamports = BigInt(balance.value.amount);
  if (treasuryLamports < amountLamports) {
    die(
      `Saldo treasury tidak cukup. Punya ${balance.value.uiAmountString} USDC, butuh ${amountStr} USDC.`,
    );
  }
  console.log(`✓ Treasury saldo OK (${balance.value.uiAmountString} USDC available)`);

  // 2. Derive recipient ATA + ensure it exists (idempotent)
  const [recipientAta] = await findAssociatedTokenPda({
    owner: toAddress(recipient!),
    mint: usdcMint,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  console.log(`✓ Recipient ATA: ${recipientAta}`);

  const ataInfo = await rpc
    .getAccountInfo(recipientAta, { encoding: "base64" })
    .send();
  const ataExists = ataInfo.value !== null;
  console.log(`  ${ataExists ? "exists" : "missing — will create idempotent"}`);

  if (dryRun) {
    console.log("\n[dry-run] Stopping before tx submit. No funds moved.");
    return;
  }

  // 3. Build instructions
  const instructions = [];

  if (!ataExists) {
    const createAtaIx = await getCreateAssociatedTokenIdempotentInstructionAsync({
      payer: feePayer,
      owner: toAddress(recipient!),
      mint: usdcMint,
    });
    instructions.push(createAtaIx);
  }

  const transferIx = getTransferCheckedInstruction({
    source: treasuryAta,
    mint: usdcMint,
    destination: recipientAta,
    authority: feePayer, // treasury owner = fee_payer in hackathon setup
    amount: amountLamports,
    decimals: USDC_DECIMALS,
  });
  instructions.push(transferIx);

  // 4. Compose + sign tx
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(feePayer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
    (m) => addAll(m, instructions),
  );

  const signed = await signTransactionMessageWithSigners(message);
  assertIsTransactionWithinSizeLimit(signed);

  // 5. Submit + poll
  const wireBase64 = getBase64EncodedWireTransaction(signed);
  const signature = await rpc
    .sendTransaction(wireBase64, { encoding: "base64" })
    .send();

  console.log(`\n✓ Submitted: ${signature}`);
  console.log("  Polling for confirmation...");

  const start = Date.now();
  while (Date.now() - start < 30_000) {
    const res = await rpc.getSignatureStatuses([signature]).send();
    const status = res.value[0];
    if (status) {
      if (status.err) {
        die(`Tx failed onchain: ${JSON.stringify(status.err)}`);
      }
      const conf = status.confirmationStatus;
      if (conf === "confirmed" || conf === "finalized") {
        console.log(`✅ Confirmed (${conf}) after ${(Date.now() - start) / 1000}s`);
        const cluster = env.SOLANA_NETWORK === "devnet" ? "?cluster=devnet" : "";
        console.log(`\nExplorer: https://explorer.solana.com/tx/${signature}${cluster}\n`);
        return;
      }
    }
    await sleep(800);
  }
  die("Confirmation timeout setelah 30s");
}

// ── helpers ──────────────────────────────────────────────────

function addAll<T extends object>(m: T, ixs: readonly Parameters<typeof appendTransactionMessageInstruction>[0][]): T {
  let acc = m as unknown as Parameters<typeof appendTransactionMessageInstruction>[1];
  for (const ix of ixs) {
    acc = appendTransactionMessageInstruction(ix, acc) as typeof acc;
  }
  return acc as unknown as T;
}

function decimalToLamports(decimalStr: string, decimals: number): bigint {
  const [whole, frac = ""] = decimalStr.split(".") as [string, string?];
  const fracPadded = (frac ?? "").padEnd(decimals, "0").slice(0, decimals);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fracPadded || "0");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function die(msg: string): never {
  console.error(`❌ ${msg}\n`);
  console.error(
    "Usage: npm run treasury:withdraw -- --to <RECIPIENT> --amount <USDC> [--dry-run]\n",
  );
  process.exit(1);
}
