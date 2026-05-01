import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { randomUUID } from "node:crypto";
import { address as toAddress } from "@solana/kit";
import {
  PayRequestSchema,
  QuoteRequestSchema,
  type QuoteResponse,
  type PayResponse,
  APP_FEE_BPS,
  MAX_PAYMENT_IDR,
  MIN_PAYMENT_IDR,
  QUOTE_TTL_SECONDS,
  USDC_DECIMALS,
} from "@dollarkilat/shared";
import { authMiddleware, type AuthVariables } from "../middleware/auth.js";
import { parseQRIS, QRISParseError } from "../lib/qris-parser.js";
import { getUSDCToIDRRate } from "../lib/oracle.js";
import { getUSDCBalance } from "../lib/solana.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { buildUSDCPaymentTx } from "../lib/build-tx.js";
import {
  validateUSDCTransferTx,
  TxValidationError,
} from "../lib/validate-tx.js";
import { submitPaymentTx } from "../lib/submit-tx.js";
import { checkRateLimit } from "../lib/rate-limit.js";
import { getPJP } from "../lib/pjp/index.js";

export const qris = new Hono<{ Variables: AuthVariables }>();

qris.use("*", authMiddleware);

// Rate limit ALL qris.* endpoints. Quote + pay both count toward the user's
// minute/day budget — abuse mitigation works equally on both.
qris.use("*", async (c, next) => {
  const privyUserId = c.get("privyUserId");
  const ip =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip") ??
    "unknown";
  const r = checkRateLimit({ privyUserId, ip });
  if (!r.ok) {
    return c.json(
      {
        error: "rate_limited",
        scope: r.scope,
        retry_after_ms: r.retryAfterMs,
      },
      429,
    );
  }
  await next();
});

// ── In-memory quote store ─────────────────────────────────────

interface StoredQuote {
  quote_id: string;
  privy_user_id: string;
  user_id: string; // internal UUID from public.users
  user_solana_address: string;
  qris_string: string;
  amount_idr: string;
  amount_usdc: string;
  amount_usdc_lamports: string;
  app_fee_idr: string;
  exchange_rate: string;
  merchant_name: string;
  merchant_id: string | null;
  acquirer: string | null;
  unsigned_tx_base64: string;
  fee_payer_address: string;
  created_at: number;
  expires_at: number;
}

const quoteStore = new Map<string, StoredQuote>();

function pruneExpired() {
  const now = Date.now();
  for (const [id, q] of quoteStore) {
    if (q.expires_at <= now) quoteStore.delete(id);
  }
}

// ── helpers ───────────────────────────────────────────────────

function quoteUsdc(
  amountIdr: bigint,
  ratePerUsdcStr: string,
): { amount_usdc_lamports: bigint; amount_usdc_ui: string; app_fee_idr: bigint } {
  const app_fee_idr = (amountIdr * BigInt(APP_FEE_BPS) + 5000n) / 10000n;
  const totalIdr = amountIdr + app_fee_idr;
  const SCALE = 1_000_000_000_000n;
  const rateScaled = parseRateToScaled(ratePerUsdcStr, 12n);
  if (rateScaled <= 0n) throw new Error("rate_invalid");
  const lamports = (totalIdr * 1_000_000n * SCALE) / rateScaled;
  return {
    amount_usdc_lamports: lamports,
    amount_usdc_ui: formatLamportsUi(lamports, USDC_DECIMALS),
    app_fee_idr,
  };
}

function parseRateToScaled(s: string, decimals: bigint): bigint {
  const trimmed = s.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) throw new Error("rate_invalid");
  const [whole, frac = ""] = trimmed.split(".") as [string, string?];
  const fracPadded = (frac ?? "")
    .padEnd(Number(decimals), "0")
    .slice(0, Number(decimals));
  return BigInt(whole) * 10n ** decimals + BigInt(fracPadded || "0");
}

function formatLamportsUi(lamports: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = lamports / divisor;
  const fraction = lamports % divisor;
  const frac = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  return frac.length === 0 ? whole.toString() : `${whole}.${frac}`;
}

// ── routes ────────────────────────────────────────────────────

/**
 * POST /qris/quote — generate USDC quote + UNSIGNED Solana tx for a QRIS payment.
 *
 * Trust boundary: server re-parses + verifies CRC, ignores client-supplied
 * amount when QR is dynamic. Server builds the tx (blockhash, fee_payer, mint,
 * destination, amount all server-controlled) so client cannot tamper.
 */
qris.post("/quote", zValidator("json", QuoteRequestSchema), async (c) => {
  pruneExpired();
  const privyUserId = c.get("privyUserId");
  const { qris_string, amount_idr: clientAmountIdr } = c.req.valid("json");

  // 1. Parse + verify QRIS
  let decoded;
  try {
    decoded = parseQRIS(qris_string);
  } catch (err) {
    const code = err instanceof QRISParseError ? err.code : "qris_parse_failed";
    const message = (err as Error).message;
    return c.json({ error: code, message }, 400);
  }

  // 2. Resolve amount (dynamic = embedded, static = client-supplied)
  let resolvedAmount: string;
  if (decoded.amount_idr !== null) {
    resolvedAmount = decoded.amount_idr;
  } else if (typeof clientAmountIdr === "number" && clientAmountIdr > 0) {
    resolvedAmount = String(clientAmountIdr);
  } else {
    return c.json(
      {
        error: "amount_required",
        message: "QR static — sertakan amount_idr di body.",
      },
      400,
    );
  }

  const amountIdrInt = BigInt(resolvedAmount);
  if (
    amountIdrInt < BigInt(MIN_PAYMENT_IDR) ||
    amountIdrInt > BigInt(MAX_PAYMENT_IDR)
  ) {
    return c.json(
      {
        error: "amount_out_of_range",
        message: `Jumlah harus antara Rp ${MIN_PAYMENT_IDR} – Rp ${MAX_PAYMENT_IDR}`,
      },
      400,
    );
  }

  // 3. Rate
  let rate;
  try {
    rate = await getUSDCToIDRRate();
  } catch (err) {
    console.error("[qris/quote] oracle failed:", err);
    return c.json({ error: "rate_unavailable" }, 502);
  }

  // 4. USDC math
  let usdc;
  try {
    usdc = quoteUsdc(amountIdrInt, rate.rate);
  } catch (err) {
    console.error("[qris/quote] usdc math failed:", err);
    return c.json({ error: "quote_math_failed" }, 500);
  }

  // 5. User lookup + balance
  const { data: userRow, error: userErr } = await supabaseAdmin
    .from("users")
    .select("id, solana_address")
    .eq("privy_id", privyUserId)
    .maybeSingle();
  if (userErr) {
    console.error("[qris/quote] user lookup failed:", userErr);
    return c.json({ error: "user_lookup_failed" }, 500);
  }
  const solanaAddress = userRow?.solana_address ?? null;
  const internalUserId = userRow?.id ?? null;
  if (!solanaAddress || !internalUserId) {
    return c.json({ error: "wallet_not_provisioned" }, 409);
  }

  try {
    const balance = await getUSDCBalance(solanaAddress);
    if (BigInt(balance.lamports) < usdc.amount_usdc_lamports) {
      return c.json(
        {
          error: "insufficient_balance",
          message: `Saldo USDC tidak cukup. Butuh ${formatLamportsUi(usdc.amount_usdc_lamports, USDC_DECIMALS)} USDC, saldo kamu ${balance.ui_amount} USDC.`,
        },
        402,
      );
    }
  } catch (err) {
    console.error("[qris/quote] balance check failed:", err);
    return c.json({ error: "balance_check_failed" }, 502);
  }

  // 6. Build the unsigned transaction (blockhash, fee_payer, instruction —
  //    all server-controlled).
  let built;
  try {
    built = await buildUSDCPaymentTx({
      userOwner: toAddress(solanaAddress),
      amountLamports: usdc.amount_usdc_lamports,
    });
  } catch (err) {
    console.error("[qris/quote] tx build failed:", err);
    return c.json(
      {
        error: "tx_build_failed",
        message: (err as Error).message,
      },
      500,
    );
  }

  // 7. Persist quote in-memory
  const now = Date.now();
  const stored: StoredQuote = {
    quote_id: randomUUID(),
    privy_user_id: privyUserId,
    user_id: internalUserId,
    user_solana_address: solanaAddress,
    qris_string,
    amount_idr: resolvedAmount,
    amount_usdc: usdc.amount_usdc_ui,
    amount_usdc_lamports: usdc.amount_usdc_lamports.toString(),
    app_fee_idr: usdc.app_fee_idr.toString(),
    exchange_rate: rate.rate,
    merchant_name: decoded.merchant_name,
    merchant_id: decoded.merchant_id,
    acquirer: decoded.acquirer,
    unsigned_tx_base64: built.unsignedTxBase64,
    fee_payer_address: built.feePayerAddress.toString(),
    created_at: now,
    expires_at: now + QUOTE_TTL_SECONDS * 1000,
  };
  quoteStore.set(stored.quote_id, stored);

  const body: QuoteResponse = {
    quote_id: stored.quote_id,
    amount_idr: Number(stored.amount_idr),
    amount_usdc: stored.amount_usdc,
    amount_usdc_lamports: stored.amount_usdc_lamports,
    exchange_rate: stored.exchange_rate,
    merchant_name: stored.merchant_name,
    expires_at: new Date(stored.expires_at).toISOString(),
    unsigned_tx_base64: stored.unsigned_tx_base64,
  };
  return c.json(body);
});

/**
 * POST /qris/pay — submit user-signed transaction.
 *
 * Flow:
 *   1. Look up quote, verify ownership + freshness
 *   2. Validate user-signed tx via whitelist (only one TransferChecked, exact
 *      mint/destination/amount/authority)
 *   3. Insert transaction row (status=created → solana_pending after submit)
 *   4. Co-sign with fee payer + submit + await confirmation
 *   5. Update tx row (signature, status=solana_confirmed)
 *   6. Notify PJP partner (mock) → status=pjp_pending
 *   7. Burn the quote (replay defense)
 */
qris.post("/pay", zValidator("json", PayRequestSchema), async (c) => {
  pruneExpired();
  const privyUserId = c.get("privyUserId");
  const input = c.req.valid("json");

  // Quote lookup
  const quote = quoteStore.get(input.quote_id);
  if (!quote) return c.json({ error: "quote_not_found" }, 404);
  if (quote.privy_user_id !== privyUserId) {
    return c.json({ error: "quote_not_owned" }, 403);
  }
  if (quote.expires_at <= Date.now()) {
    quoteStore.delete(input.quote_id);
    return c.json({ error: "quote_expired" }, 410);
  }

  // signed_tx is required for biometric mode (and for now also for delegated
  // mode — Day 7.5 wires server-side TEE signing via Privy walletApi).
  if (!input.signed_tx) {
    return c.json(
      {
        error: "signed_tx_required",
        message:
          "Frontend must sign the unsigned_tx_base64 (via Privy useSignTransaction) and POST signed_tx.",
      },
      400,
    );
  }

  // Validate the signed tx matches the quote (strict whitelist)
  try {
    await validateUSDCTransferTx({
      signedTxBase64: input.signed_tx,
      userOwner: toAddress(quote.user_solana_address),
      expectedLamports: BigInt(quote.amount_usdc_lamports),
    });
  } catch (err) {
    if (err instanceof TxValidationError) {
      return c.json(
        { error: "tx_validation_failed", code: err.code, message: err.message },
        400,
      );
    }
    console.error("[qris/pay] validation crashed:", err);
    return c.json({ error: "tx_validation_failed" }, 500);
  }

  // Insert tx row in status=created (auditable even if submit fails)
  const tx_id = randomUUID();
  const insertRes = await supabaseAdmin
    .from("transactions")
    .insert({
      id: tx_id,
      user_id: quote.user_id,
      quote_id: quote.quote_id,
      type: "qris_payment",
      status: "created",
      amount_idr: Number(quote.amount_idr),
      amount_usdc_lamports: Number(quote.amount_usdc_lamports),
      app_fee_idr: Number(quote.app_fee_idr),
      exchange_rate: quote.exchange_rate,
      merchant_name: quote.merchant_name,
      merchant_id: quote.merchant_id,
      acquirer: quote.acquirer,
      fee_payer_pubkey: quote.fee_payer_address,
      pjp_partner: "mock",
    });
  if (insertRes.error) {
    console.error("[qris/pay] tx insert failed:", insertRes.error);
    return c.json({ error: "tx_record_failed" }, 500);
  }

  // Co-sign + submit
  let submit;
  try {
    submit = await submitPaymentTx({ userSignedTxBase64: input.signed_tx });
  } catch (err) {
    console.error("[qris/pay] submit failed:", err);
    await supabaseAdmin
      .from("transactions")
      .update({
        status: "rejected",
        failure_reason: (err as Error).message,
      })
      .eq("id", tx_id);
    return c.json(
      {
        error: "submit_failed",
        message: (err as Error).message,
      },
      502,
    );
  }

  const signature = submit.signature.toString();

  // Mark Solana confirmed
  await supabaseAdmin
    .from("transactions")
    .update({
      status: "solana_confirmed",
      signature,
    })
    .eq("id", tx_id);

  // Notify PJP partner (mock) — fire-and-record. We don't wait for IDR
  // settlement; PJP webhook (Day 8) flips the row to "completed".
  try {
    const pjp = getPJP();
    const pjpRes = await pjp.initiate({
      external_id: tx_id,
      amount_idr: quote.amount_idr,
      qris_string: quote.qris_string,
      merchant_name: quote.merchant_name,
      merchant_id: quote.merchant_id,
    });
    await supabaseAdmin
      .from("transactions")
      .update({
        status: "pjp_pending",
        pjp_id: pjpRes.pjp_id,
      })
      .eq("id", tx_id);
  } catch (err) {
    console.error("[qris/pay] PJP initiate failed (non-fatal):", err);
    // Solana side already settled. Mark as solana_confirmed and let manual
    // reconciliation (or a Day 8 retry job) push to PJP later.
  }

  // Burn quote (replay defense) — done LAST so failure paths above can let
  // user retry without re-quoting.
  quoteStore.delete(input.quote_id);

  const body: PayResponse = {
    transaction_id: tx_id,
    status: "solana_confirmed",
    signature,
    is_mock: false,
  };
  return c.json(body);
});
