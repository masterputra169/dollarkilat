import { PrivyClient } from "@privy-io/server-auth";
import { env } from "../env.js";

// Server-side Privy client. Used to:
//   - verifyAuthToken(token)  → AuthTokenClaims (claims.userId is the Privy DID)
//   - getUserById(userId)     → User { linkedAccounts: [...] }
export const privy = new PrivyClient(env.PRIVY_APP_ID, env.PRIVY_APP_SECRET);

export interface PrivyIdentity {
  privyUserId: string;
  email: string | null;
  solanaAddress: string | null;
}

/**
 * Pull canonical identity (email + Solana embedded wallet address) from
 * Privy for a verified user. Throws if user not found.
 */
export async function fetchPrivyIdentity(
  privyUserId: string,
): Promise<PrivyIdentity> {
  const user = await privy.getUserById(privyUserId);

  // Prefer top-level shortcuts (Privy populates these per login method),
  // fall back to scanning linkedAccounts so we cover passkey/Apple/etc.
  const email =
    user.email?.address ??
    user.google?.email ??
    user.apple?.email ??
    user.linkedAccounts.find(
      (a): a is typeof a & { address: string } =>
        a.type === "email" && "address" in a,
    )?.address ??
    user.linkedAccounts.find(
      (a): a is typeof a & { email: string } =>
        a.type.endsWith("_oauth") && "email" in a && typeof a.email === "string",
    )?.email ??
    null;

  // Embedded Solana wallet — Privy creates one per user when
  // walletChainType=solana-only + createOnLogin=all-users.
  const solanaWallet = user.linkedAccounts.find(
    (a): a is typeof a & { address: string; chainType: "solana" } =>
      a.type === "wallet" &&
      "chainType" in a &&
      a.chainType === "solana" &&
      "address" in a,
  );

  return {
    privyUserId,
    email,
    solanaAddress: solanaWallet?.address ?? null,
  };
}
