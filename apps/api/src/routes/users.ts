import { Hono } from "hono";
import { authMiddleware, type AuthVariables } from "../middleware/auth.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { fetchPrivyIdentity } from "../lib/privy.js";
import { sendWelcomeBonus } from "../lib/welcome-bonus.js";
import type { User } from "@dollarkilat/shared";

export const users = new Hono<{ Variables: AuthVariables }>();

users.use("*", authMiddleware);

/**
 * POST /users/sync
 * Idempotent. Pulls fresh email + solana_address from Privy and upserts the
 * user row keyed on privy_id. Called on every login.
 */
users.post("/sync", async (c) => {
  const privyUserId = c.get("privyUserId");

  let identity;
  try {
    identity = await fetchPrivyIdentity(privyUserId);
  } catch (err) {
    console.error("[users/sync] fetchPrivyIdentity failed:", err);
    return c.json({ error: "privy_lookup_failed" }, 502);
  }

  const { data: existing, error: selectErr } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("privy_id", privyUserId)
    .maybeSingle();

  if (selectErr) {
    console.error("[users/sync] select failed:", selectErr);
    return c.json({ error: "db_error", message: selectErr.message }, 500);
  }

  const isNew = !existing;
  const now = new Date().toISOString();

  const { data: upserted, error: upsertErr } = await supabaseAdmin
    .from("users")
    .upsert(
      {
        privy_id: privyUserId,
        email: identity.email,
        solana_address: identity.solanaAddress,
        updated_at: now,
      },
      { onConflict: "privy_id" },
    )
    .select("id, privy_id, email, solana_address, created_at, updated_at")
    .single();

  if (upsertErr || !upserted) {
    console.error("[users/sync] upsert failed:", upsertErr);
    return c.json({ error: "db_error", message: upsertErr?.message }, 500);
  }

  // Welcome bonus — fire-and-forget so the sync response stays fast (<200ms
  // typical) even when we trigger an on-chain transfer (~1-2s confirm). All
  // failure paths are logged inside sendWelcomeBonus and never throw.
  if (isNew && upserted.solana_address) {
    sendWelcomeBonus(upserted.id as string, upserted.solana_address as string)
      .catch((err) =>
        console.error("[users/sync] welcome bonus crashed:", err),
      );
  }

  return c.json({ user: upserted as User, is_new: isNew });
});

/**
 * GET /users/me
 * Convenience read of the current user's row.
 */
users.get("/me", async (c) => {
  const privyUserId = c.get("privyUserId");

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, privy_id, email, solana_address, created_at, updated_at")
    .eq("privy_id", privyUserId)
    .maybeSingle();

  if (error) {
    console.error("[users/me] select failed:", error);
    return c.json({ error: "db_error", message: error.message }, 500);
  }
  if (!data) {
    return c.json({ error: "not_found", message: "call POST /users/sync first" }, 404);
  }

  return c.json({ user: data as User });
});
