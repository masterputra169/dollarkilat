import { Hono } from "hono";
import { authMiddleware, type AuthVariables } from "../middleware/auth.js";
import { getUSDCBalance } from "../lib/solana.js";

const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export const balance = new Hono<{ Variables: AuthVariables }>();

balance.use("*", authMiddleware);

/**
 * GET /balance/:address
 * Read SPL USDC balance for an owner (authenticated). Auth gate prevents the
 * endpoint from being abused as a free Helius proxy by anonymous callers;
 * the address itself is public so we don't tie it to the caller's privy id.
 *
 * Response: { address, lamports, ui_amount } — see BalanceResponseSchema in @dollarkilat/shared
 */
balance.get("/:address", async (c) => {
  const owner = c.req.param("address");
  if (!SOLANA_ADDRESS_RE.test(owner)) {
    return c.json({ error: "invalid_address" }, 400);
  }

  try {
    const data = await getUSDCBalance(owner);
    return c.json(data);
  } catch (err) {
    console.error("[balance] fetch failed:", err);
    return c.json({ error: "balance_fetch_failed" }, 502);
  }
});
