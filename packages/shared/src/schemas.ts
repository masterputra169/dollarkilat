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
  /** Optional @handle for receiving payments without sharing the wallet
   * address. Lowercase a-z + 0-9 + underscore, 3-20 chars. NULL until claimed.
   * Globally unique. */
  handle: z.string().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type User = z.infer<typeof UserSchema>;

export const UserSyncResponseSchema = z.object({
  user: UserSchema,
  is_new: z.boolean(),
});
export type UserSyncResponse = z.infer<typeof UserSyncResponseSchema>;

// ── Handle (username) ─────────────────────────────────────────
// PATCH /users/handle — claim or update. NULL/empty = release the handle.
export const HandleClaimRequestSchema = z.object({
  handle: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9_]{3,20}$/,
      "Handle harus 3-20 karakter, hanya huruf kecil, angka, atau underscore",
    )
    .nullable(),
});
export type HandleClaimRequest = z.infer<typeof HandleClaimRequestSchema>;

export const HandleResolveResponseSchema = z.object({
  handle: z.string(),
  solana_address: z.string().nullable(),
  email: z.string().nullable(),
});
export type HandleResolveResponse = z.infer<typeof HandleResolveResponseSchema>;

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
  /**
   * Base64-encoded UNSIGNED transaction message (legacy or v0). Frontend
   * passes this directly to Privy's useSignTransaction → returns signed
   * bytes → POST to /qris/pay. Bytes are committed at quote time so the
   * blockhash, fee_payer, and amount can't be changed by the client.
   */
  unsigned_tx_base64: z.string(),
});
export type QuoteResponse = z.infer<typeof QuoteResponseSchema>;

// ── QRIS pay ───────────────────────────────────────────────────
// Biometric mode was removed: every payment is a One-Tap delegated sign via
// the user's session signer. Frontend still produces signed_tx (Privy SDK
// routes the signing through the session signer transparently — the user
// sees no prompt). `mode` kept as a single-member literal for explicit
// contract + forward compat if alternate modes return.
export const PayRequestSchema = z.object({
  quote_id: z.string().uuid(),
  qris_string: z.string().min(20).max(500),
  mode: z.literal("delegated"),
  signed_tx: z.string(), // base64-encoded, signed by Privy session signer
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

// ── Merchants ──────────────────────────────────────────────────
export const MerchantSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  nmid: z.string(),
  city: z.string().nullable(),
  /** Verified against BI QRIS registry / partner KYC. False = demo / unverified. */
  is_verified: z.boolean(),
  /** Bank routing for real PJP disbursement (optional; required when PJP_PARTNER=flip). */
  bank_code: z.string().nullable(),
  account_number: z.string().nullable(),
  account_holder: z.string().nullable(),
  created_at: z.string().datetime(),
});
export type Merchant = z.infer<typeof MerchantSchema>;

export const MerchantClaimRequestSchema = z.object({
  name: z.string().trim().min(2).max(80),
  nmid: z
    .string()
    .trim()
    .min(8)
    .max(40)
    // QRIS NMIDs are alphanumeric (some include "ID" prefix or numeric only).
    .regex(/^[A-Z0-9]+$/i, "NMID hanya huruf/angka"),
  city: z.string().trim().min(1).max(80).optional(),
  // Optional bank info — required only when settling via Flip.
  bank_code: z
    .string()
    .trim()
    .min(2)
    .max(20)
    .regex(/^[a-z_]+$/, "bank_code huruf kecil + underscore aja")
    .optional(),
  account_number: z.string().trim().min(4).max(40).optional(),
  account_holder: z.string().trim().min(2).max(80).optional(),
});
export type MerchantClaimRequest = z.infer<typeof MerchantClaimRequestSchema>;

/**
 * Edit existing merchant. All fields optional — only provided keys are
 * patched. Bank fields use a sentinel `null` to clear (vs `undefined` =
 * leave untouched).
 */
export const MerchantUpdateRequestSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    nmid: z
      .string()
      .trim()
      .min(8)
      .max(40)
      .regex(/^[A-Z0-9]+$/i, "NMID hanya huruf/angka")
      .optional(),
    city: z.string().trim().max(80).nullable().optional(),
    bank_code: z
      .string()
      .trim()
      .min(2)
      .max(20)
      .regex(/^[a-z_]+$/, "bank_code huruf kecil + underscore aja")
      .nullable()
      .optional(),
    account_number: z.string().trim().min(4).max(40).nullable().optional(),
    account_holder: z.string().trim().min(2).max(80).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "kosong — kasih minimal 1 field",
  });
export type MerchantUpdateRequest = z.infer<typeof MerchantUpdateRequestSchema>;

export const MerchantTransactionSchema = z.object({
  id: z.string().uuid(),
  amount_idr: z.number().int(),
  amount_usdc_lamports: z.string(),
  status: z.enum([
    "created",
    "user_signing",
    "solana_pending",
    "solana_confirmed",
    "pjp_pending",
    "completed",
    "failed_settlement",
    "rejected",
  ]),
  signature: z.string().nullable(),
  created_at: z.string().datetime(),
  pjp_settled_at: z.string().datetime().nullable(),
});
export type MerchantTransaction = z.infer<typeof MerchantTransactionSchema>;

export const MerchantDashboardResponseSchema = z.object({
  merchant: MerchantSchema.nullable(),
  // Aggregates
  total_today_idr: z.number().int(),
  total_month_idr: z.number().int(),
  count_today: z.number().int(),
  // Last 50 incoming
  recent: z.array(MerchantTransactionSchema),
});
export type MerchantDashboardResponse = z.infer<
  typeof MerchantDashboardResponseSchema
>;

// ── User transaction history ──────────────────────────────────────
// User-side outgoing payment view. Different from MerchantTransaction
// (merchant-side income view) because the user cares about: which merchant
// they paid, how much in USDC + IDR, what the rate was, fee paid, signature.

export const TransactionStatusEnum = z.enum([
  "created",
  "user_signing",
  "solana_pending",
  "solana_confirmed",
  "pjp_pending",
  "completed",
  "failed_settlement",
  "rejected",
]);

// Deposit rows (type='deposit') leave the payment-only fields nullable —
// no merchant, no quote, no app fee, no exchange rate snapshot.
export const UserTransactionSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["qris_payment", "deposit"]),
  status: TransactionStatusEnum,
  amount_idr: z.number().int().nullable(),
  amount_usdc_lamports: z.string(),
  app_fee_idr: z.number().int().nullable(),
  exchange_rate: z.string().nullable(),
  merchant_name: z.string().nullable(),
  merchant_id: z.string().nullable(),
  acquirer: z.string().nullable(),
  signature: z.string().nullable(),
  pjp_partner: z.string(),
  pjp_id: z.string().nullable(),
  pjp_settled_at: z.string().datetime().nullable(),
  failure_reason: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type UserTransaction = z.infer<typeof UserTransactionSchema>;

export const TransactionListResponseSchema = z.object({
  transactions: z.array(UserTransactionSchema),
  // Cursor pagination — `next_cursor` = ISO created_at of the last row,
  // null when no more pages. Client passes ?before=<cursor> to fetch next.
  next_cursor: z.string().datetime().nullable(),
});
export type TransactionListResponse = z.infer<
  typeof TransactionListResponseSchema
>;

export const TransactionDetailResponseSchema = z.object({
  transaction: UserTransactionSchema,
});
export type TransactionDetailResponse = z.infer<
  typeof TransactionDetailResponseSchema
>;
