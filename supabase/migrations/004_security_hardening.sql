-- =============================================================
-- Migration 004 — security hardening (run after 001–003)
--
-- A) Enforce the cash-entry date window at the database level. The server
--    action validates it, but a manager's JWT can hit PostgREST directly —
--    without this trigger the "today or past 2 days" rule (and the no-future
--    rule) would be bypassable. Also derives is_late server-side so it can't
--    be spoofed.
--
-- B) Make the reporting views run with the CALLER's permissions
--    (security_invoker). By default Postgres views execute with the owner's
--    rights, which silently bypassed RLS on employee_hours/employees — any
--    authenticated login (including crew) could read every employee's hours,
--    rates and cash due. With security_invoker the existing RLS policies
--    apply through the views: staff keep full access, crew see only their own.
-- =============================================================

-- ---------- A) daily_cash_entries date window ----------

create or replace function public.enforce_daily_cash_entry_window()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- UK business day, not UTC.
  today date := (now() at time zone 'Europe/London')::date;
begin
  -- Service-role / SQL-console writes are exempt (no user JWT).
  if auth.jwt() is null or (auth.jwt() ->> 'role') = 'service_role' then
    return new;
  end if;
  if new.entry_date > today then
    raise exception 'Cash entries cannot be dated in the future.';
  end if;
  if not public.is_admin(auth.jwt() ->> 'email') and new.entry_date < today - 2 then
    raise exception 'Cash entries can only be added for today or the past 2 days.';
  end if;
  -- is_late is server-derived; clients cannot spoof it.
  new.is_late := new.entry_date < today;
  return new;
end;
$$;

drop trigger if exists daily_cash_entries_date_window on public.daily_cash_entries;
create trigger daily_cash_entries_date_window
  before insert or update on public.daily_cash_entries
  for each row execute function public.enforce_daily_cash_entry_window();

-- ---------- B) views must respect the caller's RLS ----------

alter view public.employee_hours_computed set (security_invoker = true);
alter view public.employee_weekly_summary  set (security_invoker = true);
