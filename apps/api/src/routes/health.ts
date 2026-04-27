import { Hono } from "hono";
import { env } from "../env.js";

export const health = new Hono();

health.get("/healthz", (c) =>
  c.json({
    ok: true,
    service: "dollarkilat-api",
    version: "0.1.0",
    network: env.SOLANA_NETWORK,
    pjp: env.PJP_PARTNER,
    time: new Date().toISOString(),
  }),
);

health.get("/", (c) =>
  c.json({
    name: "dollarkilat api",
    docs: "/healthz",
  }),
);
