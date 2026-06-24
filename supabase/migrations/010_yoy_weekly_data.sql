-- ============================================================
-- YoY historical weekly sales tables
-- Populated from the three uploaded Excel files.
-- week_commencing is the Monday ISO date (YYYY-MM-DD).
-- ============================================================

-- Both stores combined
CREATE TABLE IF NOT EXISTS vm_yoy_both_stores (
  week_commencing   DATE        PRIMARY KEY,
  click_collect     NUMERIC,
  kiosk             NUMERIC,
  till_eat_in       NUMERIC,
  till_takeaway     NUMERIC,
  own_delivery      NUMERIC,
  deliveroo         NUMERIC,
  just_eat          NUMERIC,
  uber_eats         NUMERIC,
  total_sales       NUMERIC,
  in_store_sales    NUMERIC,
  delivery_sales    NUMERIC,
  in_store_pct      NUMERIC,
  delivery_pct      NUMERIC,
  own_delivery_sales NUMERIC,
  aggregate_sales   NUMERIC,
  own_delivery_pct  NUMERIC,
  aggregate_pct     NUMERIC
);

-- Hitchin store only
CREATE TABLE IF NOT EXISTS vm_yoy_hitchin (
  week_commencing   DATE        PRIMARY KEY,
  click_collect     NUMERIC,
  kiosk             NUMERIC,
  till_eat_in       NUMERIC,
  till_takeaway     NUMERIC,
  own_delivery      NUMERIC,
  deliveroo         NUMERIC,
  just_eat          NUMERIC,
  uber_eats         NUMERIC,
  total_sales       NUMERIC,
  in_store_sales    NUMERIC,
  delivery_sales    NUMERIC,
  in_store_pct      NUMERIC,
  delivery_pct      NUMERIC,
  own_delivery_sales NUMERIC,
  aggregate_sales   NUMERIC,
  own_delivery_pct  NUMERIC,
  aggregate_pct     NUMERIC
);

-- Stevenage store only
CREATE TABLE IF NOT EXISTS vm_yoy_stevenage (
  week_commencing   DATE        PRIMARY KEY,
  click_collect     NUMERIC,
  kiosk             NUMERIC,
  till_eat_in       NUMERIC,
  till_takeaway     NUMERIC,
  own_delivery      NUMERIC,
  deliveroo         NUMERIC,
  just_eat          NUMERIC,
  uber_eats         NUMERIC,
  total_sales       NUMERIC,
  in_store_sales    NUMERIC,
  delivery_sales    NUMERIC,
  in_store_pct      NUMERIC,
  delivery_pct      NUMERIC,
  own_delivery_sales NUMERIC,
  aggregate_sales   NUMERIC,
  own_delivery_pct  NUMERIC,
  aggregate_pct     NUMERIC
);

-- Grant read access to the vm-analytics role
GRANT SELECT ON vm_yoy_both_stores TO authenticated;
GRANT SELECT ON vm_yoy_hitchin      TO authenticated;
GRANT SELECT ON vm_yoy_stevenage    TO authenticated;
