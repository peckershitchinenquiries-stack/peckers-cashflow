-- =============================================================
-- Migration 017 — Manager rota (scheduled shifts for managers)
--
-- Managers are login accounts (allowed_users, role='manager'), not employees,
-- so the crew rota_shifts table (keyed on employee_id) can't hold their
-- schedule. This mirrors rota_shifts but keyed on the login account, and
-- drops the wage-only fields (shift_type preset, same_day_edit_reason) since
-- a manager's fixed_daily_wage (see migration 013) never depends on rota or
-- clock data — this table is for staffing visibility + attendance monitoring
-- only, shown above the employee rota on the admin Rota page.
--
-- Run this in the Supabase SQL Editor (or via `supabase db push`). Idempotent.
-- =============================================================

create table if not exists public.manager_shifts (
  id              uuid primary key default gen_random_uuid(),
  manager_id      uuid not null references public.allowed_users(id) on delete cascade,
  store_id        uuid not null references public.stores(id) on delete cascade,
  shift_date      date not null,
  start_time      time,
  end_time        time,
  is_day_off      boolean not null default false,
  scheduled_hours numeric(5,2) not null default 0,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null,
  updated_by      uuid references auth.users(id) on delete set null
);

create unique index if not exists manager_shifts_unique on public.manager_shifts (manager_id, shift_date);
create index if not exists manager_shifts_date_idx on public.manager_shifts (shift_date);
create index if not exists manager_shifts_store_date_idx on public.manager_shifts (store_id, shift_date);

drop trigger if exists set_manager_shifts_updated_at on public.manager_shifts;
create trigger set_manager_shifts_updated_at
  before update on public.manager_shifts
  for each row execute function public.set_updated_at();

alter table public.manager_shifts enable row level security;

drop policy if exists "manager_shifts_select" on public.manager_shifts;
drop policy if exists "manager_shifts_modify" on public.manager_shifts;

-- Staff (admin/manager) can view; only admin assigns manager shifts — managers
-- are provisioned/managed by admin only (see /managers, the account-creation
-- flow), and the edit UI only exists on the admin Rota page today.
create policy "manager_shifts_select" on public.manager_shifts
  for select to authenticated
  using (public.is_staff());

create policy "manager_shifts_modify" on public.manager_shifts
  for all to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

grant all on public.manager_shifts to anon, authenticated, service_role;
