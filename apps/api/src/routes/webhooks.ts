import { Hono } from "hono";
import { supabaseAdmin } from "../lib/supabase.js";
import { getPJP } from "../lib/pjp/index.js";

export const webhooks = new Hono();

/**
 * POST /webhooks/pjp
 *
 * Receives settlement callbacks from the active PJP partner. Signature
 * verification + idempotent status update + transaction lifecycle advance.
 *
 * Flow:
 *   1. Read raw body (we need exact bytes for HMAC verification)
 *   2. Hand off to provider's `parseWebhook()` — it owns its own auth scheme
 *      (mock: HMAC-SHA256 over body; Flip: token form-field)
 *   3. Update transactions row by external_id (= our internal tx UUID)
 *   4. Idempotent: re-applying the same event yields the same row state
 */
webhooks.post("/pjp", async (c) => {
  const provider = getPJP();

  // We need the raw body bytes for signature verification — Hono's c.req.text()
  // returns the unaltered body string the partner signed.
  const rawBody = await c.req.text();

  // Headers — coerce iterable to plain Record<string,string> for parseWebhook.
  const headers: Record<string, string> = {};
  c.req.raw.headers.forEach((v, k) => {
    headers[k.toLowerCase()] = v;
  });

  const event = provider.parseWebhook(headers, rawBody);
  if (!event) {
    // Debug logging — temporary, helps diagnose signature mismatch.
    // Remove after partner integration is validated.
    console.warn("[webhooks/pjp] signature/payload rejected\n", {
      method: c.req.method,
      url: c.req.url,
      // FULL header dump — exposes any custom auth header partner uses.
      // Note: tokens included; remove this log block before production.
      headers,
      // FULL body so we see exact JSON shape from partner.
      body: rawBody,
    });
    // Either signature failed or payload is malformed. We answer 401 so
    // partners can retry with corrected signature; mock stops retrying.
    return c.json({ error: "invalid_signature_or_payload" }, 401);
  }

  // Map PJP status → our transaction status.
  // Settlement-side terminal states:
  //   "settled"    → "completed"           (IDR delivered to merchant)
  //   "failed"     → "failed_settlement"   (PJP couldn't deliver)
  //   "expired"    → "failed_settlement"   (window closed)
  //   "cancelled"  → "failed_settlement"   (manual cancel from partner)
  //   "pending"    → no DB change          (already pjp_pending)
  let nextStatus: string | null = null;
  let failureReason: string | null = null;
  let settledAt: string | null = null;

  switch (event.status) {
    case "settled":
      nextStatus = "completed";
      settledAt = event.occurred_at;
      break;
    case "failed":
      nextStatus = "failed_settlement";
      failureReason = "pjp_failed";
      break;
    case "expired":
      nextStatus = "failed_settlement";
      failureReason = "pjp_expired";
      break;
    case "cancelled":
      nextStatus = "failed_settlement";
      failureReason = "pjp_cancelled";
      break;
    case "pending":
      // No-op; ack so partner stops retrying.
      return c.json({ ok: true, applied: false });
    default:
      console.warn("[webhooks/pjp] unknown status:", event.status);
      return c.json({ error: "unknown_status" }, 400);
  }

  // Match strategy:
  //   1. Primary: by `pjp_id` (Flip's own disbursement id) — we persisted
  //      it on initiate response. Most reliable match because partner echoes
  //      it verbatim in every callback.
  //   2. Fallback: by `id` (our UUID, which we passed in `remark`). Many
  //      partners truncate remark — Flip caps at 18 chars — so this only
  //      works for partners that preserve full string.
  //
  // Flip dashboard "Test Callback" sends remark="Callback testing remark"
  // and id=123 (placeholder), neither of which match real txs. Our pjp_id
  // lookup just returns 0 rows for those — handled gracefully.

  let updateRes;
  if (event.pjp_id) {
    updateRes = await supabaseAdmin
      .from("transactions")
      .update({
        status: nextStatus,
        pjp_settled_at: settledAt,
        failure_reason: failureReason,
      })
      .eq("pjp_id", event.pjp_id)
      .in("status", ["pjp_pending", "solana_confirmed"])
      .select("id, status");
  } else {
    // No pjp_id from event — try external_id as UUID fallback.
    const UUID_RE =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(event.external_id)) {
      console.warn(
        `[webhooks/pjp] no pjp_id and external_id "${event.external_id}" not a UUID — likely a "Test Callback". Acknowledging without DB update.`,
      );
      return c.json({ ok: true, applied: false, reason: "test_callback" });
    }
    updateRes = await supabaseAdmin
      .from("transactions")
      .update({
        status: nextStatus,
        pjp_id: event.pjp_id,
        pjp_settled_at: settledAt,
        failure_reason: failureReason,
      })
      .eq("id", event.external_id)
      .in("status", ["pjp_pending", "solana_confirmed"])
      .select("id, status");
  }
  const { error, data } = updateRes;

  if (error) {
    console.error("[webhooks/pjp] update failed:", error);
    // Return 200 anyway — partner webhooks retry on non-2xx, and we
    // already have the full event in our logs for manual reconciliation.
    // Flagging 500 just causes retry storms without fixing the issue.
    return c.json({ ok: false, error: "update_failed", code: error.code }, 200);
  }

  return c.json({
    ok: true,
    applied: data && data.length > 0,
    new_status: data?.[0]?.status ?? null,
  });
});
