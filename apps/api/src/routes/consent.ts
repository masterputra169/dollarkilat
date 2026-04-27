import { Hono } from "hono";

// TODO Day 4: delegated actions consent. See docs/06.
//   POST   /consent/delegated      — create/update consent (max_per_tx, max_per_day, expires)
//   DELETE /consent/delegated/:id  — revoke (instant)
export const consent = new Hono();

consent.post("/delegated", async (c) =>
  c.json({ error: "not_implemented", task: "Day 4 — consent create" }, 501),
);

consent.delete("/delegated/:id", async (c) =>
  c.json({ error: "not_implemented", task: "Day 9 — consent revoke" }, 501),
);
