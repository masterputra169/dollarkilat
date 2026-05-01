-- ─────────────────────────────────────────────────────────────
-- 0004_merchants.sql — Path B (Day 7.5)
-- Merchant role — a user can claim a merchant identity (NMID) so when
-- a QRIS with that NMID is paid, the merchant dashboard reflects the
-- incoming IDR (mock-settled) without external partner registration.
--
-- Design notes:
--   - 1 user can own multiple merchants (warung + cabang)
--   - NMID is unique global (only 1 user can claim a given NMID)
--   - No verification — hackathon scope. Production needs proof-of-ownership
--     via Bank Indonesia QRIS registry lookup.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.merchants (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  nmid text unique not null,
  city text,
  -- Verification flag — false until we run an ownership proof against
  -- Bank Indonesia QRIS registry (or equivalent partner verification).
  -- Hackathon scope: defaults to false; UI shows "Demo / unverified" badge.
  -- Production: a separate flow (e.g. SMS verify NMID-registered phone, or
  -- BI registry lookup) flips this to true.
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Defensive: if the table existed before this column was introduced
-- (early local migrations), add it idempotently.
alter table public.merchants
  add column if not exists is_verified boolean not null default false;

create index if not exists merchants_owner_user_id_idx
  on public.merchants (owner_user_id);

create index if not exists merchants_nmid_idx
  on public.merchants (nmid);

alter table public.merchants enable row level security;

drop trigger if exists merchants_set_updated_at on public.merchants;
create trigger merchants_set_updated_at
  before update on public.merchants
  for each row
  execute function public.set_updated_at();

comment on table public.merchants is
  'dollarkilat — merchant identity claimed by a user. Settled IDR (mock) routed by NMID match.';
comment on column public.merchants.nmid is
  'QRIS National Merchant ID. Globally unique. Production should verify against BI registry.';

-- ─────────────────────────────────────────────────────────────
-- Add merchant FK to transactions so the merchant dashboard can query
-- "transactions where merchant_db_id = X". Distinct from the existing
-- text column `merchant_id` which holds the QRIS NMID (free-form string,
-- comes straight from the decoded QR). The two coexist:
--   - merchant_id     text  → NMID always, even when no DB match
--   - merchant_db_id  uuid  → FK to merchants table, only when claimed
-- ─────────────────────────────────────────────────────────────

alter table public.transactions
  add column if not exists merchant_db_id uuid
    references public.merchants(id) on delete set null;

create index if not exists transactions_merchant_db_id_idx
  on public.transactions (merchant_db_id, created_at desc)
  where merchant_db_id is not null;

comment on column public.transactions.merchant_db_id is
  'FK to merchants.id when the QRIS NMID matched a claimed merchant. Drives merchant dashboard income view.';
