/**
 * Deposit tax — 0.2% of every incoming USDC deposit goes to treasury.
 *
 * Triggered by the scan-deposits endpoint AFTER each new deposit is
 * recorded. Per-deposit:
 *   1. Compute tax = floor(amount * 0.002), skip if dust (<100 lamports
 *      = 0.0001 USDC, where SOL gas would exceed the tax value)
 *   2. Build SPL TransferChecked tx: user_ata → treasury_ata, amount=tax
 *   3. Sign with Privy server SDK using the user's session signer
 *      authority (requires PRIVY_AUTHORIZATION_KEY env var)
 *   4. Submit + confirm via fee-payer (we pay SOL gas)
 *   5. Insert audit row in transactions as type='deposit_tax'
 *
 * Graceful degradation:
 *   - PRIVY_AUTHORIZATION_KEY missing → log + skip (deposit still recorded)
 *   - User has no active session signer → log + skip
 *   - Privy sign call fails → log + skip
 *   - Submit fails → log + skip
 *
 * Failures DO NOT block the deposit recording — the user still gets their
 * deposit registered, we just lose this round of revenue. Logged loudly so
 * we can investigate.
 */

import {
  address,
  appendTransactionMessageInstruction,
  createNoopSigner,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  partiallySignTransactionMessageWithSigners,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
} from "@solana/kit";
import {
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  getTransferCheckedInstruction,
} from "@solana-program/token";
// web3.js side imports — needed only for the Privy hand-off (Privy SDK
// types its wallet API in terms of @solana/web3.js Transaction classes).
// Connection used to submit + confirm the fully signed wire bytes since
// kit's sendAndConfirm factory expects kit-typed signers.
import {
  Connection,
  VersionedTransaction,
} from "@solana/web3.js";
import { env } from "../env.js";
import { getFeePayer, getRpc } from "./fee-payer.js";
import { privy } from "./privy.js";
import { supabaseAdmin } from "./supabase.js";

// 0.2% in basis points (100bps = 1%)
const DEPOSIT_TAX_BPS = 20n;
const BPS_DENOMINATOR = 10_000n;
// Skip dust — tax below this is not worth a Solana tx (gas > tax value).
// 100 lamports of USDC = 0.0001 USDC; gas is ~5000 SOL lamports.
const DUST_THRESHOLD_LAMPORTS = 100n;

export interface DepositTaxInput {
  userId: string; // internal users.id
  privyUserId: string; // Privy DID — needed to look up walletId for signing
  userSolanaAddress: string;
  depositAmountLamports: bigint;
  depositSignature: string; // for traceability
}

interface DepositTaxResult {
  ok: boolean;
  reason?: string;
  signature?: string;
  taxLamports?: bigint;
}

/**
 * Sweep deposit tax for a single deposit. Safe to call in parallel for
 * multiple deposits via Promise.allSettled.
 */
export async function sweepDepositTax(
  input: DepositTaxInput,
): Promise<DepositTaxResult> {
  // 1. Compute tax + dust check.
  const taxLamports =
    (input.depositAmountLamports * DEPOSIT_TAX_BPS) / BPS_DENOMINATOR;
  if (taxLamports < DUST_THRESHOLD_LAMPORTS) {
    return { ok: false, reason: "dust", taxLamports };
  }

  // 2. Privy authorization key required to sign on user's behalf.
  if (!env.PRIVY_AUTHORIZATION_KEY) {
    console.warn(
      "[deposit-tax] PRIVY_AUTHORIZATION_KEY not configured — skipping. " +
        "Set it to enable real-time deposit tax sweep.",
    );
    return { ok: false, reason: "privy_key_missing" };
  }

  // 3. Build tx + sign via Privy.
  let signature: string;
  try {
    signature = await buildSignAndSendTaxTx(input, taxLamports);
  } catch (err) {
    console.error("[deposit-tax] tx build/sign/submit failed:", err, {
      userId: input.userId,
      depositSignature: input.depositSignature,
    });
    return { ok: false, reason: "tx_failed" };
  }

  // 4. Persist audit row. Failure here = on-chain tax already collected
  // but DB out of sync. Log loudly. Treasury still got the USDC.
  const nowIso = new Date().toISOString();
  const { error: insErr } = await supabaseAdmin.from("transactions").insert({
    user_id: input.userId,
    quote_id: "00000000-0000-0000-0000-000000000000",
    type: "deposit_tax" as const,
    status: "completed" as const,
    amount_idr: 0,
    amount_usdc_lamports: Number(taxLamports),
    app_fee_idr: 0,
    exchange_rate: "0",
    merchant_name: "Platform Tax (deposit)",
    merchant_id: input.depositSignature.slice(0, 32), // for traceability
    acquirer: null,
    signature,
    fee_payer_pubkey: "treasury",
    pjp_partner: "mock",
    pjp_id: null,
    pjp_settled_at: nowIso,
    failure_reason: null,
    created_at: nowIso,
    updated_at: nowIso,
  });
  if (insErr && insErr.code !== "23505") {
    console.error("[deposit-tax] audit insert failed:", insErr, {
      userId: input.userId,
      signature,
    });
  }

  console.log(
    `[deposit-tax] swept ${taxLamports} lamports (0.2% of ${input.depositAmountLamports}) → treasury (${signature})`,
  );
  return { ok: true, signature, taxLamports };
}

/**
 * Build a TransferChecked tx (user_ata → treasury_ata), partially sign as
 * fee-payer, then send the unsigned-by-user portion to Privy server SDK to
 * sign with the user's session signer authority.
 *
 * NOTE: This is a SCAFFOLD that follows Privy's documented walletApi
 * pattern. The exact API surface for `walletApi.solana.signTransaction`
 * may need adjustment based on the @privy-io/server-auth version
 * installed. If signing fails with a "method not found" or similar, the
 * user-side authority key flow may need to use Privy's REST raw_sign
 * endpoint directly instead.
 */
async function buildSignAndSendTaxTx(
  input: DepositTaxInput,
  taxLamports: bigint,
): Promise<string> {
  const rpc = getRpc();
  const feePayer = await getFeePayer();
  const treasuryAta = address(env.TREASURY_USDC_ATA);
  const usdcMint = address(env.USDC_MINT);
  const userAddr = address(input.userSolanaAddress);

  const [userAta] = await findAssociatedTokenPda({
    owner: userAddr,
    mint: usdcMint,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });

  // TransferChecked authority is the user. We don't hold their key —
  // Privy signs via the session signer below. To make the message
  // header reserve TWO signature slots (feePayer + user) so Privy has
  // a slot to fill, we wrap the user address in a NoopSigner. Without
  // this, the @solana-program/token instruction builder treats `authority`
  // as a non-signer Address and the resulting message has only ONE
  // required signature (feePayer). Privy then sees nothing to sign and
  // returns the tx unchanged — which Solana rejects at simulation with
  // `MissingRequiredSignature` because the SPL Token program runtime
  // requires the authority signature regardless of the message header.
  const userAuthoritySigner = createNoopSigner(userAddr);
  const transferIx = getTransferCheckedInstruction({
    source: userAta,
    mint: usdcMint,
    destination: treasuryAta,
    authority: userAuthoritySigner,
    amount: taxLamports,
    decimals: 6,
  });

  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(feePayer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
    (m) => appendTransactionMessageInstruction(transferIx, m),
  );

  // Partially sign. The fee-payer keypair fills slot 0; the noop user
  // signer reserves slot 1 with an empty signature for Privy to fill.
  const partiallySigned = await partiallySignTransactionMessageWithSigners(
    message,
  );
  const partialWireB64 = getBase64EncodedWireTransaction(partiallySigned);

  // Diagnostic: verify the message expects 2 signatures (feePayer + user).
  // If this logs `numRequiredSignatures: 1`, the noop signer didn't take
  // effect and we need to investigate the @solana-program/token version.
  const debugTxBytes = Buffer.from(partialWireB64, "base64");
  const debugTx = VersionedTransaction.deserialize(debugTxBytes);
  console.log("[deposit-tax] partial-sign tx", {
    numRequiredSignatures: debugTx.message.header.numRequiredSignatures,
    signatureSlots: debugTx.signatures.length,
    signers: debugTx.message.staticAccountKeys
      .slice(0, debugTx.message.header.numRequiredSignatures)
      .map((k, i) => ({
        index: i,
        address: k.toBase58(),
        filled: !(debugTx.signatures[i]?.every((b) => b === 0) ?? true),
      })),
  });

  // Privy signs as the user via session signer.
  const fullySignedB64 = await signWithPrivySessionSigner({
    privyUserId: input.privyUserId,
    walletAddress: input.userSolanaAddress,
    transactionBase64: partialWireB64,
  });

  // Submit + confirm via web3.js Connection (kit's sendAndConfirm factory
  // expects kit-typed signers — we have raw bytes here).
  const conn = new Connection(env.HELIUS_RPC_URL, "confirmed");
  const signedBytes = Buffer.from(fullySignedB64, "base64");
  const signature = await conn.sendRawTransaction(signedBytes, {
    skipPreflight: false,
    preflightCommitment: "confirmed",
    maxRetries: 3,
  });
  // Confirm with same blockhash lifetime we used. If this times out, the
  // tx is still in-flight — caller logs failure but treasury may receive
  // the USDC anyway. Manual reconciliation needed in that edge case.
  await conn.confirmTransaction(
    {
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: Number(latestBlockhash.lastValidBlockHeight),
    },
    "confirmed",
  );

  return signature;
}

/**
 * Sign a Solana transaction on the user's behalf via Privy session signer.
 *
 * Privy SDK 1.32.5+ exposes `walletApi.solana.signTransaction(...)`. The
 * `transaction` argument is a @solana/web3.js VersionedTransaction; we
 * deserialize the wire bytes from kit on the way in and re-serialize
 * after Privy returns.
 *
 * Auth requirements (set up in PrivyClient init via privy.ts):
 *   - PRIVY_APP_ID + PRIVY_APP_SECRET → basic auth
 *   - PRIVY_AUTHORIZATION_KEY → signs the request itself (Privy verifies
 *     server is authorized to sign on behalf of users with this key in
 *     their session signer config)
 *   - The user must have actively added this key as a session signer
 *     (via /onboarding/consent: addSessionSigners → SIGNER_ID matches
 *     our PRIVY_AUTHORIZATION_KEY_ID). If the wallet's session signer
 *     was added under a DIFFERENT authorization key (e.g. a previous
 *     key we rotated away from), Privy will silently return a tx
 *     without filling the user signature slot — Solana RPC then rejects
 *     with `MissingRequiredSignature`. We detect this case explicitly
 *     below and throw a clearer error so the caller can guide the user
 *     to revoke + re-add One-Tap.
 */
/** In-memory cache: privyUserId → walletId. Avoids re-fetching Privy user
 * on every sweep. Cleared on process restart. */
const walletIdCache = new Map<string, string>();

async function resolveWalletId(privyUserId: string): Promise<string> {
  const cached = walletIdCache.get(privyUserId);
  if (cached) return cached;

  const user = await privy.getUserById(privyUserId);
  const wallet = user.linkedAccounts.find(
    (a) =>
      a.type === "wallet" &&
      "chainType" in a &&
      (a as { chainType?: string }).chainType === "solana" &&
      "id" in a &&
      typeof (a as { id?: unknown }).id === "string",
  ) as ({ id: string } | undefined);

  if (!wallet?.id) {
    throw new Error(
      `wallet_id_not_found: privy.getUserById returned no Solana wallet with id for ${privyUserId}`,
    );
  }
  walletIdCache.set(privyUserId, wallet.id);
  return wallet.id;
}

async function signWithPrivySessionSigner(args: {
  privyUserId: string;
  walletAddress: string;
  transactionBase64: string;
}): Promise<string> {
  // Deserialize partially-signed wire bytes into web3.js VersionedTransaction.
  const wireBytes = Buffer.from(args.transactionBase64, "base64");
  const tx = VersionedTransaction.deserialize(wireBytes);

  // Snapshot the signature for the user slot BEFORE asking Privy to
  // sign. The transferChecked instruction marks `authority` (= user) as
  // a required signer; the corresponding slot in tx.signatures is
  // currently a zero-filled 64-byte buffer (Solana's default for
  // unsigned slots). After Privy signs, that slot should be non-zero.
  const userAccountIndex = tx.message.staticAccountKeys.findIndex(
    (k) => k.toBase58() === args.walletAddress,
  );
  if (userAccountIndex === -1) {
    throw new Error(
      `wallet_not_in_tx: ${args.walletAddress} is not a static account in the transaction`,
    );
  }

  // Resolve walletId for this user. Privy SDK 1.32.5 emits a deprecation
  // warning for the address-based lookup AND, in our testing, silently
  // returns the unmodified tx when address is used (verified against a
  // wallet that's correctly registered with our authorization key). The
  // walletId path works reliably.
  const walletId = await resolveWalletId(args.privyUserId);

  const result = await privy.walletApi.solana.signTransaction({
    walletId,
    transaction: tx,
  });

  // Re-serialize the fully signed tx.
  const signed = result.signedTransaction;
  if (!("serialize" in signed)) {
    throw new Error("privy returned unsupported transaction type");
  }
  const signedTx = signed as VersionedTransaction;

  // Validate: the user signature slot must now be non-zero (filled).
  // If it's still zero-filled, Privy returned the input tx without
  // actually signing — typically because the wallet's active session
  // signer was added under a different authorization key.
  const userSig = signedTx.signatures[userAccountIndex];
  const isEmpty =
    !userSig ||
    userSig.length === 0 ||
    userSig.every((b) => b === 0);
  if (isEmpty) {
    // Diagnostic dump — log everything we know about the tx so we can
    // tell whether Privy returned the input unchanged (no signing
    // attempted) vs filled wrong slot vs some other failure mode.
    console.error("[deposit-tax] Privy returned unsigned tx, dumping state:", {
      walletId,
      walletAddress: args.walletAddress,
      userAccountIndex,
      numRequiredSignatures: tx.message.header.numRequiredSignatures,
      signatureSlots: signedTx.signatures.length,
      slot_states: signedTx.signatures.map((s, i) => ({
        index: i,
        account: tx.message.staticAccountKeys[i]?.toBase58(),
        filled: !(s?.every((b) => b === 0) ?? true),
      })),
    });
    throw new Error(
      `privy_signature_missing: walletId=${walletId} address=${args.walletAddress} userSlot=${userAccountIndex}. ` +
        `Privy returned tx without filling the user signature slot. See log above for tx structure dump. ` +
        `If numRequiredSignatures < userSlot+1, the instruction builder didn't mark authority as a signer. ` +
        `Otherwise Privy SDK is silently no-op'ing — try upgrading @privy-io/server-auth or using REST raw_sign.`,
    );
  }

  return Buffer.from(signedTx.serialize()).toString("base64");
}
