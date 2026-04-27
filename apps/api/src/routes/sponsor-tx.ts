import { Hono } from "hono";

// TODO Day 7: backend co-sign as fee payer + submit. See docs/06-sponsored-tx-delegated.md.
// Internal helper called by /qris/pay; should NOT be public-callable in production.
export const sponsorTx = new Hono();

sponsorTx.post("/", async (c) =>
  c.json(
    { error: "not_implemented", task: "Day 7 — implement /api/sponsor-tx" },
    501,
  ),
);
