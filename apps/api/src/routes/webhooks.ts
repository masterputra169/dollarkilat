import { Hono } from "hono";

// TODO Day 8: PJP partner settlement webhook. Signature verify + idempotency.
// Receives callback from DOKU/Flip after QRIS payment to merchant.
export const webhooks = new Hono();

webhooks.post("/pjp", async (c) =>
  c.json(
    { error: "not_implemented", task: "Day 8 — implement PJP webhook" },
    501,
  ),
);
