-- =============================================================
-- Migration 020 — Multi-store managers (active-store switching)
--
-- Managers were hard-locked to their single assigned store
-- (allowed_users.store_id). This adds an OPTIONAL `active_store_id`: the store
-- a manager is currently operating as. When a manager "switches store" in the
-- app, we set this column; the whole app (and RLS) then treats them as running
-- that store instead of their home one. It defaults to null → falls back to the
-- home store, so existing managers are unaffected until they switch.
--
--   home store    = allowed_users.store_id      (their base; where they belong)
--   active store  = allowed_users.active_store_id ?? store_id  (where they act)
--
-- The single lever is current_user_store_id(): redefining it to return the
-- active store automatically re-scopes EVERY RLS policy built on
-- can_access_store() (daily_cash_entries, cash_payouts, cash_payout_lines), so
-- a switched manager can read/write the covered store's cash data with no other
-- policy change. Admins are unaffected (they bypass via is_admin); employees
-- never get an active_store_id so coalesce() returns their store_id unchanged.
--
-- Run this in the Supabase SQL Editor (or via `supabase db push`). Idempotent.
-- =============================================================

alter table public.allowed_users
  add column if not exists active_store_id uuid references public.stores(id) on delete set null;

comment on column public.allowed_users.active_store_id is
  'The store a manager is currently operating as (multi-store switching). Null = use home store (store_id). Only meaningful for role=manager.';

-- Redefine the scoping helper to prefer the active store, falling back to home.
-- SECURITY DEFINER + stable, same as before — only the SELECT expression changes.
create or replace function public.current_user_store_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(active_store_id, store_id) from public.allowed_users
  where lower(email) = lower(auth.jwt() ->> 'email')
  limit 1;
$$;
