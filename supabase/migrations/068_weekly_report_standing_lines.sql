-- =============================================================
-- Migration 068 — Weekly Report: managers' weekly contract + standing labour
--
-- RUN THIS **BEFORE** DEPLOYING THE CODE THAT SELECTS THESE COLUMNS. Purely
-- additive (nullable / defaulted columns), so the currently deployed build is
-- unaffected by it running early, and the new build breaks if it runs late.
-- Idempotent: `add column if not exists`.
--
-- WHY
-- Both stores' workbooks cost every manager at a flat 45 hours x their NI rate
-- at their home store, however many days they clocked (Surya 45 x 14.10 =
-- 634.50, Sreehari 45 x 13.46 = 605.70). Prefill had only the fixed daily
-- wage x days clocked, so it could not produce that figure.
--
-- And two lines sit on both sheets every week at the same figures — Apoorva
-- (22.5 NI h x 14.10) and India Out Source (45 h for a flat £50). `standing`
-- marks a hand-entered line a new week opens with, figures included. It is
-- only ever set on source 'adhoc', which prefill never replaces.
--
-- Schema only: no figure is written. Rates are entered on the Managers screen.
-- =============================================================

alter table public.allowed_users
  add column if not exists weekly_contract_hours numeric(5,2),
  add column if not exists weekly_ni_rate        numeric(8,4);

comment on column public.allowed_users.weekly_contract_hours is
  'Managers: contracted hours a week (null = 45). With weekly_ni_rate, the Weekly Report costs the manager at these hours x that rate at their HOME store.';
comment on column public.allowed_users.weekly_ni_rate is
  'Managers: NI hourly rate of their weekly salary, for the Weekly Report labour cost only. Null = fall back to fixed_daily_wage x days clocked.';

alter table public.weekly_report_labour_lines
  add column if not exists standing boolean not null default false;

comment on column public.weekly_report_labour_lines.standing is
  'A hand-entered (adhoc) line every new week opens with, figures included — Apoorva, outsourced cover. Prefill never replaces it.';
