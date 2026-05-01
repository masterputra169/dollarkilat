-- ─────────────────────────────────────────────────────────────
-- 0003_transactions.sql — Day 7
-- Append-only audit log of every payment we sponsor + settle.
--
-- Status lifecycle:
--   created         → row inserted, before Solana submit
--   user_signing    → user signing pending (biometric mode only)
--   solana_pending  → submitted to RPC, awaiting confirmation
--   solana_confirmed→ Solana settled (treasury received USDC)
--   pjp_pending    → notified PJP partner, awaiting IDR settle
--   completed       → PJP confirmed IDR delivered to merchant
--   failed_settlement → PJP failed; manual reconciliation needed
--   rejected        → validation failed before submit (whitelist, balance, etc)
--
-- We never UPDATE history rows in-place — each lifecycle change is just an
-- updated_at bump + status change. A separate events table can be added
-- later for full audit trail if needed.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete restrict,

  -- The QRIS quote that led to this tx (FK soft — quotes are in-memory)
  quote_id uuid not null,

  -- Type discriminator. Day 7 only inserts 'qris_payment' rows; future
  -- types include 'deposit' (incoming USDC notification).
  type text not null check (type in ('qris_payment', 'deposit')),

  -- Lifecycle
  status text not null check (status in (
    'created',
    'user_signing',
    'solana_pending',
    'solana_confirmed',
    'pjp_pending',
    'completed',
    'failed_settlement',
    'rejected'
  )),

  -- Money
  amount_idr bigint not null,
  amount_usdc_lamports bigint not null,
  app_fee_idr bigint not null,
  exchange_rate text not null,

  -- Counterparty / merchant
  merchant_name text not null,
  merchant_id text,
  acquirer text,

  -- Solana settlement layer
  signature text unique,             -- base58, 88 chars; null until submitted
  fee_payer_pubkey text not null,    -- which fee payer wallet sponsored

  -- PJP partner settlement layer
  pjp_partner text not null check (pjp_partner in ('mock', 'doku', 'flip')),
  pjp_id text,                       -- partner-side identifier
  pjp_settled_at timestamptz,

  -- Failure forensics
  failure_reason text,

  -- Audit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists transactions_user_id_idx
  on public.transactions (user_id, created_at desc);

create index if not exists transactions_status_idx
  on public.transactions (status)
  where status in ('solana_pending', 'pjp_pending');

create index if not exists transactions_signature_idx
  on public.transactions (signature)
  where signature is not null;

-- RLS lock — backend service role only.
alter table public.transactions enable row level security;

-- Auto-bump updated_at (reuses fn from 0001).
drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at
  before update on public.transactions
  for each row
  execute function public.set_updated_at();

comment on table public.transactions is
  'dollarkilat — payment audit log. Append-mostly; status transitions via UPDATE.';
comment on column public.transactions.signature is
  'Solana tx signature (base58). NULL while awaiting submit, unique once set.';
comment on column public.transactions.fee_payer_pubkey is
  'Records which fee payer wallet sponsored — useful for cost accounting and rotating keys.';
