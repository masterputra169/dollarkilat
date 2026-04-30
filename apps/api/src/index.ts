import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { env } from "./env.js";
import { health } from "./routes/health.js";
import { qris } from "./routes/qris.js";
import { sponsorTx } from "./routes/sponsor-tx.js";
import { consent } from "./routes/consent.js";
import { webhooks } from "./routes/webhooks.js";
import { balance } from "./routes/balance.js";
import { rate } from "./routes/rate.js";
import { users } from "./routes/users.js";

const app = new Hono();

app.use("*", logger());
app.use("*", secureHeaders());
app.use(
  "*",
  cors({
    origin: env.WEB_ORIGIN.split(",").map((s) => s.trim()),
    credentials: true,
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  }),
);

app.route("/", health);
app.route("/users", users);
app.route("/qris", qris);
app.route("/sponsor-tx", sponsorTx);
app.route("/consent", consent);
app.route("/webhooks", webhooks);
app.route("/balance", balance);
app.route("/rate", rate);

app.onError((err, c) => {
  console.error("[unhandled]", err);
  return c.json({ error: "internal_error" }, 500);
});

app.notFound((c) => c.json({ error: "not_found" }, 404));

const port = Number(env.PORT);
serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, (info) => {
  console.log(`✓ dollarkilat api listening on http://0.0.0.0:${info.port} (LAN reachable)`);
});
