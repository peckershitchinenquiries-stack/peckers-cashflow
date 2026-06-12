-- =============================================================
-- Migration 002 — Manager approval of clocked hours
-- Managers no longer log weekly hours manually; instead they APPROVE the
-- hours an employee actually clocked. An approved week is stored as an
-- employee_hours row stamped with approved/approved_by/approved_at and a
-- `source` of 'clocked'. Manual admin corrections keep source 'manual'.
-- Run this in the Supabase SQL editor (or via `supabase db push`).
-- =============================================================

alter table public.employee_hours
  add column if not exists approved     boolean not null default false,
  add column if not exists approved_by  uuid references auth.users(id) on delete set null,
  add column if not exists approved_at  timestamptz,
  add column if not exists source       text not null default 'manual'
    check (source in ('manual', 'clocked'));

-- Surface the new columns through the computed view.
-- NOTE: `create or replace view` cannot insert columns in the middle of the
-- existing column list, so we drop and recreate it.
-- security_invoker: respect the caller's RLS (see migration 004).
drop view if exists public.employee_hours_computed;
create view public.employee_hours_computed with (security_invoker = true) as
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
  eh.approved,
  eh.approved_at,
  eh.source,
  eh.created_at
from public.employee_hours eh
join public.employees e on e.id = eh.employee_id;

grant select on public.employee_hours_computed to authenticated;
