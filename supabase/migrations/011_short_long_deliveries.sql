-- =============================================================
-- Migration 011 — Short vs Long deliveries
-- Deliveries are now split into two types, each with its own per-driver rate:
--   • Short deliveries  (employees.short_delivery_rate)
--   • Long  deliveries  (employees.long_delivery_rate)
-- Drivers enter a short count and a long count at clock-out; each type can also
-- carry "extra" deliveries (beyond the normal round) with a reason. The weekly
-- delivery wage = Σ(short_count × short_rate + long_count × long_rate) over the
-- pay week.
--
-- This REPLACES the single delivery_rate / deliveries_count / extra_deliveries
-- model. Existing data is migrated into the SHORT bucket so nothing is lost,
-- then the old columns are dropped.
--
-- Run this in the Supabase SQL editor (or via `supabase db push`).
-- Idempotent — safe to re-run.
-- =============================================================

-- ---------- employees: per-driver short + long rates ----------
alter table public.employees
  add column if not exists short_delivery_rate numeric(8,2),
  add column if not exists long_delivery_rate  numeric(8,2);

-- Migrate the old single rate into the short rate (only if the old column still exists).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'employees' and column_name = 'delivery_rate'
  ) then
    update public.employees
      set short_delivery_rate = delivery_rate
      where delivery_rate is not null and short_delivery_rate is null;
  end if;
end $$;

alter table public.employees
  drop column if exists delivery_rate;

-- ---------- clock_events: short + long counts (+ per-type extras) ----------
alter table public.clock_events
  add column if not exists short_deliveries_count integer,
  add column if not exists long_deliveries_count  integer,
  add column if not exists extra_short_deliveries integer not null default 0,
  add column if not exists extra_long_deliveries  integer not null default 0,
  add column if not exists extra_short_reason     text,
  add column if not exists extra_long_reason      text;

-- Migrate existing single counts/extras into the short bucket (only if old columns still exist).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clock_events' and column_name = 'deliveries_count'
  ) then
    update public.clock_events
      set short_deliveries_count = deliveries_count
      where deliveries_count is not null and short_deliveries_count is null;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clock_events' and column_name = 'extra_deliveries'
  ) then
    update public.clock_events
      set extra_short_deliveries = extra_deliveries
      where extra_deliveries is not null and extra_deliveries <> 0 and extra_short_deliveries = 0;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clock_events' and column_name = 'extra_delivery_reason'
  ) then
    update public.clock_events
      set extra_short_reason = extra_delivery_reason
      where extra_delivery_reason is not null and extra_short_reason is null;
  end if;
end $$;

-- The employee_weekly_summary view references deliveries_count, so it must be
-- repointed at the new short+long columns BEFORE we can drop the old one.
create or replace view public.employee_weekly_summary with (security_invoker = true) as
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
    sum(coalesce(ce.short_deliveries_count, 0) + coalesce(ce.long_deliveries_count, 0)) as deliveries_total
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
  least(coalesce(wr.scheduled_hours, 0), 20) * coalesce(e.hourly_ni_rate, e.hourly_rate, 0) as scheduled_ni_wages,
  greatest(coalesce(wr.scheduled_hours, 0) - 20, 0) * coalesce(e.hourly_cash_rate, 0) as scheduled_cash_wages,
  least(coalesce(wr.scheduled_hours, 0), 20) * coalesce(e.hourly_ni_rate, e.hourly_rate, 0)
    + greatest(coalesce(wr.scheduled_hours, 0) - 20, 0) * coalesce(e.hourly_cash_rate, 0)
    as scheduled_total_wages
from public.employees e
left join weekly_rota wr on wr.employee_id = e.id
left join weekly_actual wa on wa.employee_id = e.id
  and wa.week_start_date = wr.week_start_date;

alter table public.clock_events
  drop column if exists deliveries_count,
  drop column if exists extra_deliveries,
  drop column if exists extra_delivery_reason;

-- ---------- cash_payout_lines: snapshot the short/long breakdown ----------
alter table public.cash_payout_lines
  add column if not exists short_deliveries_count integer      not null default 0,
  add column if not exists long_deliveries_count  integer      not null default 0,
  add column if not exists short_delivery_rate    numeric(8,2) not null default 0,
  add column if not exists long_delivery_rate     numeric(8,2) not null default 0;

-- Migrate historical snapshot lines into the short bucket (only if old columns still exist).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cash_payout_lines' and column_name = 'deliveries_count'
  ) then
    update public.cash_payout_lines
      set short_deliveries_count = deliveries_count,
          short_delivery_rate    = delivery_rate
      where deliveries_count is not null and short_deliveries_count = 0;
  end if;
end $$;

alter table public.cash_payout_lines
  drop column if exists deliveries_count,
  drop column if exists delivery_rate;
