/**
 * Flip Bisnis disbursement adapter — implements PJPProvider against
 * Flip's Money Transfer API.
 *
 * Auth:    Basic auth, secret_key as username, empty password.
 *          Authorization: Basic ${base64(secret_key + ":")}
 * Base URL: configurable via env.FLIP_BASE_URL
 *          - sandbox: https://bigflip.id/big_sandbox_api/v3
 *          - production: https://bigflip.id/api/v3
 *
 * Endpoints used:
 *   POST /disbursement                  → create
 *   GET  /disbursement?id={pjp_id}      → status
 *   webhook: POST our /webhooks/pjp with x-callback-token header
 *
 * VERIFY THESE ASSUMPTIONS against the partner's actual docs (we couldn't
 * fetch them at build time). If the endpoint shape differs:
 *   1. POST body shape — Flip historically uses x-www-form-urlencoded
 *      with fields { account_number, bank_code, amount, remark, idempotency-key }
 *   2. Response field names — common: { id, status, amount, ... }
 *   3. Status mapping — Flip statuses: PENDING / DONE / CANCELLED
 *
 * Limitations (sandbox):
 *   - QRIS payout (bank_code = "qris") NOT available on all accounts.
 *     Most sandbox accounts only support bank account disbursement.
 *   - We pass through whatever bank_code merchant claimed; Flip rejects
 *     if not on their supported list.
 *   - Sandbox does NOT actually move IDR; merchant rekening real won't
 *     receive money. Only data flow is real.
 */

import { randomUUID } from "node:crypto";
import { env } from "../../env.js";
import type {
  PJPProvider,
  PJPInitiateInput,
  PJPInitiateResponse,
  PJPStatusResponse,
  PJPEvent,
  PJPStatus,
} from "./types.js";

interface FlipDisbursementResponse {
  id?: number | string;
  user_id?: number;
  amount?: number;
  status?: string; // "PENDING" | "DONE" | "CANCELLED" (uppercase)
  reason?: string;
  timestamp?: string;
  bank_code?: string;
  account_number?: string;
  recipient_name?: string;
  remark?: string;
  receipt?: string;
  fee?: number;
  // ...partner returns more; we keep raw for forensics
}

interface FlipMerchantContext {
  /** Bank code (e.g. "bca") OR "qris" if tier-supported */
  bank_code: string;
  /** Bank account number, or QRIS NMID when bank_code = "qris" */
  account_number: string;
  account_holder: string;
}

const FLIP_TO_PJP_STATUS: Record<string, PJPStatus> = {
  PENDING: "pending",
  DONE: "settled",
  CANCELLED: "cancelled",
  FAILED: "failed",
};

export class FlipPJP implements PJPProvider {
  readonly name = "flip";

  private readonly baseUrl: string;
  private readonly secretKey: string;
  private readonly validationToken: string;

  /** External callers pass merchant routing per call (we don't store it here). */
  constructor(opts: {
    baseUrl: string;
    secretKey: string;
    validationToken: string;
  }) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.secretKey = opts.secretKey;
    this.validationToken = opts.validationToken;
  }

  /**
   * Caller MUST attach merchant bank info to `input` via the `merchant`
   * extension. We extend PJPInitiateInput at the call site (qris/pay)
   * by passing through merchant_bank_code etc — see `initiateWithBank`
   * helper or augment input shape if you prefer.
   *
   * For now: throw if merchant context missing. Backend (qris/pay) is
   * responsible for providing the bank fields when PJP_PARTNER=flip.
   */
  async initiate(input: PJPInitiateInput): Promise<PJPInitiateResponse> {
    const merchant = input.merchant;
    if (!merchant) {
      // Surface as a *typed* error so /qris/pay's catch block can recognize
      // this as a configuration gap (merchant unverified) rather than a
      // partner outage. Log message hints at the fix path.
      const err = new Error(
        "merchant_bank_info_missing: claim merchant dengan bank_code/account_number/account_holder, atau pakai Supabase Editor untuk update existing row.",
      );
      (err as Error & { code?: string }).code = "merchant_bank_info_missing";
      throw err;
    }

    // Idempotency: Flip recommends a per-request key so retries dedupe.
    const idempotencyKey = randomUUID();

    // Flip caps remark at 18 chars (validation error 1024). Use the first
    // 18 chars of the UUID — webhook handler matches transactions by
    // Flip's `id` (which we persist on initiate), NOT by remark, so
    // remark only needs to be human-readable for the partner dashboard.
    const remark = input.external_id.slice(0, 18);

    const body = new URLSearchParams();
    body.set("account_number", merchant.account_number);
    body.set("bank_code", merchant.bank_code.toLowerCase());
    body.set("amount", input.amount_idr); // integer rupiah string
    body.set("remark", remark);
    body.set("recipient_city", "391"); // Flip uses Bank Indonesia city codes; 391 is generic.

    const url = `${this.baseUrl}/disbursement`;
    const bodyStr = body.toString();

    console.info(
      "[FlipPJP] POST disbursement",
      JSON.stringify({
        url,
        body: Object.fromEntries(body.entries()),
        idempotency_key: idempotencyKey,
      }),
    );

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: this.basicAuthHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
        "idempotency-key": idempotencyKey,
      },
      body: bodyStr,
    });

    const responseText = await res.text();
    let json: FlipDisbursementResponse;
    try {
      json = JSON.parse(responseText) as FlipDisbursementResponse;
    } catch {
      json = {};
    }
    console.info(
      `[FlipPJP] response ${res.status}`,
      responseText.slice(0, 600),
    );

    if (!res.ok) {
      throw new Error(
        `flip_disbursement_failed (${res.status}): ${json.reason ?? responseText.slice(0, 200)}`,
      );
    }

    if (!json.id) {
      throw new Error(
        `flip_disbursement_missing_id: ${JSON.stringify(json)}`,
      );
    }

    const pjp_id = String(json.id);
    const status = FLIP_TO_PJP_STATUS[json.status?.toUpperCase() ?? ""] ?? "pending";

    // Flip doesn't return expires_at on disbursement — synthesize 1h window
    // for our internal bookkeeping. Real Flip eventually settles or stays
    // PENDING; webhook will flip our status.
    const expires_at = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    return { pjp_id, status, expires_at };
  }

  async getStatus(pjp_id: string): Promise<PJPStatusResponse> {
    const url = new URL(`${this.baseUrl}/disbursement`);
    url.searchParams.set("id", pjp_id);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: this.basicAuthHeader(),
      },
    });
    const json = (await res.json().catch(() => ({}))) as FlipDisbursementResponse;
    if (!res.ok) {
      return {
        pjp_id,
        external_id: "",
        status: "expired",
        settled_at: null,
        failure_reason: `flip_status_failed_${res.status}`,
      };
    }

    const status = FLIP_TO_PJP_STATUS[json.status?.toUpperCase() ?? ""] ?? "pending";
    return {
      pjp_id: String(json.id ?? pjp_id),
      external_id: "", // Flip doesn't echo our external_id on status; backend tracks via DB
      status,
      settled_at: status === "settled" ? json.timestamp ?? null : null,
      failure_reason:
        status === "failed" || status === "cancelled" ? json.reason ?? null : null,
    };
  }

  /**
   * Flip webhook scheme (per real callback observed):
   *   - Content-Type: application/x-www-form-urlencoded
   *   - Body: `data=<URL-encoded JSON>&token=<validation_token>`
   *
   * Auth: `token` form field equal to our validation token. Constant-time
   * compare via Buffer.equals after length pre-check.
   *
   * NOTE: Flip dashboard "Test Callback" sends the literal placeholder
   * "YOUR_VALIDATION_TOKEN_KEY" as the token — that's expected sandbox
   * behaviour, NOT a real signature. We accept it ONLY when NODE_ENV
   * !== production so we can validate the path end-to-end without
   * spoof-tolerance leaking into prod.
   */
  parseWebhook(
    _headers: Record<string, string>,
    body: string,
  ): PJPEvent | null {
    // 1. Parse URL-encoded form body
    const params = new URLSearchParams(body);
    const dataField = params.get("data");
    const tok = params.get("token");
    if (!dataField || !tok) return null;

    // 2. Verify token. Allow Flip's test placeholder ONLY in non-prod.
    const isPlaceholder = tok === "YOUR_VALIDATION_TOKEN_KEY";
    const isDev = process.env.NODE_ENV !== "production";

    if (!isPlaceholder) {
      if (tok.length !== this.validationToken.length) return null;
      if (!Buffer.from(tok).equals(Buffer.from(this.validationToken))) {
        return null;
      }
    } else if (!isDev) {
      // Refuse placeholder token in production — only Flip dashboard
      // "Test Callback" button uses it.
      return null;
    }

    // 3. Parse data JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(dataField);
    } catch {
      return null;
    }
    const p = parsed as {
      id?: unknown;
      status?: unknown;
      timestamp?: unknown;
      // We pass our internal tx UUID as `remark` to Flip on initiate.
      // Real callbacks echo it back; placeholder test sends Flip's own remark.
      remark?: unknown;
    };

    const flipStatus = String(p.status ?? "").toUpperCase();
    const mapped = FLIP_TO_PJP_STATUS[flipStatus] ?? "pending";

    return {
      pjp_id: String(p.id ?? ""),
      external_id: typeof p.remark === "string" ? p.remark : "",
      status: mapped,
      occurred_at:
        typeof p.timestamp === "string"
          ? p.timestamp
          : new Date().toISOString(),
      raw: parsed,
    };
  }

  // ── internal ────────────────────────────────────────────────

  private basicAuthHeader(): string {
    return `Basic ${Buffer.from(`${this.secretKey}:`).toString("base64")}`;
  }
}
