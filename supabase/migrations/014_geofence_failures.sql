-- =============================================================
-- 014_geofence_failures.sql
--
-- Persists failed clock-in/out geofence checks (reported position, accuracy,
-- nearest store, distance vs radius). Today a failed attempt only produces a
-- console.error in the server logs — nothing survives it, so a "why couldn't
-- I clock in yesterday" question can't be answered after the fact. This table
-- gives the admin a real record to check instead of guessing.
--
-- Run this in the Supabase SQL Editor.
-- =============================================================

create table if not exists public.geofence_failures (
  id                  uuid primary key default gen_random_uuid(),
  occurred_at         timestamptz not null default now(),
  actor_email         text not null,
  employee_id         uuid references public.employees(id) on delete set null,
  manager_id          uuid references public.allowed_users(id) on delete set null,
  action              text not null check (action in ('clock_in','clock_out')),
  attempted_lat       numeric(10,7) not null,
  attempted_lng       numeric(10,7) not null,
  accuracy_m          numeric(10,2),
  nearest_store_id    uuid references public.stores(id) on delete set null,
  -- Snapshot of the store name at the time, so the row still reads clearly
  -- even if the store is later renamed or removed.
  nearest_store_name  text,
  distance_m          numeric(10,2) not null,
  radius_m            integer not null,
  message             text not null
);

create index if not exists geofence_failures_occurred_idx on public.geofence_failures (occurred_at desc);
create index if not exists geofence_failures_employee_idx on public.geofence_failures (employee_id);
create index if not exists geofence_failures_manager_idx  on public.geofence_failures (manager_id);

alter table public.geofence_failures enable row level security;

drop policy if exists "geofence_failures_select" on public.geofence_failures;
drop policy if exists "geofence_failures_insert" on public.geofence_failures;

-- Staff (admin/manager) can review; any allowed user can write their own
-- failed attempt (mirrors audit_log — the crew member logs their own record).
create policy "geofence_failures_select" on public.geofence_failures
  for select to authenticated
  using (public.is_staff());

create policy "geofence_failures_insert" on public.geofence_failures
  for insert to authenticated
  with check (public.is_allowed(auth.jwt() ->> 'email'));

grant all on public.geofence_failures to anon, authenticated, service_role;
