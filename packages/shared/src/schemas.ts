import { z } from "zod";
import {
  MAX_PAYMENT_IDR,
  MIN_PAYMENT_IDR,
} from "./constants.js";

// ── QRIS quote ─────────────────────────────────────────────────
export const QuoteRequestSchema = z.object({
  qris_string: z.string().min(20).max(500),
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

// ── Balance ────────────────────────────────────────────────────
export const BalanceResponseSchema = z.object({
  address: z.string(),
  lamports: z.string(),
  ui_amount: z.string(),
});
export type BalanceResponse = z.infer<typeof BalanceResponseSchema>;
