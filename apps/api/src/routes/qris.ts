import { Hono } from "hono";

// TODO Day 6-8: implement quote + pay handlers per docs/04 + docs/06.
// Endpoints:
//   POST /qris/quote — { qris_string } → { quote_id, amount_idr, amount_usdc, exchange_rate, expires_at }
//   POST /qris/pay   — { quote_id, qris_string, mode, signed_tx? } → { transaction_id, status, signature }
export const qris = new Hono();

qris.post("/quote", async (c) =>
  c.json({ error: "not_implemented", task: "Day 6 — implement /api/qris/quote" }, 501),
);

qris.post("/pay", async (c) =>
  c.json({ error: "not_implemented", task: "Day 8 — implement /api/qris/pay" }, 501),
);
