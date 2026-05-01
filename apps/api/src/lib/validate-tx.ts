/**
 * Transaction whitelist — the last defense line before the fee payer signs.
 *
 * Even if a Privy session signer is compromised, an attacker submitting a
 * malicious tx through `/qris/pay` cannot drain treasury or mint USDC: this
 * module decodes the wire-format transaction and rejects anything that
 * isn't EXACTLY a USDC TransferChecked from the user to our treasury, with
 * the exact lamports the quote says.
 *
 * Approach:
 *  1. Decode the wire bytes → CompiledTransactionMessage
 *  2. Resolve all account addresses (static keys + LUTs ignored — we only
 *     accept legacy / v0 messages without LUTs)
 *  3. Walk the instruction list — must be exactly 1 instruction
 *  4. Instruction must point at TOKEN_PROGRAM_ADDRESS
 *  5. Decode instruction data — must be TransferChecked discriminator
 *  6. Assert: source = user's USDC ATA, mint = USDC_MINT, destination =
 *     TREASURY_USDC_ATA, authority = user wallet, amount = expected lamports
 *  7. (Optional) Compute budget instructions allowed — empty wallets need
 *     them, but they're observation-only. We allow them as additional ix.
 */

import { getBase64Encoder, type Address, address } from "@solana/kit";
import { getCompiledTransactionMessageDecoder } from "@solana/transaction-messages";
import { getTransactionDecoder } from "@solana/transactions";
import {
  TOKEN_PROGRAM_ADDRESS,
  getTransferCheckedInstructionDataDecoder,
  TRANSFER_CHECKED_DISCRIMINATOR,
} from "@solana-program/token";
import { findAssociatedTokenPda } from "@solana-program/token";
import { env } from "../env.js";

/** Compute budget program address (allowed pass-through). */
const COMPUTE_BUDGET_PROGRAM_ADDRESS =
  "ComputeBudget111111111111111111111111111111" as Address;

export interface ValidateInput {
  /** Base64-encoded wire-format Solana transaction (signed or partially signed). */
  signedTxBase64: string;
  /** User's Solana wallet address — the authority on the transfer. */
  userOwner: Address;
  /** Expected USDC lamports (must match exactly). */
  expectedLamports: bigint;
}

export class TxValidationError extends Error {
  constructor(
    public readonly code:
      | "decode_failed"
      | "wrong_instruction_count"
      | "wrong_program"
      | "wrong_discriminator"
      | "wrong_mint"
      | "wrong_destination"
      | "wrong_source"
      | "wrong_authority"
      | "wrong_amount"
      | "fee_payer_mismatch",
    message: string,
  ) {
    super(message);
    this.name = "TxValidationError";
  }
}

/**
 * Decode + assert. Throws TxValidationError on any rejection.
 * Returns the parsed components on success (caller can record).
 */
export async function validateUSDCTransferTx(
  input: ValidateInput,
): Promise<{
  source: Address;
  destination: Address;
  mint: Address;
  authority: Address;
  amount: bigint;
}> {
  // 1. Decode wire bytes
  let bytes: Uint8Array;
  try {
    bytes = getBase64Encoder().encode(input.signedTxBase64) as Uint8Array;
  } catch {
    throw new TxValidationError("decode_failed", "tx not valid base64");
  }

  let tx;
  try {
    tx = getTransactionDecoder().decode(bytes);
  } catch (err) {
    throw new TxValidationError(
      "decode_failed",
      `tx decode failed: ${(err as Error).message}`,
    );
  }

  // The Transaction shape is `{ messageBytes, signatures }` — re-decode
  // the message to walk instructions.
  const msg = getCompiledTransactionMessageDecoder().decode(tx.messageBytes);

  // Only legacy / v0 messages have a flat `instructions[]`. v1 (configurable
  // message format) splits into headers + payloads which we don't support
  // yet. Reject so we don't silently mis-validate.
  if (msg.version !== "legacy" && msg.version !== 0) {
    throw new TxValidationError(
      "decode_failed",
      `unsupported message version: ${msg.version}`,
    );
  }

  const accountKeys = msg.staticAccounts as readonly Address[];

  // 2. Walk instructions. We allow ComputeBudget pass-through; require
  //    exactly one TransferChecked.
  const ix = msg.instructions;
  let transferIxIndex: number | null = null;
  for (let i = 0; i < ix.length; i++) {
    const programId = accountKeys[ix[i]!.programAddressIndex];
    if (!programId) {
      throw new TxValidationError(
        "wrong_program",
        `instruction ${i} has invalid programAddressIndex`,
      );
    }
    if (programId === COMPUTE_BUDGET_PROGRAM_ADDRESS) continue;
    if (programId !== TOKEN_PROGRAM_ADDRESS) {
      throw new TxValidationError(
        "wrong_program",
        `instruction ${i} program ${programId} not in whitelist`,
      );
    }
    if (transferIxIndex !== null) {
      throw new TxValidationError(
        "wrong_instruction_count",
        "more than one token-program instruction present",
      );
    }
    transferIxIndex = i;
  }
  if (transferIxIndex === null) {
    throw new TxValidationError(
      "wrong_instruction_count",
      "no token-program instruction found",
    );
  }

  const transferIx = ix[transferIxIndex]!;
  const data = transferIx.data;
  if (!data || data.length === 0) {
    throw new TxValidationError(
      "wrong_discriminator",
      "transfer instruction has empty data",
    );
  }
  if (data[0] !== TRANSFER_CHECKED_DISCRIMINATOR) {
    throw new TxValidationError(
      "wrong_discriminator",
      `expected TransferChecked discriminator (${TRANSFER_CHECKED_DISCRIMINATOR}), got ${data[0]}`,
    );
  }

  // 3. Decode TransferChecked args (amount + decimals)
  const decoded = getTransferCheckedInstructionDataDecoder().decode(data);

  // TransferChecked accounts (per SPL token spec):
  //   [0] source       (writable)
  //   [1] mint
  //   [2] destination  (writable)
  //   [3] authority    (signer)
  const accIdx = transferIx.accountIndices ?? [];
  if (accIdx.length < 4) {
    throw new TxValidationError(
      "wrong_instruction_count",
      `TransferChecked needs 4+ accounts, got ${accIdx.length}`,
    );
  }
  const source = accountKeys[accIdx[0]!];
  const mint = accountKeys[accIdx[1]!];
  const destination = accountKeys[accIdx[2]!];
  const authority = accountKeys[accIdx[3]!];

  if (!source || !mint || !destination || !authority) {
    throw new TxValidationError(
      "decode_failed",
      "could not resolve TransferChecked account addresses",
    );
  }

  // 4. Hard asserts.
  const expectedMint = address(env.USDC_MINT);
  const expectedDestination = address(env.TREASURY_USDC_ATA);

  if (mint !== expectedMint) {
    throw new TxValidationError(
      "wrong_mint",
      `mint ${mint} != USDC mint ${expectedMint}`,
    );
  }
  if (destination !== expectedDestination) {
    throw new TxValidationError(
      "wrong_destination",
      `destination ${destination} != treasury ATA ${expectedDestination}`,
    );
  }
  if (authority !== input.userOwner) {
    throw new TxValidationError(
      "wrong_authority",
      `authority ${authority} != user owner ${input.userOwner}`,
    );
  }

  // Source MUST be the user's USDC ATA — derive deterministically + compare.
  const [expectedSource] = await findAssociatedTokenPda({
    owner: input.userOwner,
    mint: expectedMint,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  if (source !== expectedSource) {
    throw new TxValidationError(
      "wrong_source",
      `source ${source} != user's expected USDC ATA ${expectedSource}`,
    );
  }

  if (decoded.amount !== input.expectedLamports) {
    throw new TxValidationError(
      "wrong_amount",
      `amount ${decoded.amount} != expected ${input.expectedLamports}`,
    );
  }

  return {
    source,
    destination,
    mint,
    authority,
    amount: decoded.amount,
  };
}
