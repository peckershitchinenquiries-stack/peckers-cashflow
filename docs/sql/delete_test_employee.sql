-- =============================================================
-- Delete a TEST employee and every trace of them
--
-- Scope: HR profile, login identity (allowed_users + auth.users),
-- attendance, rota, hours, pay lines, alerts, push subscriptions, audit rows.
--
-- NOT for real staff. A real leaver should be deactivated
-- (employees.is_active = false), not deleted — payout history keys on these
-- rows, and removing them restates weeks that were already paid.
--
-- Usage: set the name below, run the whole file in the Supabase SQL Editor.
-- It is one transaction: if any step fails nothing is removed.
-- Run the SELECTs at the bottom before COMMIT to see what will go.
-- =============================================================

begin;

-- ---- 0. Resolve who we are deleting --------------------------------------
-- Matches the HR row by name, or by the synthetic login identity
-- (<username>@staff.peckers-app.co.uk, see lib/credentials.ts).

create temporary table _target_emp on commit drop as
select e.id, e.auth_user_id, e.name, e.email
from public.employees e
where lower(e.name) = lower('testemp1')
   or lower(e.email) like 'testemp1@%'
   or lower(e.email) like 'testemp1.%@%';

-- Login rows: linked by employee_id, or orphaned ones sharing the username.
create temporary table _target_acct on commit drop as
select au.id, au.email, au.employee_id
from public.allowed_users au
where au.employee_id in (select id from _target_emp)
   or lower(au.username) = lower('testemp1')
   or lower(au.email) like 'testemp1@%';

-- Auth users: from either side, since a half-provisioned account may have one
-- without the other.
create temporary table _target_auth on commit drop as
select distinct u.id
from auth.users u
where u.id in (select auth_user_id from _target_emp where auth_user_id is not null)
   or lower(u.email) in (select lower(email) from _target_acct where email is not null)
   or lower(u.email) in (select lower(email) from _target_emp where email is not null);

-- Abort rather than silently delete nothing.
do $$
begin
  if not exists (select 1 from _target_emp)
     and not exists (select 1 from _target_acct)
     and not exists (select 1 from _target_auth) then
    raise exception 'No employee, login row or auth user matched — check the name';
  end if;
  if (select count(*) from _target_emp) > 1 then
    raise exception 'Name matched % employees — narrow the filter before deleting',
      (select count(*) from _target_emp);
  end if;
end $$;

-- ---- 1. Push ------------------------------------------------------------
delete from public.push_reminders
 where employee_id in (select id from _target_emp);
delete from public.push_subscriptions
 where employee_id in (select id from _target_emp);

-- ---- 2. Attendance -------------------------------------------------------
-- Sessions are the shifts, clock_events the day headers.
delete from public.clock_sessions
 where employee_id in (select id from _target_emp);
delete from public.clock_events
 where employee_id in (select id from _target_emp);
delete from public.geofence_failures
 where employee_id in (select id from _target_emp);

-- ---- 3. Rota, availability, weekly rollup --------------------------------
delete from public.rota_shifts
 where employee_id in (select id from _target_emp);
delete from public.employee_schedules
 where employee_id in (select id from _target_emp);
delete from public.employee_hours
 where employee_id in (select id from _target_emp);

-- ---- 4. Money ------------------------------------------------------------
-- Payout lines on a CONFIRMED payout: removing them changes that sheet's
-- totals. Fine for a test account, never for real staff.
delete from public.cash_payout_lines
 where employee_id in (select id from _target_emp);
delete from public.weekly_report_labour_lines
 where employee_id in (select id from _target_emp);
delete from public.manual_ni_records
 where employee_name in (select name from _target_emp);

-- ---- 5. Alerts -----------------------------------------------------------
delete from public.alerts
 where employee_id in (select id from _target_emp);

-- ---- 6. Login credentials ------------------------------------------------
-- password_reset_tokens cascades off allowed_users (migration 019).
delete from public.password_reset_tokens
 where user_id in (select id from _target_acct);
delete from public.allowed_users
 where id in (select id from _target_acct);

-- ---- 7. HR profile -------------------------------------------------------
delete from public.employees
 where id in (select id from _target_emp);

-- ---- 8. Audit trail ------------------------------------------------------
-- Drop last: the IDs above are what these rows point at.
delete from public.audit_log
 where entity = 'employee'
   and entity_id::text in (select id::text from _target_emp);

-- ---- 9. Auth identity ----------------------------------------------------
-- auth.identities / sessions / refresh tokens cascade off this row.
delete from auth.users
 where id in (select id from _target_auth);

-- ---- Verify before committing -------------------------------------------
select 'employees'     as tbl, count(*) from public.employees     where lower(name) = lower('testemp1')
union all
select 'allowed_users',        count(*) from public.allowed_users where lower(username) = lower('testemp1')
union all
select 'auth.users',           count(*) from auth.users           where lower(email) like 'testemp1@%';

commit;
-- rollback;  -- swap for commit if the counts above are not all zero
