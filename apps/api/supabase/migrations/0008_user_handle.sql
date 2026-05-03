-- ─────────────────────────────────────────────────────────────
-- 0008_user_handle.sql — Day 11
-- @handle (username) for receive-by-handle UX. Users can claim a unique
-- @handle so they can share "@sarah" with clients instead of a long
-- Solana address. Frontend resolves handle → wallet via GET
-- /users/by-handle/:handle.
--
-- Constraints:
--   - 3-20 chars, lowercase a-z + digits + underscore
--   - Globally unique (case-insensitive, but stored lowercase always)
--   - Optional (NULL until claimed)
--   - Releasable (UPDATE SET handle = NULL)
-- ─────────────────────────────────────────────────────────────

alter table public.users
  add column if not exists handle text;

-- Validation: only allow [a-z0-9_]{3,20}. NULL is allowed.
-- IF NOT EXISTS is not a thing for CHECK constraints in Postgres, so wrap
-- in a DO block that swallows the duplicate-constraint error to stay
-- idempotent across re-runs.
do $$
begin
  alter table public.users
    add constraint users_handle_format
    check (handle is null or handle ~ '^[a-z0-9_]{3,20}$');
exception
  when duplicate_object then null;
end $$;

-- Unique constraint (case-sensitive — but we always store lowercase, so
-- effectively case-insensitive at the application layer).
create unique index if not exists users_handle_unique_idx
  on public.users (handle)
  where handle is not null;

comment on column public.users.handle is
  '@handle for receive UX. Lowercase a-z + 0-9 + underscore, 3-20 chars. Globally unique. NULL until claimed.';
