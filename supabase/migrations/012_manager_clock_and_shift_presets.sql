-- =============================================================
-- 012_manager_clock_and_shift_presets.sql
--
-- Adds three things (all idempotent — safe to re-run):
--   1. rota_shifts.shift_type    — remembers which rota preset produced a shift
--      ('open_close' | 'evening_close'); null = custom times / day off / legacy.
--   2. allowed_users.fixed_monthly_wage — a manager's FIXED monthly salary. Shown
--      on the Live dashboard for monitoring; it never drives any pay calculation.
--   3. manager_clock_events      — clock in/out for MANAGERS. Managers are login
--      accounts (allowed_users, role='manager') with no employees row, so the
--      crew clock_events table (keyed on employee_id) can't hold their events.
--      This mirrors clock_events but is keyed on the login account.
--
-- Run this in the Supabase SQL Editor.
-- =============================================================

-- ---- 1. Rota preset label ----
alter table public.rota_shifts
  add column if not exists shift_type text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'rota_shifts_shift_type_check'
  ) then
    alter table public.rota_shifts
      add constraint rota_shifts_shift_type_check
      check (shift_type is null or shift_type in ('open_close','evening_close'));
  end if;
end $$;

-- ---- 2. Manager fixed monthly salary (display/monitoring only) ----
alter table public.allowed_users
  add column if not exists fixed_monthly_wage numeric(10,2);

-- ---- 3. Manager clock events ----
create table if not exists public.manager_clock_events (
  id            uuid primary key default gen_random_uuid(),
  manager_id    uuid not null references public.allowed_users(id) on delete cascade,
  store_id      uuid references public.stores(id) on delete set null,
  event_date    date not null,
  clock_in_at   timestamptz,
  clock_out_at  timestamptz,
  clock_in_lat  numeric(10,7),
  clock_in_lng  numeric(10,7),
  clock_out_lat numeric(10,7),
  clock_out_lng numeric(10,7),
  created_at    timestamptz not null default now(),
  unique (manager_id, event_date)
);

create index if not exists manager_clock_events_date_idx
  on public.manager_clock_events (event_date);
create index if not exists manager_clock_events_manager_idx
  on public.manager_clock_events (manager_id, event_date);

-- ---- 4. Helper: allowed_users.id of the current login ----
-- Parallels current_employee_id(); used by the RLS policies below so a manager
-- can only touch their own clock rows.
create or replace function public.current_allowed_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.allowed_users
  where lower(email) = lower(auth.jwt() ->> 'email')
  limit 1;
$$;

-- ---- 5. RLS: admin sees all; a manager sees/writes only their own row ----
alter table public.manager_clock_events enable row level security;

drop policy if exists "manager_clock_select" on public.manager_clock_events;
drop policy if exists "manager_clock_insert" on public.manager_clock_events;
drop policy if exists "manager_clock_update" on public.manager_clock_events;

create policy "manager_clock_select" on public.manager_clock_events
  for select to authenticated
  using (
    public.is_admin(auth.jwt() ->> 'email')
    or manager_id = public.current_allowed_user_id()
  );

create policy "manager_clock_insert" on public.manager_clock_events
  for insert to authenticated
  with check (manager_id = public.current_allowed_user_id());

create policy "manager_clock_update" on public.manager_clock_events
  for update to authenticated
  using (manager_id = public.current_allowed_user_id())
  with check (manager_id = public.current_allowed_user_id());

grant all on public.manager_clock_events to anon, authenticated, service_role;
