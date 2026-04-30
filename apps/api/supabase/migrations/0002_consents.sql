-- ─────────────────────────────────────────────────────────────
-- 0002_consents.sql — Day 4
-- delegated_actions_consents — track which users have authorized
-- backend-side signing via Privy delegated actions, with policy.
--
-- One row per (user, consented_at). Latest non-revoked, non-expired
-- row wins. We keep history (no UPDATE) so audit + revocation events
-- are immutable.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.delegated_actions_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  enabled boolean not null default true,
  -- Policy bounds (IDR). NULL = no limit at this layer (still bounded
  -- by Privy server-side policy). Backend enforces both.
  max_per_tx_idr bigint,
  max_per_day_idr bigint,
  -- Lifecycle
  consented_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  -- Free-form metadata (e.g. user agent, ip-hash) for fraud forensics later
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists consents_user_id_idx
  on public.delegated_actions_consents (user_id);

-- "Active consent" lookup hot path: latest row that's enabled, not revoked,
-- not expired. Partial index drops the dead rows from the hot path.
create index if not exists consents_active_idx
  on public.delegated_actions_consents (user_id, consented_at desc)
  where revoked_at is null;

-- RLS: backend-only via service role. Anon key has no policy → no access.
alter table public.delegated_actions_consents enable row level security;

comment on table public.delegated_actions_consents is
  'dollarkilat — Privy delegated-actions consent log. Append-only; revoke = set revoked_at.';
comment on column public.delegated_actions_consents.max_per_tx_idr is
  'Per-transaction IDR cap. Anything above triggers biometric mode regardless.';
comment on column public.delegated_actions_consents.max_per_day_idr is
  'Per-day IDR cap. Backend sums today completed tx and rejects if exceeded.';
