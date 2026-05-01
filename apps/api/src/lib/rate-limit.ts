/**
 * In-memory rate limiter. Per-user (privyUserId) + per-IP, sliding minute
 * + sliding day windows. Process-local — fine for single-instance hackathon
 * deploy; production swaps for Redis/Upstash.
 *
 * Why per-user AND per-IP: anonymous attackers spinning multiple Privy
 * accounts get caught by IP cap; compromised individual user gets caught
 * by user cap. Both layers enforced; either trip rejects.
 */

import {
  RATE_LIMIT_PER_IP_PER_MIN,
  RATE_LIMIT_PER_USER_PER_DAY,
  RATE_LIMIT_PER_USER_PER_MIN,
} from "@dollarkilat/shared";

interface Bucket {
  /** Timestamps of recent hits, ms epoch. Pruned lazily. */
  timestamps: number[];
}

const userMinute = new Map<string, Bucket>();
const userDaily = new Map<string, Bucket>();
const ipMinute = new Map<string, Bucket>();

const ONE_MIN = 60_000;
const ONE_DAY = 24 * 60 * 60_000;

function consume(
  store: Map<string, Bucket>,
  key: string,
  windowMs: number,
  limit: number,
): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  const cutoff = now - windowMs;
  let b = store.get(key);
  if (!b) {
    b = { timestamps: [] };
    store.set(key, b);
  }
  // Prune
  while (b.timestamps.length > 0 && (b.timestamps[0] ?? 0) < cutoff) {
    b.timestamps.shift();
  }
  if (b.timestamps.length >= limit) {
    const oldest = b.timestamps[0] ?? now;
    return { ok: false, retryAfterMs: Math.max(0, oldest + windowMs - now) };
  }
  b.timestamps.push(now);
  return { ok: true, retryAfterMs: 0 };
}

export interface RateLimitResult {
  ok: boolean;
  scope: "user_per_min" | "user_per_day" | "ip_per_min" | null;
  retryAfterMs: number;
}

/**
 * Run all 3 buckets. Returns first failure scope so the response can hint
 * which limit tripped (useful for client-side retry logic / UX messaging).
 */
export function checkRateLimit(input: {
  privyUserId: string;
  ip: string;
}): RateLimitResult {
  const u1 = consume(
    userMinute,
    input.privyUserId,
    ONE_MIN,
    RATE_LIMIT_PER_USER_PER_MIN,
  );
  if (!u1.ok) return { ok: false, scope: "user_per_min", retryAfterMs: u1.retryAfterMs };

  const u2 = consume(
    userDaily,
    input.privyUserId,
    ONE_DAY,
    RATE_LIMIT_PER_USER_PER_DAY,
  );
  if (!u2.ok) return { ok: false, scope: "user_per_day", retryAfterMs: u2.retryAfterMs };

  const i1 = consume(ipMinute, input.ip, ONE_MIN, RATE_LIMIT_PER_IP_PER_MIN);
  if (!i1.ok) return { ok: false, scope: "ip_per_min", retryAfterMs: i1.retryAfterMs };

  return { ok: true, scope: null, retryAfterMs: 0 };
}
