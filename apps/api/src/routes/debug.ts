/**
 * Debug endpoints — auth-required, returns runtime state for diagnosing
 * Privy session signer mismatches and similar configuration issues.
 *
 * Safe to leave on in production: every endpoint is gated by the same
 * Privy auth middleware as the rest of the API, and only returns data
 * about the calling user's own wallet (no cross-user leakage).
 */

import { Hono } from "hono";
import { authMiddleware, type AuthVariables } from "../middleware/auth.js";
import { privy } from "../lib/privy.js";
import { env } from "../env.js";

export const debug = new Hono<{ Variables: AuthVariables }>();

debug.use("*", authMiddleware);

/**
 * GET /debug/signer-status
 *
 * Returns the calling user's Privy wallet info, including any registered
 * authorization key IDs (session signers). Compare the IDs against the
 * backend's PRIVY_AUTHORIZATION_KEY_ID env to diagnose mismatches.
 *
 * Expected healthy output for One-Tap to work:
 *   - wallet present
 *   - additionalSigners (or similar) contains backend_key_id
 *   - frontend's NEXT_PUBLIC_PRIVY_SIGNER_ID === backend_key_id
 */
debug.get("/signer-status", async (c) => {
  const privyUserId = c.get("privyUserId");

  let user;
  try {
    user = await privy.getUserById(privyUserId);
  } catch (err) {
    return c.json(
      {
        error: "privy_lookup_failed",
        message: (err as Error).message,
      },
      502,
    );
  }

  // Find the user's Solana wallet linked account.
  const solanaWallet = user.linkedAccounts.find(
    (a) =>
      a.type === "wallet" &&
      "chainType" in a &&
      (a as { chainType?: string }).chainType === "solana",
  );

  // Dump the raw wallet object so any field Privy exposes (delegated,
  // additionalSigners, walletId, etc) is visible — different SDK versions
  // surface session signer info under different keys.
  return c.json({
    backend: {
      authorization_key_id: env.PRIVY_AUTHORIZATION_KEY_ID ?? null,
      authorization_key_set: Boolean(env.PRIVY_AUTHORIZATION_KEY),
    },
    user: {
      privy_id: privyUserId,
      linked_accounts_count: user.linkedAccounts.length,
    },
    solana_wallet: solanaWallet ?? null,
    hint:
      "Compare backend.authorization_key_id with any signer/key ID inside " +
      "solana_wallet (typically under additionalSigners or similar). " +
      "If they don't match, /onboarding/consent registered the wrong " +
      "signer ID — most often because Vercel env NEXT_PUBLIC_PRIVY_SIGNER_ID " +
      "is stale or the build happened before the env was updated.",
  });
});
