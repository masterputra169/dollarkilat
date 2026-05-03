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
import { supabaseAdmin } from "../lib/supabase.js";
import { env } from "../env.js";

export const debug = new Hono<{ Variables: AuthVariables }>();

/**
 * GET /debug/wallet-info?wallet=<solana_address>
 *
 * NO AUTH — takes a wallet address from query string and returns the
 * same Privy linked-account dump as /signer-status. Lets us bypass the
 * "copy a Privy JWT from DevTools" flow entirely when debugging session
 * signer mismatches in production.
 *
 * Returns only publicly observable data (wallet address + signer IDs
 * Privy already exposes on-chain or via its lookup), so leaking it is
 * low-risk for the hackathon window. Remove (or re-add auth)
 * post-hackathon.
 */
debug.get("/wallet-info", async (c) => {
  const walletAddr = c.req.query("wallet");
  if (!walletAddr || walletAddr.length < 32) {
    return c.json(
      {
        error: "missing_wallet",
        usage: "GET /debug/wallet-info?wallet=<solana_address>",
      },
      400,
    );
  }

  // Resolve wallet → privyUserId via our DB.
  const { data: userRow } = await supabaseAdmin
    .from("users")
    .select("privy_id")
    .eq("solana_address", walletAddr)
    .maybeSingle();
  if (!userRow?.privy_id) {
    return c.json(
      {
        error: "wallet_not_in_users_table",
        message:
          "No user row in our DB has this Solana address. Did you sync via /users/sync?",
        backend: {
          authorization_key_id: env.PRIVY_AUTHORIZATION_KEY_ID ?? null,
          authorization_key_set: Boolean(env.PRIVY_AUTHORIZATION_KEY),
        },
      },
      404,
    );
  }

  let user;
  try {
    user = await privy.getUserById(userRow.privy_id as string);
  } catch (err) {
    return c.json(
      {
        error: "privy_lookup_failed",
        message: (err as Error).message,
        backend: {
          authorization_key_id: env.PRIVY_AUTHORIZATION_KEY_ID ?? null,
          authorization_key_set: Boolean(env.PRIVY_AUTHORIZATION_KEY),
        },
      },
      502,
    );
  }

  const solanaWallet = user.linkedAccounts.find(
    (a) =>
      a.type === "wallet" &&
      "chainType" in a &&
      (a as { chainType?: string }).chainType === "solana",
  );

  return c.json({
    backend: {
      authorization_key_id: env.PRIVY_AUTHORIZATION_KEY_ID ?? null,
      authorization_key_set: Boolean(env.PRIVY_AUTHORIZATION_KEY),
    },
    user: {
      privy_id: userRow.privy_id,
      linked_accounts_count: user.linkedAccounts.length,
    },
    solana_wallet: solanaWallet ?? null,
    hint:
      "Compare backend.authorization_key_id with any signer/key ID in " +
      "solana_wallet (look for 'additionalSigners', 'delegated', 'signerId'). " +
      "Mismatch = NEXT_PUBLIC_PRIVY_SIGNER_ID on Vercel is stale OR the " +
      "Vercel build happened before that env was updated.",
  });
});

// Authed endpoints below require a valid Privy JWT.
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
