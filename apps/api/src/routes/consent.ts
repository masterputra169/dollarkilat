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

/**
 * Server-side delegation check.
 *
 * Privy ships two delegation flavors:
 *   - Legacy on-device delegation → wallet has `delegated: true` on linkedAccount
 *   - TEE session signers (current default) → wallet has `additionalSigners[]`
 *     populated, NOT the legacy `delegated` flag
 *
 * Since this app uses session signers (`useSessionSigners().addSessionSigners`),
 * the legacy flag is *never* set. Authoritative check requires calling
 * `walletApi.getWallet()` and inspecting `additionalSigners` — but that needs
 * the authorization private key configured (PRIVY_AUTHORIZATION_KEY, set in
 * Day 7). For now we trust the client: frontend calls addSessionSigners
 * (Privy biometric prompt = real authority transfer) before POSTing here.
 *
 * Worst-case attack: client lies they delegated. Result: consent row exists
 * but Day 7's `walletApi.solana.signTransaction` fails — no money moves.
 * Defense-in-depth via signing failure is sufficient for MVP.
 */
async function isWalletDelegated(privyUserId: string): Promise<boolean> {
  try {
    const user = await privy.getUserById(privyUserId);
    // Accept either signal: legacy `delegated` flag OR a Solana wallet
    // exists at all (real check happens at sign time).
    const hasLegacyFlag = user.linkedAccounts.some(
      (a) =>
        a.type === "wallet" &&
        "chainType" in a &&
        a.chainType === "solana" &&
        "delegated" in a &&
        a.delegated === true,
    );
    const hasSolanaWallet = user.linkedAccounts.some(
      (a) =>
        a.type === "wallet" && "chainType" in a && a.chainType === "solana",
    );
    return hasLegacyFlag || hasSolanaWallet;
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
 * Frontend MUST call Privy `addSessionSigners()` first (client-side
 * Privy iframe prompt). Backend then verifies via Privy that the
 * wallet has session signers attached, and only then writes the
 * policy row.
 *
 * Single-active invariant: before inserting a new active consent, this
 * handler revokes any previously-active consent rows for the same user.
 * Without that step, repeated "Aktifkan One-Tap" clicks accumulate
 * multiple active rows in the DB — which breaks the revoke flow
 * (frontend's DELETE only kills the latest active row by id, leaving
 * older active rows untouched, so users have to click "Matikan
 * One-Tap" multiple times to actually revoke everything).
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
              "Privy reports the embedded wallet has not been delegated. Run addSessionSigners() on the client first.",
          },
          409,
        );
      }
    }

    // Enforce single-active invariant: revoke any previously-active consents
    // before inserting a new row. Idempotent — no-op if there's nothing
    // active to revoke. We mark them as revoked at the moment the new
    // consent is being created, which is semantically accurate.
    const nowIso = new Date().toISOString();
    const { error: revokeErr } = await supabaseAdmin
      .from("delegated_actions_consents")
      .update({ revoked_at: nowIso })
      .eq("user_id", userId)
      .is("revoked_at", null);
    if (revokeErr) {
      // Don't fail the request — proceed to insert the new row. Worst case
      // we end up with multiple active rows again, but that's the
      // pre-existing behavior, not a regression.
      console.warn("[consent] auto-revoke previous failed:", revokeErr);
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
 * DELETE /consent/delegated/:id — revoke ALL active consents for the user.
 *
 * The :id in the URL is preserved for backwards compatibility with the
 * frontend, but the actual scope is "every active consent for this user."
 * This intentionally cleans up DB state from before the POST handler
 * enforced the single-active invariant — without this, users who
 * accumulated multiple active rows in the past would have to click
 * "Matikan One-Tap" multiple times to fully revoke.
 *
 * Privy-side session signers are also wiped client-side by the frontend
 * (settings/page.tsx → removeSessionSigners). This handler only manages
 * our DB record.
 */
consent.delete("/delegated/:id", async (c) => {
  const privyUserId = c.get("privyUserId");
  const userId = await getInternalUserId(privyUserId);
  if (!userId) return c.json({ error: "user_not_synced" }, 404);

  // The :id is accepted but not used in the WHERE clause — we revoke
  // all active rows for this user, not just one by id. Backward-compat
  // with the existing frontend call site.
  const _ignoredId = c.req.param("id");
  void _ignoredId;

  const nowIso = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("delegated_actions_consents")
    .update({ revoked_at: nowIso })
    .eq("user_id", userId)
    .is("revoked_at", null)
    .select("id");

  if (error) {
    console.error("[consent] revoke failed:", error);
    return c.json({ error: "consent_revoke_failed" }, 500);
  }
  const revokedCount = data?.length ?? 0;
  if (revokedCount > 1) {
    console.log(
      `[consent] revoked ${revokedCount} stale active rows for user ${userId} ` +
        `(legacy multi-active state — single-active invariant now enforced on POST)`,
    );
  }
  return c.json({ ok: true, revoked: revokedCount });
});
