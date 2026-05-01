/**
 * PJP factory — return the active provider per env. Real (DOKU/Flip)
 * providers will be added behind feature flags later; for hackathon we
 * only ship Mock.
 */

import { env } from "../../env.js";
import { FlipPJP } from "./flip.js";
import { MockPJP } from "./mock.js";
import type { PJPProvider } from "./types.js";

let _provider: PJPProvider | null = null;

export function getPJP(): PJPProvider {
  if (_provider) return _provider;
  switch (env.PJP_PARTNER) {
    case "mock":
      _provider = new MockPJP(env.PJP_WEBHOOK_SECRET ?? "mock-secret-dev");
      break;
    case "flip": {
      const secretKey = env.PJP_API_KEY;
      const validationToken = env.PJP_WEBHOOK_SECRET;
      if (!secretKey || !validationToken) {
        throw new Error(
          "PJP_PARTNER=flip but missing PJP_API_KEY (Flip secret_key) or PJP_WEBHOOK_SECRET (Flip validation token). Fill apps/api/.env.local.",
        );
      }
      _provider = new FlipPJP({
        baseUrl: env.FLIP_BASE_URL,
        secretKey,
        validationToken,
      });
      break;
    }
    case "doku":
      // Implementation lands post-hackathon. Failing fast beats silent
      // degradation to mock in production.
      throw new Error(
        `PJP_PARTNER=${env.PJP_PARTNER} not yet implemented; use "mock" or "flip".`,
      );
    default: {
      // Exhaustiveness guard — TypeScript already restricts the union, but
      // a runtime check guards against env-time corruption.
      const _exhaustive: never = env.PJP_PARTNER;
      throw new Error(`Unknown PJP_PARTNER: ${_exhaustive}`);
    }
  }
  return _provider;
}

export type {
  PJPProvider,
  PJPInitiateInput,
  PJPInitiateResponse,
  PJPStatusResponse,
  PJPEvent,
  PJPStatus,
} from "./types.js";
