import { Hono } from "hono";

// TODO Day 3: read USDC balance onchain via Helius RPC.
//   GET /balance/:address → { lamports, ui_amount, ui_amount_string }
export const balance = new Hono();

balance.get("/:address", async (c) => {
  const _address = c.req.param("address");
  return c.json(
    { error: "not_implemented", task: "Day 3 — read SPL token balance onchain" },
    501,
  );
});
