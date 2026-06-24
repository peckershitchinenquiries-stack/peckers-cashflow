-- =============================================================
-- Migration 007 — Cover driver records
-- "Cover drivers" are part-time, non-permanent staff hired ad-hoc for a busy
-- day (they are NOT rows in `employees`). The manager records each one-off
-- payment by hand: driver name, hours worked, hourly rate, and the resulting
-- total pay. Stored per store so it shows for the store's managers and admins.
-- Run this in the Supabase SQL editor (or via `supabase db push`).
-- =============================================================

create table if not exists public.cover_driver_records (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references public.stores(id) on delete cascade,
  driver_name     text not null,
  work_date       date not null,
  hours_worked    numeric(6,2) not null default 0,
  hourly_rate     numeric(8,2) not null default 0,
  -- Always hours_worked * hourly_rate; computed in the DB so it can never drift.
  total_pay       numeric(12,2) generated always as (hours_worked * hourly_rate) stored,
  created_by      uuid references auth.users(id) on delete set null,
  created_by_name text,
  created_at      timestamptz not null default now()
);

create index if not exists cover_driver_records_store_date_idx
  on public.cover_driver_records (store_id, work_date desc);

alter table public.cover_driver_records enable row level security;

drop policy if exists "cover_driver_select" on public.cover_driver_records;
drop policy if exists "cover_driver_modify" on public.cover_driver_records;

-- Staff only; managers are scoped to their own store, admins see every store.
create policy "cover_driver_select" on public.cover_driver_records
  for select to authenticated
  using (public.can_access_store(store_id));

create policy "cover_driver_modify" on public.cover_driver_records
  for all to authenticated
  using (public.can_access_store(store_id))
  with check (public.can_access_store(store_id));

grant select, insert, update, delete on public.cover_driver_records to authenticated;
