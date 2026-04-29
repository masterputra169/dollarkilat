import { createMiddleware } from "hono/factory";
import { privy } from "../lib/privy.js";

export type AuthVariables = {
  privyUserId: string;
};

/**
 * Verify `Authorization: Bearer <privy-access-token>` and attach the Privy
 * user DID to context. Reject with 401 on missing/invalid token.
 *
 * Use:
 *   const r = new Hono<{ Variables: AuthVariables }>();
 *   r.use("*", authMiddleware);
 *   r.get("/me", c => c.json({ id: c.get("privyUserId") }));
 */
export const authMiddleware = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    const header = c.req.header("Authorization");
    if (!header?.startsWith("Bearer ")) {
      return c.json({ error: "unauthorized", message: "missing bearer token" }, 401);
    }
    const token = header.slice("Bearer ".length).trim();
    if (!token) {
      return c.json({ error: "unauthorized", message: "empty token" }, 401);
    }

    try {
      const claims = await privy.verifyAuthToken(token);
      c.set("privyUserId", claims.userId);
      await next();
    } catch (err) {
      console.warn("[auth] token verify failed:", (err as Error).message);
      return c.json({ error: "invalid_token" }, 401);
    }
  },
);
