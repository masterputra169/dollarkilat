import { env } from "../env.js";

const TTL_MS = 60_000;

interface RateCache {
  rate: string;
  cached_at: number;
}

let cache: RateCache | null = null;

/**
 * Fetch USDC → IDR conversion rate from CoinGecko (free tier, no key required;
 * key applied if env.COINGECKO_API_KEY is set). Cached in-memory for 60s to
 * stay well under the 30 req/min free-tier limit.
 *
 * NOTE: CoinGecko occasionally returns stale/zero values during partial
 * outages. Caller should handle the failure case rather than hardcode a fallback.
 */
export async function getUSDCToIDRRate(): Promise<RateCache> {
  if (cache && Date.now() - cache.cached_at < TTL_MS) {
    return cache;
  }

  const url =
    "https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=idr";

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (env.COINGECKO_API_KEY) {
    headers["x-cg-demo-api-key"] = env.COINGECKO_API_KEY;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`coingecko_${res.status}`);
  }

  const data = (await res.json()) as { "usd-coin"?: { idr?: number } };
  const idr = data["usd-coin"]?.idr;
  if (typeof idr !== "number" || !Number.isFinite(idr) || idr <= 0) {
    throw new Error("coingecko_invalid_response");
  }

  cache = { rate: idr.toString(), cached_at: Date.now() };
  return cache;
}
