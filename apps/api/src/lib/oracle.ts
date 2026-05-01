import { env } from "../env.js";

const FRESH_TTL_MS = 60_000; // serve cache without re-fetch
const STALE_TTL_MS = 24 * 60 * 60_000; // serve stale on CoinGecko outage up to 24h
const FETCH_TIMEOUT_MS = 6_000; // bail fast if CoinGecko hangs

interface RateCache {
  rate: string;
  cached_at: number;
  /** True when value is from cache because live fetch failed. */
  stale?: boolean;
}

let cache: RateCache | null = null;

/**
 * Fetch USDC → IDR conversion rate from CoinGecko (free tier, no key required;
 * key applied if env.COINGECKO_API_KEY is set).
 *
 * Resilience model:
 *   1. Within FRESH_TTL_MS → serve cache, no network call
 *   2. Cache expired → try CoinGecko with 6s timeout
 *   3. Live fetch fails AND we have a cache < STALE_TTL_MS old →
 *      serve stale cache (USDC↔IDR moves <0.5%/day, 24h stale is fine
 *      for display) so dashboard doesn't 502 just because CoinGecko
 *      hits a rate limit
 *   4. No cache at all + live fail → throw (caller maps to 502)
 */
export async function getUSDCToIDRRate(): Promise<RateCache> {
  const now = Date.now();
  if (cache && now - cache.cached_at < FRESH_TTL_MS) {
    return cache;
  }

  const url =
    "https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=idr";
  const headers: Record<string, string> = { Accept: "application/json" };
  if (env.COINGECKO_API_KEY) {
    headers["x-cg-demo-api-key"] = env.COINGECKO_API_KEY;
  }

  try {
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

    cache = { rate: idr.toString(), cached_at: now };
    return cache;
  } catch (err) {
    // Live fetch failed. Fall back to stale cache if we have one within the
    // 24h grace window. Only throw if we truly have nothing.
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
