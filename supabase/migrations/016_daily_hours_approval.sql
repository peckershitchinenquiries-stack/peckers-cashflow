-- =============================================================
-- Migration 016 — Per-DAY approval of clocked hours
--
-- Managers approve the hours an employee clocked one DAY at a time (instead of
-- approving a whole week at once). Because clock_events already holds exactly
-- one row per (employee, day) — see the clock_events_unique index — we store the
-- day-level approval state directly on that row. No new table needed.
--
--   hours_approved     — has a manager confirmed this day's hours for payroll?
--   approved_hours     — the confirmed hours (may differ from the raw clocked
--                        duration if a manager corrected a missed clock-out).
--   hours_approved_by  — who approved.
--   hours_approved_at  — when.
--
-- The weekly employee_hours row (source='clocked') remains the authoritative
-- rollup that payroll / NI / analytics read: it is recomputed server-side as the
-- SUM of approved_hours across the week's approved days. The weekly 20h bank vs
-- cash split still happens in employee_hours_computed, unchanged.
--
-- Run this in the Supabase SQL Editor (or via `supabase db push`). Idempotent.
-- =============================================================

alter table public.clock_events
  add column if not exists hours_approved    boolean not null default false,
  add column if not exists approved_hours    numeric(6,2),
  add column if not exists hours_approved_by uuid references auth.users(id) on delete set null,
  add column if not exists hours_approved_at timestamptz;

-- Backfill: every completed clocked day that already belongs to an APPROVED
-- weekly employee_hours row is treated as already approved, so historical weeks
-- don't flood the new "pending" list. approved_hours = that day's raw duration.
update public.clock_events ce
set
  hours_approved    = true,
  approved_hours    = round((extract(epoch from (ce.clock_out_at - ce.clock_in_at)) / 3600.0)::numeric, 2),
  hours_approved_at = coalesce(ce.hours_approved_at, now())
from public.employee_hours eh
where eh.employee_id = ce.employee_id
  and eh.approved = true
  and ce.event_date >= eh.week_start_date
  and ce.event_date <  eh.week_start_date + 7
  and ce.clock_in_at  is not null
  and ce.clock_out_at is not null
  and ce.hours_approved = false;

create index if not exists clock_events_approval_idx
  on public.clock_events (hours_approved, event_date);
