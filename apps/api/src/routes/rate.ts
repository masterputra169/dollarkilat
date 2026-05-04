import { Hono } from "hono";
import { getUSDCToIDRRate } from "../lib/oracle.js";

export const rate = new Hono();

/**
 * GET /rate/usdc-idr
 * Public price endpoint — no auth, since upstream data is already public.
 * Backed by Indodax USDC/IDR ticker (primary) with CoinGecko fallback.
 * The 5-min server-side cache (in oracle.ts) keeps us well under upstream
 * rate limits even if every authenticated dashboard polls aggressively.
 *
 * Response: { rate, cached_at } — RateResponseSchema in @dollarkilat/shared
 */
rate.get("/usdc-idr", async (c) => {
  try {
    const data = await getUSDCToIDRRate();
    return c.json({
      rate: data.rate,
      cached_at: new Date(data.cached_at).toISOString(),
    });
  } catch (err) {
    console.error("[rate] fetch failed:", err);
    return c.json({ error: "rate_unavailable" }, 502);
  }
});
