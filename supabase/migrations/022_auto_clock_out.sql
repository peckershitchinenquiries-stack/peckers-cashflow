-- =============================================================
-- Migration 022 — Auto clock-out for forgotten clock-outs
--
-- Staff and managers regularly forget to clock out. Because every hours
-- calculation in the app requires BOTH clock_in_at and clock_out_at
-- (resolvedDayHours, aggregateWorked, mapClockEventsToDaily, the payout
-- builder), a missed clock-out silently erased the whole day: the driver
-- showed 0.00h on the Tuesday sheet and the day never even appeared in the
-- daily approval list. At the time of writing there were 35 open employee
-- clock rows and 18 open manager rows — all of them lost hours.
--
-- Fix: once a day is over, the system closes any still-open row itself, using
-- that person's SCHEDULED shift end time as the clock-out. The day is then
-- recorded like any other — it feeds hours, payout and the daily approval
-- queue — but it is flagged so a manager can see the time was assumed rather
-- than clocked, and correct it during approval.
--
--   auto_clocked_out       — was this row closed by the system?
--   auto_clock_out_source  — where the assumed end time came from:
--                            'rota'        published rota / manager shift end
--                            'schedule'    recurring weekly template end
--                            'store_close' the store's closing time
--                            'fallback'    no end time anywhere — clock-in
--                                          plus the default shift length
--   auto_clock_out_at      — when the system wrote it (audit trail)
--
-- A manual clock-out always wins: the sweep only ever touches rows where
-- clock_out_at is still null.
--
-- Run this in the Supabase SQL Editor (or via `supabase db push`). Idempotent.
-- =============================================================

alter table public.clock_events
  add column if not exists auto_clocked_out      boolean not null default false,
  add column if not exists auto_clock_out_source text,
  add column if not exists auto_clock_out_at     timestamptz;

alter table public.manager_clock_events
  add column if not exists auto_clocked_out      boolean not null default false,
  add column if not exists auto_clock_out_source text,
  add column if not exists auto_clock_out_at     timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clock_events_auto_source_check'
  ) then
    alter table public.clock_events
      add constraint clock_events_auto_source_check
      check (
        auto_clock_out_source is null
        or auto_clock_out_source in ('rota','schedule','store_close','fallback')
      );
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'manager_clock_events_auto_source_check'
  ) then
    alter table public.manager_clock_events
      add constraint manager_clock_events_auto_source_check
      check (
        auto_clock_out_source is null
        or auto_clock_out_source in ('rota','schedule','store_close','fallback')
      );
  end if;
end $$;

-- The sweep looks for open rows (clocked in, never clocked out) on past days.
create index if not exists clock_events_open_idx
  on public.clock_events (event_date)
  where clock_out_at is null;

create index if not exists manager_clock_events_open_idx
  on public.manager_clock_events (event_date)
  where clock_out_at is null;
