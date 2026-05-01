/**
 * Fee payer wallet — server-side keypair that co-signs every sponsored
 * Solana transaction so users never touch SOL. Lazy-loaded singleton; the
 * keypair lives in memory for the process lifetime.
 *
 * Threat model: this keypair holds SOL only (no USDC, no authority over
 * user wallets). Worst case if compromised: attacker drains the SOL we
 * loaded → service degrades (sponsored tier offline) but no user funds
 * lost. Mitigated further by:
 *   - validate-tx whitelist (we only co-sign whitelisted instructions)
 *   - per-user / per-IP rate limit
 *   - daily spend cap on the fee payer wallet
 */

import {
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  type KeyPairSigner,
  type Rpc,
  type RpcSubscriptions,
  type SolanaRpcApi,
  type SolanaRpcSubscriptionsApi,
} from "@solana/kit";
import bs58 from "bs58";
import { env } from "../env.js";

let _signer: KeyPairSigner | null = null;
let _rpc: Rpc<SolanaRpcApi> | null = null;
let _rpcSubs: RpcSubscriptions<SolanaRpcSubscriptionsApi> | null = null;

/** Resolve the fee payer signer. Cached for the process lifetime. */
export async function getFeePayer(): Promise<KeyPairSigner> {
  if (_signer) return _signer;
  const secret = env.FEE_PAYER_PRIVATE_KEY;
  if (!secret || secret === "DEV_UNSET") {
    throw new Error(
      "FEE_PAYER_PRIVATE_KEY not configured. Run `npm run fee-payer:generate` and paste the secret into apps/api/.env.local.",
    );
  }
  let bytes: Uint8Array;
  try {
    bytes = bs58.decode(secret);
  } catch {
    throw new Error("FEE_PAYER_PRIVATE_KEY is not valid base58");
  }
  if (bytes.length !== 64) {
    throw new Error(
      `FEE_PAYER_PRIVATE_KEY decoded to ${bytes.length} bytes, expected 64 (Ed25519 secret = pub32 + priv32 concatenated).`,
    );
  }
  _signer = await createKeyPairSignerFromBytes(bytes);
  return _signer;
}

/** RPC client (HTTP). Cached. */
export function getRpc(): Rpc<SolanaRpcApi> {
  if (_rpc) return _rpc;
  _rpc = createSolanaRpc(env.HELIUS_RPC_URL);
  return _rpc;
}

/**
 * Subscriptions client (WebSocket). Used for confirmation polling via
 * `sendAndConfirmTransactionFactory`. Helius mirrors the HTTP path on wss://.
 */
export function getRpcSubscriptions(): RpcSubscriptions<SolanaRpcSubscriptionsApi> {
  if (_rpcSubs) return _rpcSubs;
  const wsUrl = env.HELIUS_RPC_URL.replace(/^https?:/, (m) =>
    m === "https:" ? "wss:" : "ws:",
  );
  _rpcSubs = createSolanaRpcSubscriptions(wsUrl);
  return _rpcSubs;
}
