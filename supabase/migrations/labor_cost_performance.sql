-- Migration: Create labor_cost_performance view
-- Purpose: Aggregate labor costs and revenue by store and week for dashboard display
-- Created: 2026-06-13
-- Fixed: 2026-06-15 — pre-aggregate labour and revenue separately to avoid
--        multiplying revenue by employee count (Cartesian product in the join)

CREATE OR REPLACE VIEW public.labor_cost_performance AS
WITH labour_by_week AS (
  -- Aggregate scheduled wages per store per week (sum across all employees)
  SELECT
    ews.store_id,
    ews.week_start_date,
    SUM(ews.scheduled_total_wages) AS labour_cost
  FROM employee_weekly_summary ews
  WHERE ews.week_start_date IS NOT NULL
  GROUP BY ews.store_id, ews.week_start_date
),
revenue_by_week AS (
  -- Aggregate POS sales per store per week (sum across all days)
  SELECT
    dce.store_id,
    DATE_TRUNC('week', dce.entry_date)::date AS week_start_date,
    SUM(dce.vita_mojo_sales) AS revenue
  FROM daily_cash_entries dce
  GROUP BY dce.store_id, DATE_TRUNC('week', dce.entry_date)
)
SELECT
  s.id,
  s.name AS store,
  COALESCE(lbw.week_start_date, rbw.week_start_date) AS week_start_date,
  COALESCE(lbw.labour_cost, 0) AS labour_cost,
  COALESCE(rbw.revenue, 0) AS revenue,
  CASE
    WHEN COALESCE(rbw.revenue, 0) > 0
    THEN ROUND(100 * COALESCE(lbw.labour_cost, 0) / rbw.revenue, 1)
    ELSE 0
  END AS labour_pct
FROM stores s
LEFT JOIN labour_by_week lbw ON lbw.store_id = s.id
LEFT JOIN revenue_by_week rbw
  ON rbw.store_id = s.id
  AND rbw.week_start_date = lbw.week_start_date
WHERE lbw.week_start_date IS NOT NULL
ORDER BY s.name, COALESCE(lbw.week_start_date, rbw.week_start_date) DESC;

-- Grant SELECT to anon and authenticated roles for dashboard access
GRANT SELECT ON public.labor_cost_performance TO anon, authenticated;
