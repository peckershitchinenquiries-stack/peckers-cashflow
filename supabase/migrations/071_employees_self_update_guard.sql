-- =============================================================
-- 071 — employees: crew may edit only their contact and bank fields (Update 273)
--
-- Security: the RLS policy employees_self_update lets an employee UPDATE their
-- own row, and RLS cannot restrict columns. With their own JWT and the public
-- anon key an employee could PATCH /rest/v1/employees directly and raise
-- hourly_cash_rate / delivery rates, zero bank_weekly_hours_limit, or change
-- store_id / position — all read live by the Tuesday payout. The comment on the
-- policy said "server action limits columns", but PostgREST bypasses actions.
--
-- This trigger leaves the policy in place (app/actions/self.ts updateOwnProfile
-- needs it) and rejects any change to another column unless the caller is
-- staff or is not an end user at all (service_role, postgres, SQL editor).
--
-- Columns crew may change — exactly what updateOwnProfile writes:
--   phone, bank_account_name, bank_name, account_number, sort_code
--
-- Restrictive only, so it can run before or after the code deploy. Idempotent.
-- =============================================================

create or replace function public.employees_guard_self_update()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  crew_editable constant text[] := array[
    'phone', 'bank_account_name', 'bank_name', 'account_number', 'sort_code',
    'updated_at'
  ];
begin
  -- Only end-user requests are restricted. service_role and direct SQL pass.
  if current_user <> 'authenticated' then
    return new;
  end if;
  if public.is_staff() then
    return new;
  end if;

  if (to_jsonb(new) - crew_editable) is distinct from (to_jsonb(old) - crew_editable) then
    raise exception 'Only a manager or admin can change these employee details.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists employees_guard_self_update on public.employees;
create trigger employees_guard_self_update
  before update on public.employees
  for each row execute function public.employees_guard_self_update();
