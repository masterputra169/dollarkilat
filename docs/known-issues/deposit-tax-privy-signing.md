# Known Issue — Deposit Tax: Privy Server-Side Signing Returns Unsigned Tx

**Status:** Active. Feature half-shipped (DB recording works, on-chain sweep blocked).
**Severity:** Medium (revenue feature, not user-blocking — deposits still record).
**First observed:** 2026-05-03 (Day 10 deployment).
**Affected commit at last attempt:** `06d8b92` (walletId path) → also failed.

---

## Symptom

When a USDC deposit lands in a user's wallet, the backend correctly:

1. Detects the deposit via Helius polling (`/transactions/scan-deposits`)
2. Records a `type='deposit'` row in the `transactions` table
3. Calculates 0.2% tax (e.g. 1 USDC → 2,000 lamports tax)
4. Builds a TransferChecked tx (user_ata → treasury_ata, signed by fee-payer locally)
5. Hands the partial-signed wire bytes to Privy `walletApi.solana.signTransaction(...)`
6. Receives a transaction back from Privy
7. Submits to Solana RPC — **simulation fails** with:

```
Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA failed:
missing required signature for instruction
```

The `transactions` table never gets a `type='deposit_tax'` row. The user's wallet shows the full deposit amount (e.g. 1 USDC), no tax deduction.

## What we ruled out

Confirmed via screenshots, debug endpoint output, and Privy Dashboard inspection:

- **Backend `PRIVY_AUTHORIZATION_KEY` env is correct** — set to the private key paired with `bjyipv845lblact8xtg9ee5a` (the `dollarkilat-backend-new` authorization key in Privy Dashboard).
- **Vercel `NEXT_PUBLIC_PRIVY_SIGNER_ID` env is correct** — set to the same `bjyipv845lblact8xtg9ee5a`.
- **The user's wallet is registered with the new key** — `dollarkilat-backend-new` Authorization page in Privy Dashboard shows `HSbhgNSMi1NJfMVWtVjW7BYCqUXWrunSRzPPyeqfoRmR` in its "Signer for: 3 wallets" list.
- **DB consent row is active** — `delegated_actions_consents` has `enabled=true`, `revoked_at=null` for the most recent row.
- **`/debug/wallet-info` returns `delegated: true`** for the wallet, confirming Privy considers it delegated.
- **Both `address` and `walletId` paths fail identically** — switched in commit `06d8b92`, same `privy_signature_missing` outcome.
- **Migration 0007 applied** — `welcome_bonus_sent_at` column present, `transactions_type_check` constraint includes `deposit_tax`.
- **Welcome bonus works** — uses fee-payer keypair directly, no Privy session signer involved. So the basic Solana plumbing is fine.

## Current hypothesis

Privy `walletApi.solana.signTransaction(...)` in `@privy-io/server-auth@1.32.5`:

- Receives the request
- Authorizes successfully (auth header check passes)
- Resolves the wallet
- **Returns the input transaction unmodified** — the user-signature slot remains zero-filled
- No error thrown, no warning logged on the SDK side

This matches behavior reported by the validation we added in commit `8553621`: the response object contains a `signedTransaction` field, but inspecting `signedTransaction.signatures[userSlot]` shows it's still all-zero.

The latest fix attempt (commit pending — noopSigner pattern + diagnostic logging) tries to ensure the message header reserves the user signature slot via `createNoopSigner(userAddr)` instead of passing the address as a plain `Address`. If even that fails, the conclusion is that **Privy SDK 1.32.5 has a server-side signing bug** that affects our specific configuration.

## Verification we still want

The next deploy adds a diagnostic log line:

```
[deposit-tax] partial-sign tx { numRequiredSignatures, signatureSlots, signers: [...] }
```

If `numRequiredSignatures: 2` and `signers[1].filled: false` after Privy returns, that's definitive proof the SDK is no-op'ing, not a tx structure issue.

## Last-resort plans (post-hackathon or if demo blocks on this)

### Plan A — Upgrade `@privy-io/server-auth` to latest

```bash
npm install @privy-io/server-auth@latest --workspace=@dollarkilat/api
npm install
```

Risk: API surface changes between versions. Need to verify `walletApi.solana.signTransaction` signature unchanged + retest.

If a newer version fixes the signing path, deposit tax works without code changes.

### Plan B — Implement Privy REST `raw_sign` endpoint directly

Skip the SDK and call Privy's REST API ourselves:

```
POST https://api.privy.io/v1/wallets/{wallet_id}/rpc
Headers:
  Authorization: Basic base64(PRIVY_APP_ID:PRIVY_APP_SECRET)
  privy-authorization-signature: <ECDSA(request_body, PRIVY_AUTHORIZATION_KEY)>
Body:
  {
    "method": "signTransaction",
    "caip2": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",  // devnet
    "params": { "transaction": "<base64_wire_bytes>" }
  }
```

Implementation steps:

1. Generate `privy-authorization-signature` header — ECDSA P-256 sign of the request body using the PRIVY_AUTHORIZATION_KEY (PKCS8). Privy publishes the exact signing scheme in their docs (search "authorization signature" on docs.privy.io).
2. Replace the SDK call in `signWithPrivySessionSigner` with `fetch(url, { method, headers, body })`.
3. Handle the response — same `{ signedTransaction: VersionedTransaction }` shape per the REST docs.

Risk: more code to maintain. Reward: bypasses the SDK bug entirely.

### Plan C — File a Privy support ticket

Reproduce locally with a minimal repro, send to Privy support with:

- SDK version (`@privy-io/server-auth@1.32.5`)
- Authorization key ID
- Wallet ID
- Sample partially-signed tx wire bytes
- Expected vs actual response

Privy team can debug the server-side signing path against the user's actual wallet config. Slow turnaround but most authoritative.

## Demo-day workaround

If neither Plan A nor B can be implemented before demo:

- **Frame in pitch:** "0.2% real-time deposit tax — production-ready, last-mile Privy integration in progress."
- **Show in app:** the dashboard `TaxSummaryCard` component already renders welcome bonus and deposit tax aggregates from the DB. Manually insert a `deposit_tax` row in Supabase to populate the card for screenshot purposes:

  ```sql
  INSERT INTO transactions (user_id, quote_id, type, status, amount_idr, amount_usdc_lamports, app_fee_idr, exchange_rate, merchant_name, signature, fee_payer_pubkey, pjp_partner)
  VALUES ((SELECT id FROM users WHERE solana_address='<wallet>'),
          '00000000-0000-0000-0000-000000000000',
          'deposit_tax', 'completed',
          0, 2000, 0, '0', 'Platform Tax (deposit)',
          'demo-row-not-on-chain',
          'treasury', 'mock');
  ```

  This populates the card for visual demo without on-chain tx.

- **Be honest** during Q&A if asked: "On-chain sweep currently blocked by an SDK bug we're working around."

## Reference

- Failing commit: `06d8b92` (walletId path)
- Validation commit: `8553621` (signature slot inspection)
- Welcome bonus parallel implementation (works fine): `apps/api/src/lib/welcome-bonus.ts`
- Privy SDK signing call: `apps/api/src/lib/deposit-tax.ts:signWithPrivySessionSigner`
- Debug endpoint: `apps/api/src/routes/debug.ts`
