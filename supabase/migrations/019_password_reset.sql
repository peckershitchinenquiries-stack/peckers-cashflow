-- =============================================================
-- Migration 019 — Self-service password reset
--
-- Managers and employees sign in with a USERNAME, which maps to a synthetic
-- email (`<username>@staff.peckers-app.co.uk`, see lib/credentials.ts). That
-- address is not a real mailbox, so Supabase's built-in
-- `auth.resetPasswordForEmail` can never deliver anything to them — the only
-- recovery path today is an admin pressing "Reset password" and re-sharing a
-- generated one by hand.
--
-- This adds the two things a self-service flow needs:
--
--   1. `allowed_users.contact_email` — the staff member's REAL, reachable
--      address. Deliberately separate from `allowed_users.email` (the synthetic
--      login identity), which must stay untouched: it is what auth, the
--      middleware whitelist lookup and `employees.email` all key on.
--
--      It lives on allowed_users rather than employees because a manager has no
--      employees row, and because a single table is the only place a UNIQUE
--      constraint can span every account. Two accounts sharing one address would
--      make the reset lookup ambiguous (and would let either person reset the
--      other's password), so it is enforced unique across admins, managers and
--      crew alike.
--
--   2. `password_reset_tokens` — single-use, expiring, hashed reset tokens.
--
-- Run this in the Supabase SQL Editor (or via `supabase db push`). Idempotent.
-- =============================================================

-- ---- 1. contact_email -------------------------------------------------

alter table public.allowed_users
  add column if not exists contact_email text;

comment on column public.allowed_users.contact_email is
  'Real, reachable email used ONLY for password reset. Never a login identity — that is allowed_users.email (synthetic for managers/crew).';

-- Admins already sign in with a real email, so seed theirs. Managers/crew are
-- left null and collected at creation (or added later by the admin or by the
-- staff member on their own profile page).
update public.allowed_users
   set contact_email = lower(trim(email))
 where contact_email is null
   and role = 'admin'
   and email not like '%@staff.peckers-app.co.uk';

-- Case-insensitive uniqueness. Partial, so the many rows still without a
-- contact_email don't collide with each other on null.
create unique index if not exists allowed_users_contact_email_unique
  on public.allowed_users (lower(contact_email))
  where contact_email is not null;

-- ---- 2. password_reset_tokens ----------------------------------------

create table if not exists public.password_reset_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.allowed_users(id) on delete cascade,
  -- sha256 of the token we emailed. The raw token is never stored, so a leak of
  -- this table cannot be replayed to seize an account.
  token_hash   text not null unique,
  expires_at   timestamptz not null,
  used_at      timestamptz,
  -- Forensics only (who asked); never used for authorisation.
  requested_ip text,
  created_at   timestamptz not null default now()
);

-- Serves both the "spend this token" lookup and the per-user rate-limit count.
create index if not exists password_reset_tokens_user_idx
  on public.password_reset_tokens (user_id, created_at desc);
create index if not exists password_reset_tokens_expires_idx
  on public.password_reset_tokens (expires_at);

alter table public.password_reset_tokens enable row level security;

-- Intentionally NO policies. With RLS on and no policy, anon + authenticated can
-- read/write nothing at all. The service-role key bypasses RLS, and
-- app/actions/password-reset.ts is the only thing that ever touches this table.
--
-- The revoke matters: migration 006 set `alter default privileges ... grant all
-- on tables to anon, authenticated, service_role`, so this table is born with
-- public grants. RLS would still block it, but a table of account-recovery
-- tokens should not be reachable at the privilege layer either.
revoke all on public.password_reset_tokens from anon, authenticated;
grant all on public.password_reset_tokens to service_role;

-- Expired/used tokens are dead weight; they carry no secret (the hash is
-- one-way) but there is no reason to keep them. Safe to run any time.
delete from public.password_reset_tokens
 where expires_at < now() - interval '7 days';
