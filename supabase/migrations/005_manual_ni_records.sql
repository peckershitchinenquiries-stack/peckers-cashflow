-- =============================================================
-- Migration 005 — Manual NI (monthly) records
-- Off-system NI lines added by hand on the NI Monthly Summary page (e.g. an
-- employee paid outside the rota, or a correction). Previously these lived only
-- in the browser and vanished on refresh; now they are persisted per store and
-- per calendar month so they sync across the admin and manager dashboards.
-- Run this in the Supabase SQL editor (or via `supabase db push`).
-- =============================================================

create table if not exists public.manual_ni_records (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references public.stores(id) on delete cascade,
  -- Calendar month the line belongs to, as YYYY-MM (matches the page grouping).
  month           text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  employee_name   text not null,
  ni_hours        numeric(8,2) not null default 0,
  ni_wages        numeric(10,2) not null default 0,
  created_by      uuid references auth.users(id) on delete set null,
  created_by_name text,
  created_at      timestamptz not null default now()
);

create index if not exists manual_ni_records_store_month_idx
  on public.manual_ni_records (store_id, month);

alter table public.manual_ni_records enable row level security;

drop policy if exists "manual_ni_select" on public.manual_ni_records;
drop policy if exists "manual_ni_modify" on public.manual_ni_records;

-- Staff only; managers are scoped to their own store, admins see every store.
-- "for all" covers select/insert/update/delete; the explicit select policy
-- keeps reads working even if a future change narrows the modify policy.
create policy "manual_ni_select" on public.manual_ni_records
  for select to authenticated
  using (public.can_access_store(store_id));

create policy "manual_ni_modify" on public.manual_ni_records
  for all to authenticated
  using (public.can_access_store(store_id))
  with check (public.can_access_store(store_id));

grant select, insert, update, delete on public.manual_ni_records to authenticated;
