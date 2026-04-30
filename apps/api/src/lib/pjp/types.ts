/**
 * PJP (Penyedia Jasa Pembayaran) abstraction.
 *
 * For the hackathon MVP we only ship a Mock implementation. Production
 * replacement (DOKU/Flip) just needs another class implementing the same
 * interface — wiring stays untouched in routes/qris.
 *
 * Lifecycle:
 *   1. Backend builds a quote → calls `provider.initiate({...})`
 *   2. Provider returns a `PJPInitResponse` with a `pjp_id` for tracking
 *   3. Provider eventually fires a webhook → `provider.parseWebhook()`
 *      validates the payload + extracts a normalized `PJPEvent`
 *   4. Backend can poll `provider.getStatus(pjp_id)` while waiting
 */

import type BigNumber from "bignumber.js";

export type PJPStatus =
  | "pending"
  | "settled"
  | "failed"
  | "expired"
  | "cancelled";

export interface PJPInitiateInput {
  /** Internal transaction id from our DB — partner sees this as `external_id`. */
  external_id: string;
  /** IDR amount, integer rupiah. */
  amount_idr: BigNumber;
  /** Raw QRIS string we scanned — partner re-validates. */
  qris_string: string;
  /** Merchant display name for partner-side audit. */
  merchant_name: string;
  /** Merchant NMID extracted from the QRIS payload, when present. */
  merchant_id: string | null;
  /** Optional remarks shown on partner dashboard. */
  remarks?: string;
}

export interface PJPInitiateResponse {
  /** Partner-side identifier — pakai untuk lookup status / dispute. */
  pjp_id: string;
  /** Initial status. Mock returns "pending" then settles asynchronously. */
  status: PJPStatus;
  /** ISO timestamp when this initiation expires (settlement window). */
  expires_at: string;
}

export interface PJPStatusResponse {
  pjp_id: string;
  external_id: string;
  status: PJPStatus;
  /** Settled timestamp, present only when status === "settled". */
  settled_at: string | null;
  /** Failure reason, present only when status ∈ ("failed", "expired", "cancelled"). */
  failure_reason: string | null;
}

/** Normalized webhook event the backend persists & uses to advance tx state. */
export interface PJPEvent {
  pjp_id: string;
  external_id: string;
  status: PJPStatus;
  /** Server timestamp when the event was emitted. */
  occurred_at: string;
  /** Raw payload — kept for forensics, NOT trusted directly. */
  raw: unknown;
}

export interface PJPProvider {
  /** Human-readable identifier — "mock", "doku", "flip" etc. */
  readonly name: string;

  initiate(input: PJPInitiateInput): Promise<PJPInitiateResponse>;
  getStatus(pjp_id: string): Promise<PJPStatusResponse>;

  /**
   * Verify webhook signature + extract a normalized PJPEvent.
   * Returns null if the signature is invalid (so backend can 401).
   */
  parseWebhook(headers: Record<string, string>, body: string): PJPEvent | null;
}
