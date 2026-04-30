import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { randomUUID } from "node:crypto";
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

export const qris = new Hono<{ Variables: AuthVariables }>();

qris.use("*", authMiddleware);

// ── In-memory quote store ─────────────────────────────────────
//
// Quotes have a 30s TTL and are write-once. In-memory is fine for the
// hackathon — a backend restart loses pending quotes, but a 30s window means
// the loss is invisible. Production swaps for Redis/Postgres.

interface StoredQuote {
  quote_id: string;
  privy_user_id: string;
  qris_string: string;
  amount_idr: string; // bigint as string (integer rupiah)
  amount_usdc: string; // BigNumber-as-string, 6 decimals UI representation
  amount_usdc_lamports: string; // bigint as string (integer)
  app_fee_idr: string; // integer rupiah
  exchange_rate: string;
  merchant_name: string;
  merchant_id: string | null;
  acquirer: string | null;
  created_at: number; // ms epoch
  expires_at: number; // ms epoch
}

const quoteStore = new Map<string, StoredQuote>();

function pruneExpired() {
  const now = Date.now();
  for (const [id, q] of quoteStore) {
    if (q.expires_at <= now) quoteStore.delete(id);
  }
}

// ── helpers ───────────────────────────────────────────────────

/**
 * Compute USDC amount + lamports from IDR amount and IDR-per-USDC rate.
 * Math is done with bigint scaled by 1e12 to avoid float drift, then
 * truncated to USDC's 6 decimals. App fee bps is added on top of the IDR
 * notional before conversion (treasury collects the fee in USDC).
 */
function quoteUsdc(
  amountIdr: bigint,
  ratePerUsdcStr: string,
): { amount_usdc_lamports: bigint; amount_usdc_ui: string; app_fee_idr: bigint } {
  // Fee in IDR (integer rupiah, ROUND_HALF_UP).
  const app_fee_idr =
    (amountIdr * BigInt(APP_FEE_BPS) + 5000n) / 10000n;

  const totalIdr = amountIdr + app_fee_idr;

  // ratePerUsdc is "IDR per 1 USDC", possibly fractional. Multiply by 1e12,
  // then divide totalIdr*1e12 by it — gives USDC * 1e12 (12 decimals
  // intermediate precision). Truncate to 6 decimals (lamports).
  const SCALE = 1_000_000_000_000n; // 1e12
  const rateScaled = parseRateToScaled(ratePerUsdcStr, 12n);
  if (rateScaled <= 0n) {
    throw new Error("rate_invalid");
  }

  // (totalIdr * 1e12) / rateScaled = USDC scaled by 1e12 / (rate in same scale)
  // → USDC value with no decimals; we want lamports = USDC * 1e6.
  // Easier: lamports = (totalIdr * 1e6 * 1e12) / rateScaled
  //                  = (totalIdr * 1e18) / rateScaled
  const lamports = (totalIdr * 1_000_000n * SCALE) / rateScaled;

  return {
    amount_usdc_lamports: lamports,
    amount_usdc_ui: formatLamportsUi(lamports, USDC_DECIMALS),
    app_fee_idr,
  };
}

function parseRateToScaled(s: string, decimals: bigint): bigint {
  const trimmed = s.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error("rate_invalid");
  }
  const [whole, frac = ""] = trimmed.split(".") as [string, string?];
  const fracPadded = (frac ?? "").padEnd(Number(decimals), "0").slice(0, Number(decimals));
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
 * POST /qris/quote — generate USDC quote for a QRIS payment.
 *
 * Trust boundary: client sends qris_string. Server re-parses + verifies CRC
 * (don't trust client's amount). If QR is static, client must include amount
 * separately... but we keep this MVP simple by rejecting static QR — Day 9
 * adds amount override path.
 */
qris.post("/quote", zValidator("json", QuoteRequestSchema), async (c) => {
  pruneExpired();
  const privyUserId = c.get("privyUserId");
  const { qris_string, amount_idr: clientAmountIdr } = c.req.valid("json");

  let decoded;
  try {
    decoded = parseQRIS(qris_string);
  } catch (err) {
    const code = err instanceof QRISParseError ? err.code : "qris_parse_failed";
    const message = (err as Error).message;
    return c.json({ error: code, message }, 400);
  }

  // Resolve effective amount:
  //   - dynamic QR: trust embedded tag 54 (server re-parsed, CRC verified)
  //     → ignore any client-supplied amount to prevent override
  //   - static QR:  no embedded amount → require client-supplied amount_idr
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
  if (amountIdrInt < BigInt(MIN_PAYMENT_IDR) || amountIdrInt > BigInt(MAX_PAYMENT_IDR)) {
    return c.json(
      {
        error: "amount_out_of_range",
        message: `Jumlah harus antara Rp ${MIN_PAYMENT_IDR} – Rp ${MAX_PAYMENT_IDR}`,
      },
      400,
    );
  }

  let rate;
  try {
    rate = await getUSDCToIDRRate();
  } catch (err) {
    console.error("[qris/quote] oracle failed:", err);
    return c.json({ error: "rate_unavailable" }, 502);
  }

  let usdc;
  try {
    usdc = quoteUsdc(amountIdrInt, rate.rate);
  } catch (err) {
    console.error("[qris/quote] usdc math failed:", err);
    return c.json({ error: "quote_math_failed" }, 500);
  }

  // Balance check — fail fast if user can't cover (amount + fee). Resolve the
  // Solana address from Supabase (synced at login by /users/sync) to avoid
  // a round-trip to Privy on every quote.
  try {
    const { data: userRow, error: userErr } = await supabaseAdmin
      .from("users")
      .select("solana_address")
      .eq("privy_id", privyUserId)
      .maybeSingle();
    if (userErr) {
      console.error("[qris/quote] user lookup failed:", userErr);
      return c.json({ error: "user_lookup_failed" }, 500);
    }
    const solanaAddress = userRow?.solana_address ?? null;
    if (!solanaAddress) {
      return c.json({ error: "wallet_not_provisioned" }, 409);
    }
    const balance = await getUSDCBalance(solanaAddress);
    const required = usdc.amount_usdc_lamports;
    if (BigInt(balance.lamports) < required) {
      return c.json(
        {
          error: "insufficient_balance",
          message: `Saldo USDC tidak cukup. Butuh ${formatLamportsUi(required, USDC_DECIMALS)} USDC, saldo kamu ${balance.ui_amount} USDC.`,
        },
        402,
      );
    }
  } catch (err) {
    console.error("[qris/quote] balance check failed:", err);
    return c.json({ error: "balance_check_failed" }, 502);
  }

  const now = Date.now();
  const stored: StoredQuote = {
    quote_id: randomUUID(),
    privy_user_id: privyUserId,
    qris_string,
    amount_idr: resolvedAmount,
    amount_usdc: usdc.amount_usdc_ui,
    amount_usdc_lamports: usdc.amount_usdc_lamports.toString(),
    app_fee_idr: usdc.app_fee_idr.toString(),
    exchange_rate: rate.rate,
    merchant_name: decoded.merchant_name,
    merchant_id: decoded.merchant_id,
    acquirer: decoded.acquirer,
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
  };
  return c.json(body);
});

/**
 * POST /qris/pay — Day 6 STUB. Validates the quote belongs to the caller
 * and is not expired, then returns a mocked signature so the frontend can
 * complete the success-screen flow today. Day 7 replaces this with real
 * Solana fee-payer signing + PJP mock initiate.
 */
qris.post("/pay", zValidator("json", PayRequestSchema), async (c) => {
  pruneExpired();
  const privyUserId = c.get("privyUserId");
  const { quote_id } = c.req.valid("json");

  const quote = quoteStore.get(quote_id);
  if (!quote) {
    return c.json({ error: "quote_not_found" }, 404);
  }
  if (quote.privy_user_id !== privyUserId) {
    return c.json({ error: "quote_not_owned" }, 403);
  }
  if (quote.expires_at <= Date.now()) {
    quoteStore.delete(quote_id);
    return c.json({ error: "quote_expired" }, 410);
  }

  // Mock signature. Real Solana signatures are 64-byte base58 (~88 chars);
  // we generate something same-shape so the frontend explorer link looks right
  // during the demo.
  const mockSig = mockSolanaSignature();

  const body: PayResponse = {
    transaction_id: randomUUID(),
    status: "solana_pending",
    signature: mockSig,
    is_mock: true, // Day 7 swaps to real signing → set false (or drop flag).
  };

  // Burn the quote AFTER we have a payment outcome to return — if the real
  // Day 7 path fails (Solana submit error, fee-payer empty, etc), the quote
  // stays valid and the user can retry without scanning again. With mock
  // we never fail, so it doesn't matter today; setting the precedent here.
  quoteStore.delete(quote_id);

  return c.json(body);
});

function mockSolanaSignature(): string {
  // Base58 alphabet, 88 chars — visually indistinguishable from real sig.
  const alphabet =
    "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let s = "";
  for (let i = 0; i < 88; i++) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return s;
}
