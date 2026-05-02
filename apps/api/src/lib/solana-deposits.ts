/**
 * On-chain deposit detection.
 *
 * Hackathon-grade polling: when the dashboard loads (or user refreshes),
 * frontend hits POST /transactions/scan-deposits → backend queries Helius
 * for recent USDC ATA signatures, parses incoming TransferChecked /
 * Transfer instructions, and idempotently inserts new ones into
 * `transactions` as type='deposit' with status='completed'.
 *
 * Idempotency = `signature` column UNIQUE constraint. Re-runs cheap.
 *
 * Production (post-hackathon): swap polling for a Helius webhook
 * subscribed per user's USDC ATA. Same DB shape — frontend unchanged.
 */

import { address } from "@solana/kit";
import {
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
} from "@solana-program/token";
import { env } from "../env.js";

const TOKEN_PROGRAM_ID_STR = TOKEN_PROGRAM_ADDRESS as unknown as string;

interface RpcSignatureEntry {
  signature: string;
  slot: number;
  blockTime: number | null;
  err: unknown;
}

interface RpcTransactionResult {
  blockTime: number | null;
  transaction: {
    message: {
      instructions: Array<{
        programId?: string;
        parsed?: {
          type?: string;
          info?: Record<string, unknown>;
        };
      }>;
    };
  };
}

export interface ParsedDeposit {
  signature: string;
  amount_lamports: bigint;
  source_authority: string;
  block_time: number | null;
}

async function heliusRpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(env.HELIUS_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) {
    throw new Error(`helius_${method}_http_${res.status}`);
  }
  const json = (await res.json()) as { result?: T; error?: { message: string } };
  if (json.error) {
    throw new Error(`helius_${method}_error: ${json.error.message}`);
  }
  return json.result as T;
}

/** Derive the user's USDC ATA address. */
export async function deriveUsdcAta(userWallet: string): Promise<string> {
  const [ata] = await findAssociatedTokenPda({
    owner: address(userWallet),
    mint: address(env.USDC_MINT),
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  return ata.toString();
}

/**
 * Fetch & parse recent INCOMING USDC transfers to the user's ATA.
 * Outgoing transfers (where the user is the authority/source) are skipped —
 * those are already recorded as qris_payment rows.
 *
 * `limit` is the number of recent signatures to inspect, NOT deposits to
 * return — most signatures will be skipped (errors, outgoing, non-token).
 */
export async function fetchRecentDeposits(
  userWallet: string,
  limit = 15,
): Promise<ParsedDeposit[]> {
  const usdcAta = await deriveUsdcAta(userWallet);

  // 1. Get recent signatures touching the user's ATA.
  const sigs = await heliusRpc<RpcSignatureEntry[]>("getSignaturesForAddress", [
    usdcAta,
    { limit },
  ]);
  if (!sigs || sigs.length === 0) return [];

  const deposits: ParsedDeposit[] = [];

  // 2. For each signature, fetch parsed tx and look for incoming Token transfer
  //    where destination = our ATA AND authority != user wallet.
  //    Sequential to avoid Helius RPC rate limits; small N (≤15) keeps it fast.
  for (const entry of sigs) {
    if (entry.err) continue;

    let tx: RpcTransactionResult | null;
    try {
      tx = await heliusRpc<RpcTransactionResult | null>("getTransaction", [
        entry.signature,
        { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
      ]);
    } catch (err) {
      console.warn(
        `[deposits] getTransaction(${entry.signature.slice(0, 8)}…) failed:`,
        (err as Error).message,
      );
      continue;
    }
    if (!tx) continue;

    const parsed = parseIncomingTokenTransfer(tx, usdcAta, userWallet);
    if (!parsed) continue;

    deposits.push({
      signature: entry.signature,
      amount_lamports: parsed.amount,
      source_authority: parsed.authority,
      block_time: tx.blockTime ?? entry.blockTime,
    });
  }

  return deposits;
}

interface ParsedIncoming {
  amount: bigint;
  authority: string;
}

function parseIncomingTokenTransfer(
  tx: RpcTransactionResult,
  ourAta: string,
  ourWallet: string,
): ParsedIncoming | null {
  const ixs = tx.transaction.message.instructions ?? [];
  for (const ix of ixs) {
    if (ix.programId !== TOKEN_PROGRAM_ID_STR) continue;
    if (!ix.parsed) continue;

    const t = ix.parsed.type;
    const info = ix.parsed.info ?? {};
    if (t !== "transfer" && t !== "transferChecked") continue;

    if (info.destination !== ourAta) continue;
    if (info.source === ourAta) continue;
    if (info.authority === ourWallet) continue;

    // amount: TransferChecked uses tokenAmount.amount; legacy Transfer uses `amount`.
    const tokenAmount = info.tokenAmount as { amount?: string } | undefined;
    const amountStr =
      typeof info.amount === "string"
        ? info.amount
        : (tokenAmount?.amount ?? null);
    if (!amountStr) continue;

    let amountBn: bigint;
    try {
      amountBn = BigInt(amountStr);
    } catch {
      continue;
    }
    if (amountBn <= 0n) continue;

    const authority =
      typeof info.authority === "string" ? info.authority : "";

    return { amount: amountBn, authority };
  }
  return null;
}
