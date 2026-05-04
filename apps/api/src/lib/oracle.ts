import { env } from "../env.js";

const FRESH_TTL_MS = 5 * 60_000; // 5 min — well under CoinGecko free-tier rate limits
const STALE_TTL_MS = 24 * 60 * 60_000; // serve stale on CoinGecko outage up to 24h
const FETCH_TIMEOUT_MS = 6_000; // bail fast if CoinGecko hangs

// Retry budget for live fetches. CoinGecko free tier 429s sporadically; a
// short backoff usually clears it. Capped low so requests don't pile up.
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 500;

interface RateCache {
  rate: string;
  cached_at: number;
  /** True when value is from cache because live fetch failed. */
  stale?: boolean;
}

let cache: RateCache | null = null;

/** Single CoinGecko fetch attempt with timeout. Throws on non-2xx or invalid. */
async function fetchOnce(): Promise<number> {
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

/** Fetch with retry-on-429/5xx using bounded exponential backoff + jitter. */
async function fetchWithRetry(): Promise<number> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fetchOnce();
    } catch (err) {
      lastErr = err;
      const msg = (err as Error).message ?? "";
      const transient =
        msg === "coingecko_429" ||
        msg.startsWith("coingecko_5") ||
        msg === "coingecko_invalid_response";
      if (!transient || attempt === MAX_RETRIES) break;
      const delay =
        RETRY_BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 200;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("oracle_fetch_failed");
}

/**
 * Fetch USDC → IDR conversion rate from CoinGecko (free tier, no key required;
 * key applied if env.COINGECKO_API_KEY is set).
 *
 * Resilience model (defense in depth):
 *   1. Within FRESH_TTL_MS (5 min) → serve cache, no network call.
 *   2. Cache expired → try CoinGecko with retries (2 backoff rounds on
 *      429 / 5xx / invalid). Total upper bound ~3.5s including delays.
 *   3. Live fetch fails AND cache < STALE_TTL_MS (24h) → serve stale
 *      with stale=true flag. USDC↔IDR moves <0.5%/day so 24h is OK for
 *      display + fee calc.
 *   4. No cache at all + live fail → throw (caller maps to 502). This
 *      window is now narrow because primeRateCache() runs from
 *      src/index.ts on startup — by the time the first user request
 *      lands, cache is usually populated.
 */
export async function getUSDCToIDRRate(): Promise<RateCache> {
  const now = Date.now();
  if (cache && now - cache.cached_at < FRESH_TTL_MS) {
    return cache;
  }

  try {
    const idr = await fetchWithRetry();
    cache = { rate: idr.toString(), cached_at: now };
    return cache;
  } catch (err) {
    if (cache && now - cache.cached_at < STALE_TTL_MS) {
      console.warn(
        `[oracle] live fetch failed (${(err as Error).message}); serving stale cache (${Math.round(
          (now - cache.cached_at) / 1000,
        )}s old)`,
      );
      return { ...cache, stale: true };
    }
    throw err;
  }
}

/**
 * Fire-and-forget cache prime. Called once on server startup so the first
 * /rate/usdc-idr request after deploy is served from cache instead of
 * racing CoinGecko (which is most likely to 429 if multiple Railway
 * replicas restart simultaneously).
 *
 * Failure here is non-fatal — the next user request will retry via the
 * normal getUSDCToIDRRate path. Just logged.
 */
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

export function primeRateCache(): void {
  getUSDCToIDRRate()
    .then((r) => {
      console.log(
        `[oracle] cache primed: 1 USDC = Rp ${Number(r.rate).toLocaleString("id-ID")}`,
      );
    })
    .catch((err) => {
      console.warn(
        `[oracle] cache prime failed: ${(err as Error).message} — first /rate request after deploy may 502`,
      );
    });
}
