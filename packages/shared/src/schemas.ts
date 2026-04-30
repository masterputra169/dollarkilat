import { z } from "zod";
import {
  MAX_PAYMENT_IDR,
  MIN_PAYMENT_IDR,
} from "./constants";

// ── User sync ──────────────────────────────────────────────────
// Frontend POST /users/sync request body. Backend pulls real email +
// solana_address from Privy via verifyAuthToken(token) → getUser(userId).
// Body kept minimal so we never trust client-provided identity.
export const UserSyncRequestSchema = z.object({}).strict();
export type UserSyncRequest = z.infer<typeof UserSyncRequestSchema>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  privy_id: z.string().min(1),
  email: z.string().email().nullable(),
  solana_address: z.string().min(32).nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type User = z.infer<typeof UserSchema>;

export const UserSyncResponseSchema = z.object({
  user: UserSchema,
  is_new: z.boolean(),
});
export type UserSyncResponse = z.infer<typeof UserSyncResponseSchema>;

// ── QRIS quote ─────────────────────────────────────────────────
// `amount_idr` optional — required when QRIS is static (no embedded amount).
// Server validates: dynamic QR ignores client amount, static QR requires it.
export const QuoteRequestSchema = z.object({
  qris_string: z.string().min(20).max(500),
  amount_idr: z
    .number()
    .int()
    .min(MIN_PAYMENT_IDR)
    .max(MAX_PAYMENT_IDR)
    .optional(),
});
export type QuoteRequest = z.infer<typeof QuoteRequestSchema>;

export const QuoteResponseSchema = z.object({
  quote_id: z.string().uuid(),
  amount_idr: z.number().int().min(MIN_PAYMENT_IDR).max(MAX_PAYMENT_IDR),
  amount_usdc: z.string(), // BigNumber-as-string to avoid float
  amount_usdc_lamports: z.string(), // bigint serialized
  exchange_rate: z.string(), // BigNumber-as-string
  merchant_name: z.string(),
  expires_at: z.string().datetime(),
});
export type QuoteResponse = z.infer<typeof QuoteResponseSchema>;

// ── QRIS pay ───────────────────────────────────────────────────
export const PayRequestSchema = z.object({
  quote_id: z.string().uuid(),
  qris_string: z.string().min(20).max(500),
  mode: z.enum(["delegated", "biometric"]),
  signed_tx: z.string().optional(), // base64; required when mode=biometric
});
export type PayRequest = z.infer<typeof PayRequestSchema>;

export const PayResponseSchema = z.object({
  transaction_id: z.string().uuid(),
  status: z.enum([
    "solana_pending",
    "solana_confirmed",
    "pjp_pending",
    "completed",
    "failed_settlement",
  ]),
  signature: z.string(),
  /** True until Day 7 wires real Solana fee-payer signing. UI uses this to
   * surface a "Demo mode" pill so users aren't misled. */
  is_mock: z.boolean().optional(),
});
export type PayResponse = z.infer<typeof PayResponseSchema>;

// ── Delegated actions consent ──────────────────────────────────
export const ConsentCreateSchema = z.object({
  enabled: z.boolean(),
  max_per_tx_idr: z
    .number()
    .int()
    .min(MIN_PAYMENT_IDR)
    .max(MAX_PAYMENT_IDR)
    .optional(),
  max_per_day_idr: z.number().int().positive().optional(),
});
export type ConsentCreate = z.infer<typeof ConsentCreateSchema>;

export const ConsentSchema = z.object({
  id: z.string().uuid(),
  enabled: z.boolean(),
  max_per_tx_idr: z.number().int().nullable(),
  max_per_day_idr: z.number().int().nullable(),
  consented_at: z.string().datetime(),
  expires_at: z.string().datetime(),
  revoked_at: z.string().datetime().nullable(),
});
export type Consent = z.infer<typeof ConsentSchema>;

export const ConsentResponseSchema = z.object({
  consent: ConsentSchema.nullable(),
  wallet_delegated: z.boolean(),
});
export type ConsentResponse = z.infer<typeof ConsentResponseSchema>;

// ── Balance ────────────────────────────────────────────────────
export const BalanceResponseSchema = z.object({
  address: z.string(),
  lamports: z.string(),
  ui_amount: z.string(),
});
export type BalanceResponse = z.infer<typeof BalanceResponseSchema>;

// ── Rate (USDC → IDR) ──────────────────────────────────────────
export const RateResponseSchema = z.object({
  rate: z.string(), // numeric-as-string to avoid float
  cached_at: z.string().datetime(),
});
export type RateResponse = z.infer<typeof RateResponseSchema>;
