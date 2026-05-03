import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { authMiddleware, type AuthVariables } from "../middleware/auth.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { fetchPrivyIdentity } from "../lib/privy.js";
import { sendWelcomeBonus } from "../lib/welcome-bonus.js";
import {
  HandleClaimRequestSchema,
  type HandleResolveResponse,
  type User,
} from "@dollarkilat/shared";

export const users = new Hono<{ Variables: AuthVariables }>();

// Public lookup — used to resolve @handle to a wallet for receive flows.
// Mounted BEFORE the auth middleware so callers don't need a Privy token
// (typical use: client receives "@sarah", wants to fetch the address).
users.get("/by-handle/:handle", async (c) => {
  const raw = c.req.param("handle").trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(raw)) {
    return c.json({ error: "invalid_handle" }, 400);
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("handle, solana_address, email")
    .eq("handle", raw)
    .maybeSingle();

  if (error) {
    console.error("[users/by-handle] select failed:", error);
    return c.json({ error: "db_error" }, 500);
  }
  if (!data) {
    return c.json({ error: "handle_not_found" }, 404);
  }

  // Email returned for OAuth verification UX (e.g., "@sarah belongs to
  // sarah***@gmail.com — confirm before sending"). Frontend can mask.
  const body: HandleResolveResponse = {
    handle: data.handle as string,
    solana_address: (data.solana_address as string | null) ?? null,
    email: (data.email as string | null) ?? null,
  };
  return c.json(body);
});

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
    .select("id, privy_id, email, solana_address, handle, created_at, updated_at")
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
    .select("id, privy_id, email, solana_address, handle, created_at, updated_at")
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

/**
 * PATCH /users/handle
 * Claim or update the @handle. Pass `null` to release. Conflict-safe —
 * if another user owns the requested handle, returns 409.
 */
users.patch(
  "/handle",
  zValidator("json", HandleClaimRequestSchema),
  async (c) => {
    const privyUserId = c.get("privyUserId");
    const input = c.req.valid("json");

    // Find the internal user id first.
    const { data: me, error: meErr } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("privy_id", privyUserId)
      .maybeSingle();
    if (meErr || !me) {
      return c.json({ error: "user_not_synced" }, 404);
    }

    const { data, error } = await supabaseAdmin
      .from("users")
      .update({ handle: input.handle ?? null })
      .eq("id", me.id)
      .select(
        "id, privy_id, email, solana_address, handle, created_at, updated_at",
      )
      .single();

    if (error) {
      // 23505 = unique_violation on handle.
      if (error.code === "23505") {
        return c.json(
          {
            error: "handle_taken",
            message: `@${input.handle} sudah dipakai user lain. Coba yang lain.`,
          },
          409,
        );
      }
      // 23514 = check constraint violation (format).
      if (error.code === "23514") {
        return c.json(
          {
            error: "handle_invalid_format",
            message:
              "Handle harus 3-20 karakter, hanya huruf kecil, angka, atau underscore.",
          },
          400,
        );
      }
      console.error("[users/handle] update failed:", error);
      return c.json({ error: "db_error", message: error.message }, 500);
    }

    return c.json({ user: data as User });
  },
);
