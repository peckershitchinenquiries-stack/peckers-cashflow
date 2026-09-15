-- =============================================================
-- Migration 057 — Retire the early clock-in OTP table (Update 180)
--
-- Clock-in is now strict to the booked rota start: an early clock-in is refused
-- outright, with no manager code to override it. Nothing in the app reads or
-- writes early_clock_in_requests any more.
--
-- DEPLOY ORDER: run AFTER the Update 180 code is live. The previously deployed
-- build queries this table on both Live boards and from the crew clock screen.
--
-- Destructive: the table's rows (the audit trail of past OTP requests) go with
-- it. Export them first if that history is wanted. Nothing else depends on the
-- table — it was an audit sidecar never read by approval or payout logic, and
-- migration 043 added no columns to any other table.
--
-- Idempotent.
-- =============================================================

drop table if exists public.early_clock_in_requests;
