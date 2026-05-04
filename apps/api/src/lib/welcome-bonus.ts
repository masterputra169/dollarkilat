/**
 * Welcome bonus — first 10 new users get 5 USDC from treasury.
 *
 * Flow:
 *   1. /users/sync detects is_new=true → fires sendWelcomeBonus async
 *      (fire-and-forget, never blocks the sync response)
 *   2. Three guards (any failure = silent skip, logged for visibility):
 *      a. Idempotent: skip if user.welcome_bonus_sent_at IS NOT NULL
 *      b. Cap: skip if global welcome bonus count >= 10
 *      c. Treasury balance: skip if < 50 USDC remaining
 *   3. Build SPL TransferChecked: treasury_ata → user_usdc_ata, 5 USDC
 *   4. createAssociatedTokenIdempotent if user_ata missing
 *   5. Submit + confirm via fee-payer (which IS the treasury owner)
 *   6. Update users.welcome_bonus_sent_at + insert transactions row
 *
 * Why fire-and-forget: failure here is acceptable (treasury empty, RPC
 * down, etc.) — user gets the app, just no bonus. We don't punish their
 * onboarding for our infra issue. Logged loudly so we notice.
 */

import {
  address,
  appendTransactionMessageInstruction,
  createTransactionMessage,
  getSignatureFromTransaction,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from "@solana/kit";
import {
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstructionAsync,
  getTransferCheckedInstruction,
} from "@solana-program/token";
import { env } from "../env.js";
import { getFeePayer, getRpc, getRpcSubscriptions } from "./fee-payer.js";
import { getUSDCToIDRRate, idrFromUsdcLamports } from "./oracle.js";
import { supabaseAdmin } from "./supabase.js";

const WELCOME_BONUS_USDC_LAMPORTS = 5_000_000n; // 5 USDC * 10^6 (USDC has 6 decimals)
const WELCOME_BONUS_USER_CAP = 10;
const TREASURY_FLOOR_USDC_LAMPORTS = 50_000_000n; // 50 USDC

interface WelcomeBonusResult {
  ok: boolean;
  reason?: string;
  signature?: string;
}

export async function sendWelcomeBonus(
  internalUserId: string,
  userSolanaAddress: string,
): Promise<WelcomeBonusResult> {
  // Guard 1 — idempotency. Re-checks the column inside this fn so concurrent
  // /users/sync calls (rare but possible) don't double-send.
  const { data: userRow, error: selErr } = await supabaseAdmin
    .from("users")
    .select("welcome_bonus_sent_at")
    .eq("id", internalUserId)
    .maybeSingle();
  if (selErr) {
    console.error("[welcome-bonus] user lookup failed:", selErr);
    return { ok: false, reason: "user_lookup_failed" };
  }
  if (userRow?.welcome_bonus_sent_at) {
    return { ok: false, reason: "already_sent" };
  }

  // Guard 2 — global cap (10 users). Cheap query thanks to partial index.
  const { count: bonusCount, error: countErr } = await supabaseAdmin
    .from("users")
    .select("*", { count: "exact", head: true })
    .not("welcome_bonus_sent_at", "is", null);
  if (countErr) {
    console.error("[welcome-bonus] cap count failed:", countErr);
    return { ok: false, reason: "cap_query_failed" };
  }
  if ((bonusCount ?? 0) >= WELCOME_BONUS_USER_CAP) {
    console.log(
      `[welcome-bonus] cap reached (${bonusCount}/${WELCOME_BONUS_USER_CAP}) — skip user ${internalUserId}`,
    );
    return { ok: false, reason: "cap_reached" };
  }

  // Guard 3 — treasury balance floor.
  const rpc = getRpc();
  const treasuryAta = address(env.TREASURY_USDC_ATA);
  let treasuryLamports: bigint;
  try {
    const accountInfo = await rpc
      .getTokenAccountBalance(treasuryAta)
      .send();
    treasuryLamports = BigInt(accountInfo.value.amount);
  } catch (err) {
    console.error("[welcome-bonus] treasury balance check failed:", err);
    return { ok: false, reason: "treasury_balance_failed" };
  }
  if (treasuryLamports < TREASURY_FLOOR_USDC_LAMPORTS) {
    console.warn(
      `[welcome-bonus] treasury below floor (${treasuryLamports} < ${TREASURY_FLOOR_USDC_LAMPORTS}) — skip user ${internalUserId}`,
    );
    return { ok: false, reason: "treasury_low" };
  }

  // Build + submit transfer.
  let signature: string;
  try {
    signature = await buildAndSendBonusTx(userSolanaAddress);
  } catch (err) {
    console.error("[welcome-bonus] tx build/submit failed:", err);
    return { ok: false, reason: "tx_failed" };
  }

  // Persist: mark user + insert audit row. If either fails, the on-chain
  // transfer is already done — log + return ok=true so the user sees the
  // bonus in their wallet even if our DB is out of sync momentarily.
  const nowIso = new Date().toISOString();

  const { error: updErr } = await supabaseAdmin
    .from("users")
    .update({ welcome_bonus_sent_at: nowIso })
    .eq("id", internalUserId);
  if (updErr) {
    console.error(
      "[welcome-bonus] sent on-chain but failed to mark user:",
      updErr,
      { internalUserId, signature },
    );
  }

  // Capture USDC→IDR rate so the bonus row shows a real Rupiah estimate
  // in /history (otherwise Rp 0). Soft-fail: oracle outage → store 0.
  let rateStr = "0";
  try {
    rateStr = (await getUSDCToIDRRate()).rate;
  } catch (err) {
    console.warn(
      "[welcome-bonus] oracle rate fetch failed; audit row idr=0:",
      (err as Error).message,
    );
  }
  const { error: insErr } = await supabaseAdmin
    .from("transactions")
    .insert({
      user_id: internalUserId,
      // Quote/merchant sentinels — same pattern as deposits.
      quote_id: "00000000-0000-0000-0000-000000000000",
      type: "welcome_bonus" as const,
      status: "completed" as const,
      amount_idr: idrFromUsdcLamports(WELCOME_BONUS_USDC_LAMPORTS, rateStr),
      amount_usdc_lamports: Number(WELCOME_BONUS_USDC_LAMPORTS),
      app_fee_idr: 0,
      exchange_rate: rateStr,
      merchant_name: "Welcome Bonus (testing)",
      merchant_id: null,
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
    console.error("[welcome-bonus] tx record insert failed:", insErr, {
      internalUserId,
      signature,
    });
  }

  console.log(
    `[welcome-bonus] sent 5 USDC → ${userSolanaAddress} (${signature})`,
  );
  return { ok: true, signature };
}

async function buildAndSendBonusTx(userSolanaAddress: string): Promise<string> {
  const rpc = getRpc();
  const rpcSubs = getRpcSubscriptions();
  const treasury = await getFeePayer();
  const treasuryAta = address(env.TREASURY_USDC_ATA);
  const usdcMint = address(env.USDC_MINT);
  const userAddr = address(userSolanaAddress);

  // Derive user's USDC ATA. createAssociatedTokenIdempotent is safe to
  // include even if the ATA already exists.
  const [userAta] = await findAssociatedTokenPda({
    owner: userAddr,
    mint: usdcMint,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });

  const createAtaIx = await getCreateAssociatedTokenIdempotentInstructionAsync({
    payer: treasury,
    owner: userAddr,
    mint: usdcMint,
  });

  const transferIx = getTransferCheckedInstruction({
    source: treasuryAta,
    mint: usdcMint,
    destination: userAta,
    authority: treasury, // treasury IS the fee payer
    amount: WELCOME_BONUS_USDC_LAMPORTS,
    decimals: 6,
  });

  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(treasury, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
    (m) => appendTransactionMessageInstruction(createAtaIx, m),
    (m) => appendTransactionMessageInstruction(transferIx, m),
  );

  const signedTx = await signTransactionMessageWithSigners(message);
  const sendAndConfirm = sendAndConfirmTransactionFactory({
    rpc,
    rpcSubscriptions: rpcSubs,
  });
  // The lifetime is set explicitly via setTransactionMessageLifetimeUsingBlockhash
  // above, so the signed tx is guaranteed to be a blockhash-lifetime variant.
  // TS can't narrow the union after pipe(), hence the cast.
  await sendAndConfirm(
    signedTx as Parameters<typeof sendAndConfirm>[0],
    { commitment: "confirmed" },
  );

  return getSignatureFromTransaction(signedTx);
}
