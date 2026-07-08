-- =============================================================
-- Migration: per-store shift (rota preset) times
-- Each store trades on its own Open/Evening/Close hours, so shift times
-- move off the single global app_settings row onto the stores table.
-- Safe to re-run.
-- =============================================================

alter table public.stores
  add column if not exists shift_times jsonb not null default
    '{"driver_open":"11:30","kitchen_open":"09:00","evening_start":"17:00","close":"23:00"}'::jsonb;

-- Seed existing stores from the old global setting if one was saved.
update public.stores s
set shift_times = a.value
from public.app_settings a
where a.key = 'shift_times'
  and s.shift_times =
    '{"driver_open":"11:30","kitchen_open":"09:00","evening_start":"17:00","close":"23:00"}'::jsonb;
