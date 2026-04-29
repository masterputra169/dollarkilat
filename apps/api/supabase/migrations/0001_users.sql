-- ─────────────────────────────────────────────────────────────
-- 0001_users.sql — Day 2
-- Run di Supabase SQL Editor (Dashboard → SQL Editor → New query).
--
-- Dependency: extension `pgcrypto` (untuk gen_random_uuid). Sudah enabled
-- by default di Supabase.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  privy_id text unique not null,
  email text,
  solana_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_privy_id_idx on public.users (privy_id);
create index if not exists users_solana_address_idx on public.users (solana_address);

-- RLS: backend uses service role (bypasses RLS). Frontend uses anon key
-- and should NEVER read/write users directly — that's the API's job. So
-- enable RLS with no permissive policies = nothing accessible from anon.
alter table public.users enable row level security;

-- Auto-bump updated_at on every UPDATE. Backend also sends an explicit
-- updated_at on upsert, but this is a safety net.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
  before update on public.users
  for each row
  execute function public.set_updated_at();

comment on table public.users is 'dollarkilat — Privy-authenticated users. privy_id is the canonical identity.';
comment on column public.users.privy_id is 'Privy DID, e.g. did:privy:cm123abc...';
comment on column public.users.solana_address is 'Embedded Solana wallet address from Privy (created on first login).';
