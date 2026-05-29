-- =============================================================
-- PECKERS CASH FLOW MANAGEMENT SYSTEM
-- Complete database schema for Supabase
-- Run this entire file in the Supabase SQL Editor.
-- =============================================================

-- ---------- Extensions ----------
create extension if not exists "pgcrypto";

-- =============================================================
-- TABLE: allowed_users
-- Whitelist of emails permitted to log in.
-- =============================================================
create table if not exists public.allowed_users (
  id          uuid primary key default gen_random_uuid(),
  email       text unique not null,
  name        text,
  role        text not null default 'manager' check (role in ('admin','manager')),
  created_at  timestamptz not null default now()
);

create index if not exists allowed_users_email_idx on public.allowed_users (email);

-- =============================================================
-- TABLE: cash_entries
-- Daily cash sales and supermarket expenses logged by managers.
-- =============================================================
create table if not exists public.cash_entries (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid references auth.users(id) on delete set null,
  user_email            text,
  entry_date            date not null,
  cash_sales            numeric(10,2) not null default 0,
  supermarket_expenses  numeric(10,2) not null default 0,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- For deployments that already had cash_entries, ensure column exists.
alter table public.cash_entries
  add column if not exists user_email text;

-- One entry per user per day (upsert behaviour from app)
create unique index if not exists cash_entries_user_day_unique
  on public.cash_entries (user_id, entry_date);

create index if not exists cash_entries_date_idx on public.cash_entries (entry_date desc);

-- Trigger to keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_cash_entries_updated_at on public.cash_entries;
create trigger set_cash_entries_updated_at
  before update on public.cash_entries
  for each row execute function public.set_updated_at();

-- =============================================================
-- TABLE: employees
-- =============================================================
create table if not exists public.employees (
  id                        uuid primary key default gen_random_uuid(),
  name                      text not null,
  phone                     text,
  hourly_rate               numeric(8,2) not null,
  bank_weekly_hours_limit   integer not null default 20,
  is_active                 boolean not null default true,
  joined_date               date,
  notes                     text,
  created_at                timestamptz not null default now()
);

create index if not exists employees_active_idx on public.employees (is_active);

-- =============================================================
-- TABLE: employee_hours
-- Weekly hours per employee. Computed columns are calculated in
-- the app layer and surfaced via the view below.
-- =============================================================
create table if not exists public.employee_hours (
  id                     uuid primary key default gen_random_uuid(),
  employee_id            uuid not null references public.employees(id) on delete cascade,
  week_start_date        date not null,
  total_hours_worked     numeric(5,2) not null,
  hourly_rate_snapshot   numeric(8,2) not null,
  notes                  text,
  logged_by              uuid references auth.users(id) on delete set null,
  created_at             timestamptz not null default now()
);

create unique index if not exists employee_hours_unique
  on public.employee_hours (employee_id, week_start_date);

create index if not exists employee_hours_week_idx on public.employee_hours (week_start_date desc);

-- =============================================================
-- VIEW: employee_hours_computed
-- Adds bank_hours, cash_hours, cash_amount_due.
-- =============================================================
create or replace view public.employee_hours_computed as
select
  eh.id,
  eh.employee_id,
  e.name                                         as employee_name,
  e.phone                                        as employee_phone,
  eh.week_start_date,
  eh.total_hours_worked,
  least(eh.total_hours_worked, 20)               as bank_hours,
  greatest(eh.total_hours_worked - 20, 0)        as cash_hours,
  greatest(eh.total_hours_worked - 20, 0)
    * eh.hourly_rate_snapshot                    as cash_amount_due,
  eh.hourly_rate_snapshot,
  eh.notes,
  eh.logged_by,
  eh.created_at
from public.employee_hours eh
join public.employees e on e.id = eh.employee_id;

-- =============================================================
-- HELPER: is_allowed(email)
-- =============================================================
create or replace function public.is_allowed(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.allowed_users
    where lower(email) = lower(p_email)
  );
$$;

create or replace function public.is_admin(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.allowed_users
    where lower(email) = lower(p_email) and role = 'admin'
  );
$$;

-- =============================================================
-- ROW LEVEL SECURITY
-- =============================================================
alter table public.allowed_users  enable row level security;
alter table public.cash_entries   enable row level security;
alter table public.employees      enable row level security;
alter table public.employee_hours enable row level security;

-- Drop existing policies to keep this file rerunnable
drop policy if exists "allowed_users_select"        on public.allowed_users;
drop policy if exists "allowed_users_admin_modify"  on public.allowed_users;
drop policy if exists "cash_entries_select"         on public.cash_entries;
drop policy if exists "cash_entries_insert"         on public.cash_entries;
drop policy if exists "cash_entries_update"         on public.cash_entries;
drop policy if exists "cash_entries_delete"         on public.cash_entries;
drop policy if exists "employees_select"            on public.employees;
drop policy if exists "employees_modify"            on public.employees;
drop policy if exists "employee_hours_select"       on public.employee_hours;
drop policy if exists "employee_hours_modify"       on public.employee_hours;

-- ----- allowed_users -----
-- Everyone authenticated and allowed can read the whitelist.
create policy "allowed_users_select" on public.allowed_users
  for select to authenticated
  using (public.is_allowed(auth.jwt() ->> 'email'));

-- Only admins can insert/update/delete the whitelist.
create policy "allowed_users_admin_modify" on public.allowed_users
  for all to authenticated
  using (public.is_admin(auth.jwt() ->> 'email'))
  with check (public.is_admin(auth.jwt() ->> 'email'));

-- ----- cash_entries -----
create policy "cash_entries_select" on public.cash_entries
  for select to authenticated
  using (public.is_allowed(auth.jwt() ->> 'email'));

create policy "cash_entries_insert" on public.cash_entries
  for insert to authenticated
  with check (
    public.is_allowed(auth.jwt() ->> 'email')
    and (user_id = auth.uid() or user_id is null)
  );

create policy "cash_entries_update" on public.cash_entries
  for update to authenticated
  using (
    public.is_allowed(auth.jwt() ->> 'email')
    and (user_id = auth.uid() or public.is_admin(auth.jwt() ->> 'email'))
  )
  with check (
    public.is_allowed(auth.jwt() ->> 'email')
  );

create policy "cash_entries_delete" on public.cash_entries
  for delete to authenticated
  using (
    public.is_allowed(auth.jwt() ->> 'email')
    and (user_id = auth.uid() or public.is_admin(auth.jwt() ->> 'email'))
  );

-- ----- employees -----
create policy "employees_select" on public.employees
  for select to authenticated
  using (public.is_allowed(auth.jwt() ->> 'email'));

create policy "employees_modify" on public.employees
  for all to authenticated
  using (public.is_allowed(auth.jwt() ->> 'email'))
  with check (public.is_allowed(auth.jwt() ->> 'email'));

-- ----- employee_hours -----
create policy "employee_hours_select" on public.employee_hours
  for select to authenticated
  using (public.is_allowed(auth.jwt() ->> 'email'));

create policy "employee_hours_modify" on public.employee_hours
  for all to authenticated
  using (public.is_allowed(auth.jwt() ->> 'email'))
  with check (public.is_allowed(auth.jwt() ->> 'email'));

-- =============================================================
-- VIEW PERMISSIONS
-- =============================================================
grant select on public.employee_hours_computed to authenticated;

-- =============================================================
-- =============================================================
-- STAGE 1: ROTA & WORKFORCE MANAGEMENT
-- =============================================================
-- =============================================================

-- =============================================================
-- TABLE: stores
-- =============================================================
create table if not exists public.stores (
  id                  uuid primary key default gen_random_uuid(),
  code                text unique not null,
  name                text not null,
  latitude            numeric(10,7),
  longitude           numeric(10,7),
  geofence_radius_m   integer not null default 250,
  created_at          timestamptz not null default now()
);

insert into public.stores (code, name, latitude, longitude, geofence_radius_m)
values
  ('stevenage', 'Stevenage Peckers', 51.9036, -0.2014, 250),
  ('hitchin',   'Hitchin Peckers',   51.9498, -0.2830, 250)
on conflict (code) do nothing;

-- =============================================================
-- EXTEND allowed_users with store assignment + super_admin role
-- =============================================================
alter table public.allowed_users
  drop constraint if exists allowed_users_role_check;
alter table public.allowed_users
  add constraint allowed_users_role_check
  check (role in ('admin','manager','super_admin'));

alter table public.allowed_users
  add column if not exists store_id uuid references public.stores(id) on delete set null;

-- =============================================================
-- EXTEND employees with full Stage 1 profile
-- =============================================================
alter table public.employees
  add column if not exists date_of_birth        date,
  add column if not exists gender               text,
  add column if not exists position             text,
  add column if not exists employment_start_date date,
  add column if not exists hourly_ni_rate       numeric(8,2),
  add column if not exists hourly_cash_rate     numeric(8,2),
  add column if not exists store_id             uuid references public.stores(id) on delete set null,
  add column if not exists bank_account_name    text,
  add column if not exists bank_name            text,
  add column if not exists account_number       text,
  add column if not exists sort_code            text,
  add column if not exists employment_status    text not null default 'active'
    check (employment_status in ('active','inactive','left')),
  add column if not exists auth_user_id         uuid references auth.users(id) on delete set null,
  add column if not exists email                text;

-- Position dropdown values: Manager, KTM (Supervisor), Kitchen Team Member, Driver, Supervisor

create index if not exists employees_store_idx on public.employees (store_id);
create index if not exists employees_status_idx on public.employees (employment_status);
create unique index if not exists employees_email_unique on public.employees (lower(email)) where email is not null;

-- =============================================================
-- TABLE: rota_shifts
-- One row per employee per day. Day off, scheduled times, manager notes.
-- =============================================================
create table if not exists public.rota_shifts (
  id                  uuid primary key default gen_random_uuid(),
  employee_id         uuid not null references public.employees(id) on delete cascade,
  store_id            uuid not null references public.stores(id) on delete cascade,
  shift_date          date not null,
  start_time          time,
  end_time            time,
  is_day_off          boolean not null default false,
  scheduled_hours     numeric(5,2) not null default 0,
  manager_notes       text,
  same_day_edit_reason text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid references auth.users(id) on delete set null,
  updated_by          uuid references auth.users(id) on delete set null
);

create unique index if not exists rota_shifts_unique on public.rota_shifts (employee_id, shift_date);
create index if not exists rota_shifts_date_idx on public.rota_shifts (shift_date);
create index if not exists rota_shifts_store_date_idx on public.rota_shifts (store_id, shift_date);

drop trigger if exists set_rota_shifts_updated_at on public.rota_shifts;
create trigger set_rota_shifts_updated_at
  before update on public.rota_shifts
  for each row execute function public.set_updated_at();

-- =============================================================
-- TABLE: clock_events
-- Crew clock-in / clock-out records with geofence captured location.
-- =============================================================
create table if not exists public.clock_events (
  id                  uuid primary key default gen_random_uuid(),
  employee_id         uuid not null references public.employees(id) on delete cascade,
  shift_id            uuid references public.rota_shifts(id) on delete set null,
  store_id            uuid not null references public.stores(id) on delete cascade,
  event_date          date not null,
  clock_in_at         timestamptz,
  clock_out_at        timestamptz,
  clock_in_lat        numeric(10,7),
  clock_in_lng        numeric(10,7),
  clock_out_lat       numeric(10,7),
  clock_out_lng       numeric(10,7),
  deliveries_count    integer,
  created_at          timestamptz not null default now()
);

create unique index if not exists clock_events_unique on public.clock_events (employee_id, event_date);
create index if not exists clock_events_date_idx on public.clock_events (event_date);
create index if not exists clock_events_store_date_idx on public.clock_events (store_id, event_date);

-- =============================================================
-- TABLE: weekly_deliveries
-- 4-week-average delivery figures entered by manager + Vita Mojo cross-check.
-- =============================================================
create table if not exists public.weekly_deliveries (
  id                  uuid primary key default gen_random_uuid(),
  driver_id           uuid not null references public.employees(id) on delete cascade,
  store_id            uuid not null references public.stores(id) on delete cascade,
  week_start_date     date not null,
  manager_avg_4wk     numeric(8,2),
  vita_mojo_count     integer,
  notes               text,
  reason              text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index if not exists weekly_deliveries_unique on public.weekly_deliveries (driver_id, week_start_date);

drop trigger if exists set_weekly_deliveries_updated_at on public.weekly_deliveries;
create trigger set_weekly_deliveries_updated_at
  before update on public.weekly_deliveries
  for each row execute function public.set_updated_at();

-- =============================================================
-- TABLE: alerts
-- System-generated alerts visible on manager dashboard.
-- =============================================================
create table if not exists public.alerts (
  id                  uuid primary key default gen_random_uuid(),
  alert_type          text not null,
  severity            text not null default 'warning' check (severity in ('info','warning','critical')),
  store_id            uuid references public.stores(id) on delete set null,
  employee_id         uuid references public.employees(id) on delete set null,
  shift_id            uuid references public.rota_shifts(id) on delete set null,
  title               text not null,
  message             text not null,
  payload             jsonb,
  resolved            boolean not null default false,
  resolved_at         timestamptz,
  resolved_by         uuid references auth.users(id) on delete set null,
  resolution_note     text,
  created_at          timestamptz not null default now()
);

create index if not exists alerts_resolved_idx on public.alerts (resolved, created_at desc);
create index if not exists alerts_store_idx on public.alerts (store_id);
create index if not exists alerts_type_idx on public.alerts (alert_type);

-- Dedup of open alerts is handled in app code (app/actions/alerts.ts -> upsertAlert).
-- We can't use a partial unique index keyed on created_at::date because timestamptz->date
-- is STABLE (timezone-dependent), not IMMUTABLE, which Postgres requires for index expressions.

-- =============================================================
-- TABLE: audit_log
-- All changes to records, rates, rota shifts.
-- =============================================================
create table if not exists public.audit_log (
  id                  uuid primary key default gen_random_uuid(),
  actor_id            uuid references auth.users(id) on delete set null,
  actor_email         text,
  action              text not null,
  entity              text not null,
  entity_id           text,
  changes             jsonb,
  created_at          timestamptz not null default now()
);

create index if not exists audit_log_entity_idx on public.audit_log (entity, entity_id);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);

-- =============================================================
-- VIEW: employee_weekly_summary
-- For each employee + week_start, total scheduled hrs, total wages (NI + cash),
-- 4-week rolling average hours from prior weeks.
-- =============================================================
create or replace view public.employee_weekly_summary as
with weekly_rota as (
  select
    rs.employee_id,
    date_trunc('week', rs.shift_date)::date as week_start_date,
    sum(case when rs.is_day_off then 0 else rs.scheduled_hours end) as scheduled_hours
  from public.rota_shifts rs
  group by rs.employee_id, date_trunc('week', rs.shift_date)
),
weekly_actual as (
  select
    ce.employee_id,
    date_trunc('week', ce.event_date)::date as week_start_date,
    sum(
      case
        when ce.clock_in_at is not null and ce.clock_out_at is not null
        then extract(epoch from (ce.clock_out_at - ce.clock_in_at)) / 3600.0
        else 0
      end
    ) as actual_hours,
    sum(coalesce(ce.deliveries_count, 0)) as deliveries_total
  from public.clock_events ce
  group by ce.employee_id, date_trunc('week', ce.event_date)
)
select
  e.id as employee_id,
  e.name as employee_name,
  e.position,
  e.store_id,
  coalesce(wr.week_start_date, wa.week_start_date) as week_start_date,
  coalesce(wr.scheduled_hours, 0) as scheduled_hours,
  coalesce(wa.actual_hours, 0) as actual_hours,
  coalesce(wa.deliveries_total, 0) as deliveries_total,
  e.hourly_ni_rate,
  e.hourly_cash_rate,
  -- Wage split: first 20h = NI (bank), remainder = cash if cash rate set
  least(coalesce(wr.scheduled_hours, 0), 20) * coalesce(e.hourly_ni_rate, e.hourly_rate, 0) as scheduled_ni_wages,
  greatest(coalesce(wr.scheduled_hours, 0) - 20, 0) * coalesce(e.hourly_cash_rate, 0) as scheduled_cash_wages,
  least(coalesce(wr.scheduled_hours, 0), 20) * coalesce(e.hourly_ni_rate, e.hourly_rate, 0)
    + greatest(coalesce(wr.scheduled_hours, 0) - 20, 0) * coalesce(e.hourly_cash_rate, 0)
    as scheduled_total_wages
from public.employees e
left join weekly_rota wr on wr.employee_id = e.id
left join weekly_actual wa on wa.employee_id = e.id
  and wa.week_start_date = wr.week_start_date;

-- =============================================================
-- ROW LEVEL SECURITY for new tables
-- =============================================================
alter table public.stores            enable row level security;
alter table public.rota_shifts       enable row level security;
alter table public.clock_events      enable row level security;
alter table public.weekly_deliveries enable row level security;
alter table public.alerts            enable row level security;
alter table public.audit_log         enable row level security;

-- Drop existing to keep rerunnable
drop policy if exists "stores_select"            on public.stores;
drop policy if exists "stores_modify"            on public.stores;
drop policy if exists "rota_shifts_select"       on public.rota_shifts;
drop policy if exists "rota_shifts_modify"       on public.rota_shifts;
drop policy if exists "clock_events_select"      on public.clock_events;
drop policy if exists "clock_events_modify"      on public.clock_events;
drop policy if exists "weekly_deliveries_select" on public.weekly_deliveries;
drop policy if exists "weekly_deliveries_modify" on public.weekly_deliveries;
drop policy if exists "alerts_select"            on public.alerts;
drop policy if exists "alerts_modify"            on public.alerts;
drop policy if exists "audit_log_select"         on public.audit_log;
drop policy if exists "audit_log_insert"         on public.audit_log;

create policy "stores_select" on public.stores
  for select to authenticated
  using (public.is_allowed(auth.jwt() ->> 'email'));

create policy "stores_modify" on public.stores
  for all to authenticated
  using (public.is_admin(auth.jwt() ->> 'email'))
  with check (public.is_admin(auth.jwt() ->> 'email'));

create policy "rota_shifts_select" on public.rota_shifts
  for select to authenticated
  using (public.is_allowed(auth.jwt() ->> 'email'));

create policy "rota_shifts_modify" on public.rota_shifts
  for all to authenticated
  using (public.is_allowed(auth.jwt() ->> 'email'))
  with check (public.is_allowed(auth.jwt() ->> 'email'));

create policy "clock_events_select" on public.clock_events
  for select to authenticated
  using (public.is_allowed(auth.jwt() ->> 'email'));

create policy "clock_events_modify" on public.clock_events
  for all to authenticated
  using (public.is_allowed(auth.jwt() ->> 'email'))
  with check (public.is_allowed(auth.jwt() ->> 'email'));

create policy "weekly_deliveries_select" on public.weekly_deliveries
  for select to authenticated
  using (public.is_allowed(auth.jwt() ->> 'email'));

create policy "weekly_deliveries_modify" on public.weekly_deliveries
  for all to authenticated
  using (public.is_allowed(auth.jwt() ->> 'email'))
  with check (public.is_allowed(auth.jwt() ->> 'email'));

create policy "alerts_select" on public.alerts
  for select to authenticated
  using (public.is_allowed(auth.jwt() ->> 'email'));

create policy "alerts_modify" on public.alerts
  for all to authenticated
  using (public.is_allowed(auth.jwt() ->> 'email'))
  with check (public.is_allowed(auth.jwt() ->> 'email'));

create policy "audit_log_select" on public.audit_log
  for select to authenticated
  using (public.is_allowed(auth.jwt() ->> 'email'));

create policy "audit_log_insert" on public.audit_log
  for insert to authenticated
  with check (public.is_allowed(auth.jwt() ->> 'email'));

grant select on public.employee_weekly_summary to authenticated;

-- =============================================================
-- SEED HINT
-- After running this schema, insert your first admin user manually:
--
--   insert into public.allowed_users (email, name, role)
--   values ('you@example.com', 'Your Name', 'admin');
--
-- Then create that auth user in Supabase Authentication > Users.
-- =============================================================
