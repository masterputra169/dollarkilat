import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  ConsentCreateSchema,
  type Consent,
  type ConsentResponse,
  DELEGATED_DEFAULT_MAX_PER_TX_IDR,
  DELEGATED_DEFAULT_MAX_PER_DAY_IDR,
  DELEGATED_CONSENT_TTL_DAYS,
} from "@dollarkilat/shared";
import { authMiddleware, type AuthVariables } from "../middleware/auth.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { privy } from "../lib/privy.js";

export const consent = new Hono<{ Variables: AuthVariables }>();

consent.use("*", authMiddleware);

// ── helpers ───────────────────────────────────────────────────

async function getInternalUserId(privyUserId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("privy_id", privyUserId)
    .maybeSingle();
  if (error) {
    console.error("[consent] users lookup failed:", error);
    return null;
  }
  return data?.id ?? null;
}

/** Has the user actually delegated their Solana embedded wallet to Privy? */
async function isWalletDelegated(privyUserId: string): Promise<boolean> {
  try {
    const user = await privy.getUserById(privyUserId);
    return user.linkedAccounts.some(
      (a) =>
        a.type === "wallet" &&
        "chainType" in a &&
        a.chainType === "solana" &&
        "delegated" in a &&
        a.delegated === true,
    );
  } catch (err) {
    console.error("[consent] privy lookup failed:", err);
    return false;
  }
}

interface ConsentRow {
  id: string;
  enabled: boolean;
  max_per_tx_idr: number | null;
  max_per_day_idr: number | null;
  consented_at: string;
  expires_at: string;
  revoked_at: string | null;
}

function rowToConsent(row: ConsentRow): Consent {
  return {
    id: row.id,
    enabled: row.enabled,
    max_per_tx_idr: row.max_per_tx_idr,
    max_per_day_idr: row.max_per_day_idr,
    consented_at: row.consented_at,
    expires_at: row.expires_at,
    revoked_at: row.revoked_at,
  };
}

async function loadActiveConsent(userId: string): Promise<Consent | null> {
  const { data, error } = await supabaseAdmin
    .from("delegated_actions_consents")
    .select(
      "id, enabled, max_per_tx_idr, max_per_day_idr, consented_at, expires_at, revoked_at",
    )
    .eq("user_id", userId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("consented_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[consent] active lookup failed:", error);
    return null;
  }
  return data ? rowToConsent(data as ConsentRow) : null;
}

// ── routes ────────────────────────────────────────────────────

/** GET /consent/delegated → current active consent + Privy delegation flag. */
consent.get("/delegated", async (c) => {
  const privyUserId = c.get("privyUserId");
  const userId = await getInternalUserId(privyUserId);
  if (!userId) return c.json({ error: "user_not_synced" }, 404);

  const [consentRow, walletDelegated] = await Promise.all([
    loadActiveConsent(userId),
    isWalletDelegated(privyUserId),
  ]);
  const body: ConsentResponse = {
    consent: consentRow,
    wallet_delegated: walletDelegated,
  };
  return c.json(body);
});

/**
 * POST /consent/delegated — record consent.
 * Frontend MUST call Privy `delegateWallet()` first (client-side biometric
 * prompt). Backend then verifies via Privy that the wallet is actually
 * delegated, and only then writes the policy row.
 *
 * Append-only: each call inserts a new row. Active row = latest non-revoked
 * non-expired (see loadActiveConsent).
 */
consent.post(
  "/delegated",
  zValidator("json", ConsentCreateSchema),
  async (c) => {
    const privyUserId = c.get("privyUserId");
    const userId = await getInternalUserId(privyUserId);
    if (!userId) return c.json({ error: "user_not_synced" }, 404);

    const input = c.req.valid("json");

    // Verify with Privy that the wallet has actually been delegated client-side.
    // Without this check, anyone could write a "consent" row without the user
    // having authorized the TEE-signing key — no real authority transfer.
    if (input.enabled) {
      const delegated = await isWalletDelegated(privyUserId);
      if (!delegated) {
        return c.json(
          {
            error: "wallet_not_delegated",
            message:
              "Privy reports the embedded wallet has not been delegated. Run delegateWallet() on the client first.",
          },
          409,
        );
      }
    }

    const expiresAt = new Date(
      Date.now() + DELEGATED_CONSENT_TTL_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data, error } = await supabaseAdmin
      .from("delegated_actions_consents")
      .insert({
        user_id: userId,
        enabled: input.enabled,
        max_per_tx_idr:
          input.max_per_tx_idr ?? DELEGATED_DEFAULT_MAX_PER_TX_IDR,
        max_per_day_idr:
          input.max_per_day_idr ?? DELEGATED_DEFAULT_MAX_PER_DAY_IDR,
        expires_at: expiresAt,
      })
      .select(
        "id, enabled, max_per_tx_idr, max_per_day_idr, consented_at, expires_at, revoked_at",
      )
      .single();

    if (error || !data) {
      console.error("[consent] insert failed:", error);
      return c.json({ error: "consent_insert_failed" }, 500);
    }

    const body: ConsentResponse = {
      consent: rowToConsent(data as ConsentRow),
      wallet_delegated: true,
    };
    return c.json(body, 201);
  },
);

/**
 * DELETE /consent/delegated/:id — revoke. Sets revoked_at on the active row.
 * (Day 9 expands this to also call Privy revoke API.)
 */
consent.delete("/delegated/:id", async (c) => {
  const privyUserId = c.get("privyUserId");
  const userId = await getInternalUserId(privyUserId);
  if (!userId) return c.json({ error: "user_not_synced" }, 404);

  const id = c.req.param("id");
  const { error } = await supabaseAdmin
    .from("delegated_actions_consents")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .is("revoked_at", null);

  if (error) {
    console.error("[consent] revoke failed:", error);
    return c.json({ error: "consent_revoke_failed" }, 500);
  }
  return c.json({ ok: true });
});
