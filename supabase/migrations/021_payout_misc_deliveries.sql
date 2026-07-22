-- =============================================================
-- Migration 021 — Split miscellaneous (extra) drops out on the payout sheet
--
-- clock_events already records the extra drops beyond a driver's normal round
-- (extra_short_deliveries / extra_long_deliveries, migration 011). Until now the
-- payout line folded those into short_deliveries_count / long_deliveries_count,
-- so the Tuesday sheet could only show "40S / 6L" — a manager could not tell a
-- normal-round drop from an extra one.
--
-- Store them separately on the payout line so the sheet can show
-- SD / LD / SM / LM. Pay is unchanged: a misc drop is still paid at the same
-- per-type rate, so delivery_wages and total_payment do not move.
--
-- Historic rows keep 0 misc (their extras stay folded into the base counts) —
-- confirmed payouts are immutable snapshots and must not be rewritten.
--
-- Run this in the Supabase SQL Editor (or via `supabase db push`). Idempotent.
-- =============================================================

alter table public.cash_payout_lines
  add column if not exists short_misc_count integer not null default 0,
  add column if not exists long_misc_count  integer not null default 0;
