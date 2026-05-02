-- ─────────────────────────────────────────────────────────────
-- 0007_welcome_bonus_and_tax.sql — Day 10
-- Two new revenue/incentive mechanisms:
--   1. Welcome bonus — first 10 new users get 5 USDC from treasury
--   2. Deposit tax — 0.2% of every incoming USDC deposit goes to treasury
--      (real-time on-chain transfer for One-Tap users)
-- Plus payment tax 0.5% which already exists via app_fee_idr (no DB change).
-- ─────────────────────────────────────────────────────────────

-- 1. Welcome bonus tracking on users table.
-- NULL = never received. Timestamp = received once (idempotent guard).
alter table public.users
  add column if not exists welcome_bonus_sent_at timestamptz;

comment on column public.users.welcome_bonus_sent_at is
  'When the user received their 5 USDC welcome bonus (testing-phase incentive).
   NULL until the bonus is sent. Cap of 10 users enforced in app code.';

-- Index for "count users who got bonus" query (used to enforce 10-user cap).
-- Partial index — only rows with bonus, the rest are excluded for compactness.
create index if not exists users_welcome_bonus_idx
  on public.users (welcome_bonus_sent_at)
  where welcome_bonus_sent_at is not null;

-- 2. Extend transactions.type constraint with two new types:
--    - welcome_bonus  → 5 USDC outgoing from treasury → user
--    - deposit_tax    → 0.2% USDC outgoing from user → treasury
-- Both rows are recorded for audit + UI display.
alter table public.transactions
  drop constraint if exists transactions_type_check;
alter table public.transactions
  add constraint transactions_type_check
  check (type in ('qris_payment', 'deposit', 'welcome_bonus', 'deposit_tax'));

-- Index for "user's recent tax transactions" query (used by dashboard
-- "Pajak terkumpul hari ini" widget — see Day 10 build plan).
create index if not exists transactions_user_tax_idx
  on public.transactions (user_id, created_at desc)
  where type in ('welcome_bonus', 'deposit_tax');

comment on constraint transactions_type_check on public.transactions is
  'qris_payment = user→merchant. deposit = external→user. welcome_bonus =
   treasury→user (one-time signup bonus, capped at 10 users for devnet test).
   deposit_tax = user→treasury (0.2% real-time skim on every incoming deposit).';
