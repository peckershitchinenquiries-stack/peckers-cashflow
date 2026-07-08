-- =============================================================
-- 013_manager_daily_wage.sql
--
-- The manager's fixed wage is a DAILY figure, not monthly. Rename the column
-- accordingly (existing values are preserved by the rename). Idempotent.
--
-- Run this in the Supabase SQL Editor.
-- =============================================================

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'allowed_users'
      and column_name = 'fixed_monthly_wage'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'allowed_users'
      and column_name = 'fixed_daily_wage'
  ) then
    alter table public.allowed_users rename column fixed_monthly_wage to fixed_daily_wage;
  end if;
end $$;

-- Fresh installs (or if the old column was never created): ensure it exists.
alter table public.allowed_users
  add column if not exists fixed_daily_wage numeric(10,2);
