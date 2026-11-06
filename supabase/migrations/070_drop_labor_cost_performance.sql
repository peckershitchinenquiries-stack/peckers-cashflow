-- =============================================================
-- 070 — drop labor_cost_performance (Update 273)
--
-- Security: the view was recreated in 042 WITHOUT security_invoker and granted
-- to anon, so it ran with its owner's rights and returned every store's weekly
-- revenue and labour cost to anyone holding the public anon key, bypassing the
-- RLS on daily_cash_entries / stores / employees / rota_shifts.
--
-- It has had no reader since Update 203 (labour now comes from
-- lib/vm-analytics/labour.ts); its last two query functions are removed in the
-- same change. This is the drop the comments promised as "059", which was
-- never written (059 went to weekly_report_labour_overrides).
--
-- Safe to run before or after the code deploy: the deployed build never calls
-- the removed functions. Idempotent.
-- =============================================================

drop view if exists public.labor_cost_performance;
