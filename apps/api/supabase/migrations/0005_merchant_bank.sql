-- ─────────────────────────────────────────────────────────────
-- 0005_merchant_bank.sql — Day 7.5 (Flip integration prep)
--
-- Add bank routing info to merchants. Required when PJP_PARTNER=flip
-- because Flip Bisnis disburses to bank accounts (or QRIS NMID via the
-- "qris" bank_code on supported tiers).
--
-- Optional fields → backwards-compatible. Mock PJP path still works for
-- merchants without bank info populated. Flip path will reject merchants
-- missing bank fields with a clear error.
--
-- Codes follow Flip's bank list (see GET /general/banks):
--   bca, mandiri, bni, bri, cimb_niaga, permata, bsi, ...
--   qris (kalau merchant tier support payout to NMID)
-- ─────────────────────────────────────────────────────────────

alter table public.merchants
  add column if not exists bank_code text,
  add column if not exists account_number text,
  add column if not exists account_holder text;

comment on column public.merchants.bank_code is
  'Flip bank code (e.g. "bca", "mandiri") OR "qris" for QRIS payout (tier-dependent).';
comment on column public.merchants.account_number is
  'Bank account number, or QRIS NMID if bank_code = "qris".';
comment on column public.merchants.account_holder is
  'Account holder name. Some banks require exact match for disbursement to settle.';
