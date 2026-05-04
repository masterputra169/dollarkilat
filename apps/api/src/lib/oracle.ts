import { env } from "../env.js";

// 12s TTL → ~5 call/menit per replica. Indodax public ticker budget is 180/min,
// so this leaves ~36× headroom and survives multi-replica scale + retry bursts.
// Tradeoff favors freshness: USDC/IDR display + fee calc stays near real-time.
const FRESH_TTL_MS = 12_000;
const STALE_TTL_MS = 24 * 60 * 60_000; // serve stale on full outage up to 24h
const FETCH_TIMEOUT_MS = 6_000; // bail fast if upstream hangs

// Retry budget per source. Indodax public ticker is generous (180/min) and
// CoinGecko free tier 429s sporadically; a short backoff usually clears it.
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 500;

type Source = "indodax" | "coingecko";

interface RateCache {
  rate: string;
  cached_at: number;
  /** True when value is from cache because live fetch failed. */
  stale?: boolean;
  /** Which upstream produced this value. Useful for logs + future telemetry. */
  source?: Source;
}

let cache: RateCache | null = null;

/**
 * Indodax public ticker — primary source.
 *
 *   GET https://indodax.com/api/ticker/usdcidr
 *
 * Why primary:
 *   - Native USDC/IDR pair (no cross-rate gymnastics, no FX leg).
 *   - Indonesian exchange = actual local market price, not global index.
 *   - Public endpoint, no auth, 180 req/min documented (we use ~12/hour).
 *   - Closer to Railway SG region than CoinGecko (~150ms vs ~300ms).
 *
 * Field choice: `last` (last traded price). Stable for fee calc, less jumpy
 * than `sell` (ask). USDC↔IDR spread on Indodax is consistently <0.5%, so
 * picking `last` over `sell` understates by negligible amount.
 *
 * Throws on non-2xx, malformed body, or non-finite rate.
 */
async function fetchIndodaxOnce(): Promise<number> {
  const url = "https://indodax.com/api/ticker/usdcidr";
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: ac.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    throw new Error(`indodax_${res.status}`);
  }
  const data = (await res.json()) as {
    ticker?: { last?: string | number };
  };
  const rawLast = data.ticker?.last;
  const idr =
    typeof rawLast === "number" ? rawLast : Number.parseFloat(String(rawLast ?? ""));
  if (!Number.isFinite(idr) || idr <= 0) {
    throw new Error("indodax_invalid_response");
  }
  return idr;
}

/**
 * CoinGecko simple price — fallback source.
 *
 *   GET https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=idr
 *
 * Used only when Indodax is unreachable. Free tier rate limited (10-30/min),
 * but our cache + Indodax-as-primary keeps real call volume near zero.
 */
async function fetchCoingeckoOnce(): Promise<number> {
  const url =
    "https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=idr";
  const headers: Record<string, string> = { Accept: "application/json" };
  if (env.COINGECKO_API_KEY) {
    headers["x-cg-demo-api-key"] = env.COINGECKO_API_KEY;
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, { headers, signal: ac.signal });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    throw new Error(`coingecko_${res.status}`);
  }
  const data = (await res.json()) as { "usd-coin"?: { idr?: number } };
  const idr = data["usd-coin"]?.idr;
  if (typeof idr !== "number" || !Number.isFinite(idr) || idr <= 0) {
    throw new Error("coingecko_invalid_response");
  }
  return idr;
}

/** Fetch with retry-on-transient using bounded exponential backoff + jitter. */
async function fetchWithRetry(
  fetchFn: () => Promise<number>,
  sourceName: Source,
): Promise<number> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fetchFn();
    } catch (err) {
      lastErr = err;
      const msg = (err as Error).message ?? "";
      const transient =
        msg === `${sourceName}_429` ||
        msg.startsWith(`${sourceName}_5`) ||
        msg === `${sourceName}_invalid_response`;
      if (!transient || attempt === MAX_RETRIES) break;
      const delay =
        RETRY_BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 200;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("oracle_fetch_failed");
}

/**
 * Fetch USDC → IDR conversion rate.
 *
 * Resilience model (defense in depth):
 *   1. Within FRESH_TTL_MS (12s) → serve cache, no network call.
 *   2. Cache expired → try Indodax with retries (primary).
 *   3. Indodax fails → try CoinGecko with retries (fallback).
 *   4. Both fail AND cache < STALE_TTL_MS (24h) → serve stale with stale=true.
 *      USDC↔IDR moves <0.5%/day so 24h is OK for display + fee calc.
 *   5. No cache + both fail → throw (caller maps to 502). This window is
 *      narrow because primeRateCache() runs from src/index.ts on startup.
 */
export async function getUSDCToIDRRate(): Promise<RateCache> {
  const now = Date.now();
  if (cache && now - cache.cached_at < FRESH_TTL_MS) {
    return cache;
  }

  // Primary: Indodax
  try {
    const idr = await fetchWithRetry(fetchIndodaxOnce, "indodax");
    cache = { rate: idr.toString(), cached_at: now, source: "indodax" };
    return cache;
  } catch (primaryErr) {
    console.warn(
      `[oracle] Indodax failed (${(primaryErr as Error).message}); trying CoinGecko fallback`,
    );
  }

  // Fallback: CoinGecko
  try {
    const idr = await fetchWithRetry(fetchCoingeckoOnce, "coingecko");
    cache = { rate: idr.toString(), cached_at: now, source: "coingecko" };
    return cache;
  } catch (fallbackErr) {
    if (cache && now - cache.cached_at < STALE_TTL_MS) {
      console.warn(
        `[oracle] all sources failed (${(fallbackErr as Error).message}); serving stale cache (${Math.round(
          (now - cache.cached_at) / 1000,
        )}s old, source=${cache.source ?? "unknown"})`,
      );
      return { ...cache, stale: true };
    }
    throw fallbackErr;
  }
}

/**
 * Convert USDC lamports → IDR (rounded down) using a rate string in the same
 * shape returned by getUSDCToIDRRate (e.g. "16500" or "16500.42"). Used for
 * audit-row amount_idr at insert time on deposit / deposit_tax / welcome_bonus
 * paths so the UI shows a meaningful Rupiah estimate instead of "Rp 0".
 *
 * Math: idr = lamports * rate / 10^6  (USDC has 6 decimals).
 * Rate is parsed to a 12-decimal-place bigint to preserve fractional cents.
 * Returns 0 on a malformed rate string — caller logs and writes 0 anyway.
 */
export function idrFromUsdcLamports(
  lamports: bigint,
  ratePerUsdcStr: string,
): number {
  const trimmed = ratePerUsdcStr.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return 0;
  const [whole, frac = ""] = trimmed.split(".") as [string, string?];
  const fracPadded = (frac ?? "").padEnd(12, "0").slice(0, 12);
  const rateScaled = BigInt(whole) * 1_000_000_000_000n + BigInt(fracPadded || "0");
  if (rateScaled <= 0n) return 0;
  const idr = (lamports * rateScaled) / (1_000_000n * 1_000_000_000_000n);
  return Number(idr);
}

/**
 * Fire-and-forget cache prime. Called once on server startup so the first
 * /rate/usdc-idr request after deploy is served from cache instead of
 * racing upstream (which is most likely to flake if multiple Railway
 * replicas restart simultaneously).
 *
 * Failure here is non-fatal — the next user request will retry via the
 * normal getUSDCToIDRRate path. Just logged.
 */
export function primeRateCache(): void {
  getUSDCToIDRRate()
    .then((r) => {
      console.log(
        `[oracle] cache primed via ${r.source ?? "unknown"}: 1 USDC = Rp ${Number(r.rate).toLocaleString("id-ID")}`,
      );
    })
    .catch((err) => {
      console.warn(
        `[oracle] cache prime failed: ${(err as Error).message} — first /rate request after deploy may 502`,
      );
    });
}
