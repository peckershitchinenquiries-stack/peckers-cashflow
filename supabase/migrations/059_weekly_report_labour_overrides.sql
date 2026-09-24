-- =============================================================
-- Migration 059 — Weekly Report labour: typed totals that are not hours x rate
--
-- RUN THIS **BEFORE** DEPLOYING THE CODE THAT SELECTS THESE COLUMNS. It is
-- purely additive — two nullable columns — so the currently deployed build is
-- unaffected by it running early, and the new build breaks if it runs late.
--
-- WHY
-- Not every line on the Labour Cost sheet is priced by the hour. "India Out
-- source" is 45 hours of cover bought for a flat £50; the same shape turns up
-- whenever a job is bought as a job. Written as hours x rate it either loses
-- the hours (1 x 50) or invents a rate nobody agreed (45 x 1.1111), and the
-- rate column is then a lie anyone reading the sheet has to unpick.
--
-- So the TOTAL becomes typeable, and the hours stay true. Null means what it
-- has always meant — the total is hours x rate — which is every existing row
-- and every ordinary week.
--
-- Deliberately NOT a return of `fixed_pay` (migration 050): that column
-- replaced the hour/rate pair and blanked the Hours worked column for whoever
-- carried it. This one sits BESIDE the pair.
--
-- Idempotent: `add column if not exists`.
-- =============================================================

alter table public.weekly_report_labour_lines
  add column if not exists ni_total_override   numeric(12,2),
  add column if not exists cash_total_override numeric(12,2);

comment on column public.weekly_report_labour_lines.ni_total_override is
  'Typed NI total for a line that is not priced by the hour. Null = ni_hours x ni_rate, which is the ordinary case.';
comment on column public.weekly_report_labour_lines.cash_total_override is
  'Typed cash total for a line that is not priced by the hour — an outsourced job bought as a job. Null = cash_hours x cash_rate.';
