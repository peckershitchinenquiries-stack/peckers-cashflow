-- =============================================================
-- Migration 003 — Extra deliveries with a reason
-- A driver sometimes makes deliveries beyond their normal round. These are
-- captured separately from the standard `deliveries_count`, with a reason.
-- Managers and admins can also edit a driver's clocked delivery figures.
-- Run this in the Supabase SQL editor (or via `supabase db push`).
-- =============================================================

alter table public.clock_events
  add column if not exists extra_deliveries      integer not null default 0,
  add column if not exists extra_delivery_reason text;
