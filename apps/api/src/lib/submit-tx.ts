/**
 * Submit + confirm a fully-signed Solana transaction. Adds the fee-payer's
 * signature to the user-signed bytes, sends to RPC, polls confirmation
 * status, then returns the signature.
 *
 * We poll manually instead of using `sendAndConfirmTransactionFactory`
 * because the latter has very strict input branding (requires the message-
 * derived `lifetimeConstraint` brand on the Transaction shape) which gets
 * lost when we decode wire bytes back into a Transaction. Polling via
 * `getSignatureStatuses` is straightforward and gives equivalent semantics
 * for our payment use case.
 */

import { type Signature } from "@solana/kit";
import {
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  getTransactionDecoder,
  partiallySignTransaction,
  type Transaction,
} from "@solana/transactions";
import { getFeePayer, getRpc } from "./fee-payer.js";

export interface SubmitInput {
  /** Base64 user-signed transaction bytes (Privy returned). */
  userSignedTxBase64: string;
}

export interface SubmitResult {
  signature: Signature;
  /** ms epoch when confirmation returned. */
  confirmed_at: number;
}

const POLL_INTERVAL_MS = 600;
const POLL_TIMEOUT_MS = 30_000;

export async function submitPaymentTx(
  input: SubmitInput,
): Promise<SubmitResult> {
  const feePayer = await getFeePayer();
  const rpc = getRpc();

  // 1. Decode user-signed wire bytes back into Transaction shape.
  const wire = Buffer.from(input.userSignedTxBase64, "base64");
  const userSignedTx = getTransactionDecoder().decode(wire) as Transaction;

  // 2. Add fee payer signature without overwriting the user's.
  const fullySigned = await partiallySignTransaction(
    [feePayer.keyPair],
    userSignedTx,
  );

  // 3. Re-encode + submit raw.
  const wireBase64 = getBase64EncodedWireTransaction(fullySigned);
  const signature = await rpc
    .sendTransaction(wireBase64, { encoding: "base64" })
    .send();

  // 4. Poll for `confirmed` commitment.
  const start = Date.now();
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    const res = await rpc.getSignatureStatuses([signature]).send();
    const status = res.value[0];
    if (status) {
      if (status.err) {
        throw new Error(
          `tx confirmed with error: ${JSON.stringify(status.err)} (sig=${signature})`,
        );
      }
      const conf = status.confirmationStatus;
      if (conf === "confirmed" || conf === "finalized") {
        return {
          signature: getSignatureFromTransaction(fullySigned),
          confirmed_at: Date.now(),
        };
      }
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`confirmation timeout after ${POLL_TIMEOUT_MS}ms (sig=${signature})`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
