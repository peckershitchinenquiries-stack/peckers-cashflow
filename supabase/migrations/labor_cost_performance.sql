-- Migration: Create labor_cost_performance view
-- Purpose: Aggregate labor costs and revenue by store and week for dashboard display
-- Created: 2026-06-13

CREATE OR REPLACE VIEW public.labor_cost_performance AS
SELECT
  s.id,
  s.name AS store,
  ews.week_start_date,
  -- Labor cost: sum of scheduled wages for the week
  COALESCE(SUM(ews.scheduled_total_wages), 0) AS labour_cost,
  -- Revenue: sum of vita_mojo_sales for the week, aggregated by day
  COALESCE(SUM(dce.vita_mojo_sales), 0) AS revenue,
  -- Labor % of revenue
  CASE
    WHEN COALESCE(SUM(dce.vita_mojo_sales), 0) > 0
    THEN ROUND(100 * COALESCE(SUM(ews.scheduled_total_wages), 0) / SUM(dce.vita_mojo_sales), 1)
    ELSE 0
  END AS labour_pct
FROM stores s
LEFT JOIN employee_weekly_summary ews ON ews.store_id = s.id
LEFT JOIN daily_cash_entries dce
  ON dce.store_id = s.id
  AND DATE_TRUNC('week', dce.entry_date) = ews.week_start_date
GROUP BY s.id, s.name, ews.week_start_date
ORDER BY s.name, ews.week_start_date DESC;

-- Grant SELECT to anon and authenticated roles for dashboard access
GRANT SELECT ON public.labor_cost_performance TO anon, authenticated;
