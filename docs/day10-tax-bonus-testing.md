# Day 10 — Welcome Bonus + Tax Testing (devnet)

## Pre-flight

1. **Apply migration 0007** to Supabase:
   - Open Supabase Dashboard → SQL Editor → New query
   - Paste contents of `apps/api/supabase/migrations/0007_welcome_bonus_and_tax.sql`
   - Run. Should show "Success. No rows returned."
   - Verify: `SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='welcome_bonus_sent_at';` returns 1 row.

2. **Treasury must be funded** (≥ 50 USDC on devnet):
   ```bash
   # Check current balance
   curl -s -X POST $HELIUS_RPC_URL \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"getTokenAccountBalance","params":["<TREASURY_USDC_ATA>"]}'
   ```
   If < 50 USDC, transfer in from a devnet faucet wallet:
   - Devnet USDC mint: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`
   - Faucet: https://spl-token-faucet.com/?token-name=USDC-Dev (mint to fee-payer wallet, then it auto-routes to treasury ATA)

3. **PRIVY_AUTHORIZATION_KEY** (only needed for deposit tax):
   - Privy Dashboard → Authorization keys → Create one
   - Copy the **private** key
   - Set in `apps/api/.env.local`:
     ```
     PRIVY_AUTHORIZATION_KEY=<private_key_here>
     PRIVY_AUTHORIZATION_KEY_ID=<existing_id>
     ```
   - Restart API server
   - **NOTE:** Without this, deposit tax is silently skipped (logged). Welcome bonus + payment tax 0.5% still work.

---

## Test A — Welcome bonus (5 USDC to first 10 new users)

**Setup:** treasury balance ≥ 50 USDC.

**Test:**
1. Sign up with a fresh email (not previously registered) at `https://dollarkilat.xyz`
2. Complete onboarding → land on `/dashboard`
3. Wait ~3-5 seconds for balance to refresh
4. **Expected:** USDC balance shows **5.00 USDC**
5. Check API logs (Railway dashboard or local terminal):
   ```
   [welcome-bonus] sent 5 USDC → <wallet_address> (<signature>)
   ```
6. Check Solana Explorer with the signature:
   ```
   https://explorer.solana.com/tx/<signature>?cluster=devnet
   ```
   Should show TransferChecked of 5,000,000 USDC lamports from treasury → user ATA

**Verify idempotency:**
1. Logout, login again with same email
2. **Expected:** Balance does NOT increase (still 5.00 USDC)
3. API log: `[welcome-bonus] reason=already_sent` (debug level)

**Verify cap (10 users):**
1. Run signup 10 times with different emails. Each gets 5 USDC.
2. 11th signup: balance stays at 0.
3. API log: `[welcome-bonus] cap reached (10/10) — skip user <id>`

**Verify treasury floor:**
1. Manually drain treasury to < 50 USDC
2. New signup: no bonus given
3. API log: `[welcome-bonus] treasury below floor — skip`

---

## Test B — Payment tax 0.5% (already in app_fee_idr)

**Setup:** user has ≥ 1 USDC, active One-Tap consent.

**Test:**
1. Generate test QRIS (from root):
   ```bash
   npm run qris:gen -- --nmid ID2024TESTFLIP01 --merchant "Toko Demo" --amount 50000
   ```
2. Paste QRIS string into `/pay` → Manual mode
3. Preview shows breakdown:
   - **Jumlah dibayar:** Rp 50.000
   - **Fee aplikasi:** ~ 0.5% (Rp 250)
   - **USDC dipotong:** ~ 3.27 USDC (depends on rate, includes fee)
4. Sign + pay
5. **Verify in Supabase:**
   ```sql
   SELECT amount_idr, app_fee_idr, app_fee_idr * 1.0 / amount_idr AS fee_pct
   FROM transactions ORDER BY created_at DESC LIMIT 1;
   ```
   `fee_pct` should be ~0.005 (0.5%)

---

## Test C — Deposit tax 0.2% (real-time)

**Requires:** `PRIVY_AUTHORIZATION_KEY` configured (see pre-flight #3) AND
the user must have actively added the corresponding signer ID via the
onboarding consent flow.

**Status:** **FULLY IMPLEMENTED** — uses `@privy-io/server-auth` 1.32.5+
`walletApi.solana.signTransaction(...)` to sign on user's behalf via their
session signer. Wire bytes pipeline: kit builds + partial-signs (fee-payer)
→ deserialize as web3.js VersionedTransaction → Privy adds user signature
→ submit + confirm via web3.js Connection.

If `PRIVY_AUTHORIZATION_KEY` env var is missing, every sweep logs:
```
[deposit-tax] PRIVY_AUTHORIZATION_KEY not configured — skipping.
```
and returns gracefully without affecting the deposit recording.

**Test:**
1. Send a USDC deposit to a test user's wallet (any amount > 50,000 lamports = 0.05 USDC)
2. Open `/dashboard` to trigger scan-deposits
3. Within ~5 seconds, API log should show:
   ```
   [deposit-tax] swept 200 lamports (0.2% of 100000) → treasury (<sig>)
   ```
4. Verify treasury USDC balance increased by the tax amount
5. Verify `transactions` table has new row: `type='deposit_tax'`, `amount_usdc_lamports=200`
6. Dashboard's "Aktivitas platform 24 jam" card shows `−0.0002 USDC pajak deposit (1 deposit)`

---

## Test D — UI tax indicator on dashboard

**Test (after Test A or C produces data):**
1. Open `/dashboard`
2. Scroll to below the action grid
3. **Expected card:** "Aktivitas platform 24 jam"
   - Shows welcome bonus row if user got one in last 24h: `+5 USDC welcome bonus diterima`
   - Shows tax row if any deposit_tax in last 24h: `−<amount> USDC pajak deposit (N deposit)`
4. Card hides entirely if both buckets are zero (no data noise)

**Verify caching:** Navigate away and back. Card renders instantly from
SWR cache (no skeleton).

---

## Quick smoke test (5 minutes)

```bash
# 1. Apply migration in Supabase SQL Editor
# 2. Restart API
# 3. Sign up fresh user → check 5 USDC arrives
# 4. Test payment with QRIS → verify fee_pct = 0.005
# 5. Open dashboard → see "Aktivitas platform 24 jam" card
```

If all 4 pass → A, B, D are production-ready for devnet demo.
C also works end-to-end provided PRIVY_AUTHORIZATION_KEY is set + user
has registered the signer via /onboarding/consent.

---

## Rollback plan

If anything breaks:
1. Welcome bonus: comment out the `sendWelcomeBonus(...)` call in
   `apps/api/src/routes/users.ts` (just the fire-and-forget, leave the rest).
2. Deposit tax: comment out the `for (const d of newOnes)` block in
   `apps/api/src/routes/transactions.ts` scan-deposits handler.
3. UI: remove `<TaxSummaryCard />` line from
   `apps/web/app/(authed)/dashboard/page.tsx`.
4. Migration is additive — no rollback needed (column + constraint stay).
