-- ─────────────────────────────────────────────────────────────
-- 0006_deposit_support.sql — Day 8 (OPTIONAL — see note below)
-- Loosen NOT NULL constraints to support type='deposit' rows that
-- come from on-chain Helius polling (no quote, no fee payer, no PJP).
--
-- Existing 'qris_payment' rows stay valid — their NOT NULL fields
-- remain populated. New code paths just allow these columns to be NULL
-- when the row represents an inbound USDC transfer detected on-chain.
--
-- ⚠️  OPTIONAL — code uses sentinel values for these fields when the
-- migration isn't applied (see routes/transactions.ts scan-deposits).
-- Apply this migration to clean up NULLs vs sentinels. Idempotent.
-- ─────────────────────────────────────────────────────────────

-- quote_id: deposits have no quote
alter table public.transactions
  alter column quote_id drop not null;

-- fee_payer_pubkey: deposits use external fee (sender pays)
alter table public.transactions
  alter column fee_payer_pubkey drop not null;

-- exchange_rate: optional snapshot at deposit time
alter table public.transactions
  alter column exchange_rate drop not null;

-- app_fee_idr: deposits have no app fee
alter table public.transactions
  alter column app_fee_idr drop not null;

-- amount_idr: optional for deposits (we may not snapshot rate)
alter table public.transactions
  alter column amount_idr drop not null;

-- merchant_name: optional for deposits
alter table public.transactions
  alter column merchant_name drop not null;

comment on column public.transactions.quote_id is
  'NULL for type=deposit (inbound USDC, no quote). Set for qris_payment.';
comment on column public.transactions.fee_payer_pubkey is
  'NULL for type=deposit (sender pays Solana fee externally). Set for qris_payment.';
comment on column public.transactions.merchant_name is
  'NULL for type=deposit. For qris_payment, the displayed merchant name from QRIS.';
