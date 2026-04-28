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
-- SEED HINT
-- After running this schema, insert your first admin user manually:
--
--   insert into public.allowed_users (email, name, role)
--   values ('you@example.com', 'Your Name', 'admin');
--
-- Then create that auth user in Supabase Authentication > Users.
-- =============================================================
