/**
 * Mock PJP provider — simulates DOKU/Flip-shape API for hackathon demo.
 *
 * Behavior:
 *  - `initiate()` records the request in-memory, returns a UUID-shape pjp_id
 *    immediately as "pending".
 *  - After a randomized delay (300-1500ms), the entry transitions to "settled"
 *    with 95% probability, "failed" with 5%.
 *  - `getStatus()` returns whatever's currently in the in-memory store.
 *  - `parseWebhook()` accepts any payload signed with the shared mock secret
 *    (HMAC-SHA256 over body). For the demo we don't actually fire webhooks
 *    out — backend can poll `getStatus()` instead.
 *
 * Limitations:
 *  - State is per-process. A backend restart loses pending PJP records,
 *    which is fine for a 14-day hackathon. Real impls hit a real DB.
 *  - No real money moves. PJP-side settlement is purely a state transition.
 */

import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import type {
  PJPProvider,
  PJPInitiateInput,
  PJPInitiateResponse,
  PJPStatusResponse,
  PJPEvent,
  PJPStatus,
} from "./types.js";

interface MockRecord {
  pjp_id: string;
  external_id: string;
  status: PJPStatus;
  amount_idr: string;
  merchant_name: string;
  initiated_at: string;
  expires_at: string;
  settled_at: string | null;
  failure_reason: string | null;
}

const SETTLE_WINDOW_MS = 5 * 60 * 1000; // 5 menit
const SUCCESS_RATE = 0.95;

export class MockPJP implements PJPProvider {
  readonly name = "mock";

  private readonly store = new Map<string, MockRecord>();
  private readonly webhookSecret: string;

  constructor(webhookSecret: string) {
    this.webhookSecret = webhookSecret;
  }

  async initiate(input: PJPInitiateInput): Promise<PJPInitiateResponse> {
    const pjp_id = randomUUID();
    const now = new Date();
    const expires_at = new Date(now.getTime() + SETTLE_WINDOW_MS).toISOString();

    const record: MockRecord = {
      pjp_id,
      external_id: input.external_id,
      status: "pending",
      amount_idr: input.amount_idr.toFixed(0),
      merchant_name: input.merchant_name,
      initiated_at: now.toISOString(),
      expires_at,
      settled_at: null,
      failure_reason: null,
    };
    this.store.set(pjp_id, record);

    // Schedule async settlement to mimic real network behavior.
    const delay = 300 + Math.floor(Math.random() * 1200);
    setTimeout(() => this.resolve(pjp_id), delay).unref?.();

    return { pjp_id, status: "pending", expires_at };
  }

  async getStatus(pjp_id: string): Promise<PJPStatusResponse> {
    const r = this.store.get(pjp_id);
    if (!r) {
      // Treat unknown ids as expired — safer than throwing inside route handler.
      return {
        pjp_id,
        external_id: "",
        status: "expired",
        settled_at: null,
        failure_reason: "unknown_pjp_id",
      };
    }
    return {
      pjp_id: r.pjp_id,
      external_id: r.external_id,
      status: r.status,
      settled_at: r.settled_at,
      failure_reason: r.failure_reason,
    };
  }

  parseWebhook(
    headers: Record<string, string>,
    body: string,
  ): PJPEvent | null {
    const sig = headers["x-mock-signature"] ?? headers["X-Mock-Signature"];
    if (!sig) return null;
    const expected = createHmac("sha256", this.webhookSecret)
      .update(body)
      .digest("hex");
    // timingSafeEqual requires equal lengths or it throws.
    if (sig.length !== expected.length) return null;
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      return null;
    }
    const p = parsed as {
      pjp_id?: unknown;
      external_id?: unknown;
      status?: unknown;
      occurred_at?: unknown;
    };
    if (
      typeof p.pjp_id !== "string" ||
      typeof p.external_id !== "string" ||
      typeof p.status !== "string"
    ) {
      return null;
    }
    return {
      pjp_id: p.pjp_id,
      external_id: p.external_id,
      status: p.status as PJPStatus,
      occurred_at:
        typeof p.occurred_at === "string"
          ? p.occurred_at
          : new Date().toISOString(),
      raw: parsed,
    };
  }

  // ── internal ────────────────────────────────────────────────

  private resolve(pjp_id: string): void {
    const r = this.store.get(pjp_id);
    if (!r || r.status !== "pending") return;
    const now = new Date().toISOString();
    if (Math.random() < SUCCESS_RATE) {
      r.status = "settled";
      r.settled_at = now;
    } else {
      r.status = "failed";
      r.failure_reason = "mock_random_decline";
    }
    this.store.set(pjp_id, r);
  }
}
