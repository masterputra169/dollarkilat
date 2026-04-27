/**
 * Cross-app TS types. Keep these aligned with Postgres tables in docs/04-architecture.md.
 */

export type TransactionStatus =
  | "created"
  | "rejected"
  | "user_signing"
  | "solana_pending"
  | "solana_confirmed"
  | "pjp_pending"
  | "completed"
  | "failed_settlement";

export type TransactionType = "deposit" | "qris_payment";

export type PaymentMode = "delegated" | "biometric";

export interface ApiError {
  error: string;
  message?: string;
  details?: unknown;
}

export interface ApiSuccess<T> {
  data: T;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
