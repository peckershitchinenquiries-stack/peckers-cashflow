-- ===========================================================================
-- vm_loyalty_insights.sql — Loyalty Customers insight tabs (VM Analytics, Update 276)
-- ---------------------------------------------------------------------------
-- Run in the VM Supabase project's SQL editor AFTER vm_loyalty_views.sql.
-- Then run once:  select vm_refresh_loyalty_snapshots();
-- After that the weekly loyalty sync refreshes everything here on its own.
--
-- Feeds the Members / Retention / Value / Behaviour tabs. The Overview tab
-- reads only vm_loyalty_views.sql, so it keeps working before this is run.
--
-- Same conventions as vm_loyalty_views.sql: every view is AGGREGATED (they
-- are granted to anon, so no uuid may leave them) and carries an
-- 'All stores' row computed in SQL, because distinct people can't be summed
-- across stores in the app.
--
-- Facts these views rely on (checked against the data, 2026-11-13):
--   * Every member starts with 1 head that no order earned (imports and new
--     sign-ups alike), so VISITS are counted from vm_loyalty_per_customer's
--     order-earned heads, never from balance_accrued.
--   * A head = one day the member spent £12+, so heads earned = visits. With
--     the starting head, 9 visits fill a 10-head card (hence visited_9).
--   * On a Gamma/Beta reward order every line carries the promotion name;
--     the free item is the line with a discount on it.
--   * gross_sales is what the customer paid (incl. VAT, after discounts);
--     net_sales = gross_sales - vat. The £12 rule is on what they pay.
--
-- The three mv_* are created IF NOT EXISTS: after changing one, DROP
-- MATERIALIZED VIEW ... CASCADE first, then re-run this file.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. ACTIVITY — per store-week, from order-earned heads up to that week:
--    lifetime visit funnel, activity segments and 4-week visit frequency.
--    A store row looks only at heads earned AT that store.
--    Segments (as at the week, first match wins):
--      lapsed     — no visit for 8+ weeks
--      at_risk    — last visit 5–8 weeks ago
--      new        — first ever visit in the last 4 weeks
--      champion   — visited in 4+ of the last 8 weeks
--      regular    — visited in 2–3 of the last 8 weeks
--      occasional — visited in the last 4 weeks, only 1 of the last 8
-- ---------------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_vm_loyalty_activity AS
WITH e AS (
  SELECT
    store, week_start, btrim(user_uuid) AS uuid,
    COALESCE(vm_num_sci(points_earnt_click_collect), 0) + COALESCE(vm_num_sci(points_earnt_kiosk), 0)
      + COALESCE(vm_num_sci(points_earnt_opat), 0) + COALESCE(vm_num_sci(points_earnt_delivery), 0) AS heads,
    COALESCE(vm_num_sci(points_redeemed_click_collect), 0) + COALESCE(vm_num_sci(points_redeemed_kiosk), 0)
      + COALESCE(vm_num_sci(points_redeemed_opat), 0) + COALESCE(vm_num_sci(points_redeemed_delivery), 0) AS redeemed
  FROM vm_loyalty_per_customer
  WHERE store IS NOT NULL AND week_start IS NOT NULL
    AND btrim(coalesce(user_uuid, '')) <> ''
),
by_store AS (
  SELECT store AS scope, week_start, uuid, SUM(heads) AS heads, SUM(redeemed) AS redeemed
  FROM e GROUP BY store, week_start, uuid
),
scoped AS (
  SELECT * FROM by_store
  UNION ALL
  SELECT 'All stores', week_start, uuid, SUM(heads), SUM(redeemed)
  FROM by_store GROUP BY week_start, uuid
),
weeks AS (
  SELECT store AS scope, week_start, week_start_iso
  FROM vm_v_loyalty_weeks
  WHERE NOT pre_launch
),
per AS (
  SELECT
    w.scope, w.week_start, s.uuid,
    min(s.week_start) FILTER (WHERE s.heads > 0) AS first_visit_week,
    max(s.week_start) FILTER (WHERE s.heads > 0) AS last_visit_week,
    COUNT(*) FILTER (WHERE s.heads > 0 AND s.week_start > w.week_start - 56) AS visit_weeks_8w,
    COALESCE(SUM(s.heads) FILTER (WHERE s.week_start > w.week_start - 28), 0) AS visits_4w,
    SUM(s.heads)    AS visits_to_date,
    SUM(s.redeemed) AS redeemed_to_date
  FROM weeks w
  JOIN scoped s ON s.scope = w.scope AND s.week_start <= w.week_start
  GROUP BY w.scope, w.week_start, s.uuid
),
seg AS (
  SELECT
    *,
    CASE
      WHEN last_visit_week IS NULL                    THEN NULL
      WHEN last_visit_week <= week_start - 56         THEN 'lapsed'
      WHEN last_visit_week <= week_start - 28         THEN 'at_risk'
      WHEN first_visit_week > week_start - 28         THEN 'new'
      WHEN visit_weeks_8w >= 4                        THEN 'champion'
      WHEN visit_weeks_8w >= 2                        THEN 'regular'
      ELSE 'occasional'
    END AS segment
  FROM per
)
SELECT
  w.scope AS store, w.week_start, (w.week_start + 6) AS week_end, w.week_start_iso,
  -- Lifetime funnel (to this week)
  COUNT(s.uuid) FILTER (WHERE s.visits_to_date >= 1)   AS visited_1,
  COUNT(s.uuid) FILTER (WHERE s.visits_to_date >= 2)   AS visited_2,
  COUNT(s.uuid) FILTER (WHERE s.visits_to_date >= 3)   AS visited_3,
  COUNT(s.uuid) FILTER (WHERE s.visits_to_date >= 6)   AS visited_6,
  COUNT(s.uuid) FILTER (WHERE s.visits_to_date >= 9)   AS visited_9,
  COUNT(s.uuid) FILTER (WHERE s.redeemed_to_date >= 10) AS unlocked_meal,
  -- Segments
  COUNT(s.uuid) FILTER (WHERE s.segment = 'champion')   AS seg_champion,
  COUNT(s.uuid) FILTER (WHERE s.segment = 'regular')    AS seg_regular,
  COUNT(s.uuid) FILTER (WHERE s.segment = 'occasional') AS seg_occasional,
  COUNT(s.uuid) FILTER (WHERE s.segment = 'new')        AS seg_new,
  COUNT(s.uuid) FILTER (WHERE s.segment = 'at_risk')    AS seg_at_risk,
  COUNT(s.uuid) FILTER (WHERE s.segment = 'lapsed')     AS seg_lapsed,
  -- Visit frequency over the last 4 weeks (members with 1+ visit in them)
  COUNT(s.uuid) FILTER (WHERE s.visits_4w >= 1)         AS active_4w,
  COUNT(s.uuid) FILTER (WHERE s.visits_4w = 1)          AS freq_1,
  COUNT(s.uuid) FILTER (WHERE s.visits_4w = 2)          AS freq_2,
  COUNT(s.uuid) FILTER (WHERE s.visits_4w = 3)          AS freq_3,
  COUNT(s.uuid) FILTER (WHERE s.visits_4w >= 4)         AS freq_4plus,
  COALESCE(SUM(s.visits_4w), 0)                         AS visits_4w
FROM weeks w
LEFT JOIN seg s ON s.scope = w.scope AND s.week_start = w.week_start
GROUP BY w.scope, w.week_start, w.week_start_iso;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_vm_loyalty_activity_pk
  ON mv_vm_loyalty_activity (store, week_start);


-- ---------------------------------------------------------------------------
-- 2. COHORTS — members grouped by the month of their FIRST order-earned head;
--    % who came back (another visit) within 2 / 4 / 8 / 12 weeks. A window is
--    only scored for members whose whole window is in the data (eligible_*),
--    so a young cohort isn't penalised for weeks that haven't happened.
-- ---------------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_vm_loyalty_cohorts AS
WITH e AS (
  SELECT store, week_start, btrim(user_uuid) AS uuid
  FROM vm_loyalty_per_customer
  WHERE store IS NOT NULL AND week_start IS NOT NULL
    AND btrim(coalesce(user_uuid, '')) <> ''
    AND COALESCE(vm_num_sci(points_earnt_click_collect), 0) + COALESCE(vm_num_sci(points_earnt_kiosk), 0)
      + COALESCE(vm_num_sci(points_earnt_opat), 0) + COALESCE(vm_num_sci(points_earnt_delivery), 0) > 0
),
scoped AS (
  SELECT DISTINCT store AS scope, week_start, uuid FROM e
  UNION
  SELECT 'All stores', week_start, uuid FROM e
),
firsts AS (
  SELECT scope, uuid, min(week_start) AS first_week FROM scoped GROUP BY scope, uuid
),
last_loaded AS (
  SELECT max(week_start) AS last_week FROM vm_v_loyalty_weeks
),
member AS (
  SELECT
    f.scope, f.uuid, f.first_week,
    min(s.week_start) FILTER (WHERE s.week_start > f.first_week) AS next_week
  FROM firsts f
  LEFT JOIN scoped s ON s.scope = f.scope AND s.uuid = f.uuid
  GROUP BY f.scope, f.uuid, f.first_week
)
SELECT
  m.scope AS store,
  date_trunc('month', m.first_week)::date                    AS cohort_month,
  to_char(date_trunc('month', m.first_week), 'Mon YYYY')     AS cohort_label,
  COUNT(*)                                                   AS members,
  COUNT(*) FILTER (WHERE m.first_week + 14 <= l.last_week)   AS eligible_2w,
  COUNT(*) FILTER (WHERE m.first_week + 14 <= l.last_week AND m.next_week <= m.first_week + 14) AS back_2w,
  COUNT(*) FILTER (WHERE m.first_week + 28 <= l.last_week)   AS eligible_4w,
  COUNT(*) FILTER (WHERE m.first_week + 28 <= l.last_week AND m.next_week <= m.first_week + 28) AS back_4w,
  COUNT(*) FILTER (WHERE m.first_week + 56 <= l.last_week)   AS eligible_8w,
  COUNT(*) FILTER (WHERE m.first_week + 56 <= l.last_week AND m.next_week <= m.first_week + 56) AS back_8w,
  COUNT(*) FILTER (WHERE m.first_week + 84 <= l.last_week)   AS eligible_12w,
  COUNT(*) FILTER (WHERE m.first_week + 84 <= l.last_week AND m.next_week <= m.first_week + 84) AS back_12w,
  COUNT(*) FILTER (WHERE m.next_week IS NOT NULL)            AS back_ever,
  max(l.last_week)                                           AS data_to_week
FROM member m CROSS JOIN last_loaded l
GROUP BY m.scope, date_trunc('month', m.first_week);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_vm_loyalty_cohorts_pk
  ON mv_vm_loyalty_cohorts (store, cohort_month);


-- ---------------------------------------------------------------------------
-- 3. ORDER PROFILE — one scan of vm_detailed_sales_info, rolled up to orders,
--    every order tagged member / non-member exactly as vm_v_loyalty_member_sales
--    does. Long format: (dimension, bucket) rows per store-week.
--      channel     — ALL orders: Delivery apps / Own delivery / Click & Collect /
--                    Kiosk / Till / Other
--      value_band  — IN-STORE orders (Kiosk + Till) by amount paid
--      weekday     — IN-STORE orders by London day of week
--      daypart     — IN-STORE orders by London time of day
--      item        — IN-STORE orders containing each menu item
--      reward_gamma / reward_beta — the free item chosen on reward orders
--                    (any channel; is_member always true)
--    In store is the only place joining is the customer's choice: delivery-app
--    customers can never be members and every Peckers-app order is one.
-- ---------------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_vm_loyalty_order_profile AS
WITH lines AS (
  SELECT
    store, week_start,
    btrim(order_uuid)   AS order_uuid,
    btrim(customer_id)  AS customer_id,
    CASE WHEN created_at ~ '^\d{4}-\d{2}-\d{2}[ T]' THEN created_at::timestamptz END AS created_at,
    lower(btrim(coalesce(create_source, '')))  AS create_source,
    lower(btrim(coalesce(payment_method, ''))) AS payment_method,
    NULLIF(btrim(coalesce(menu_name, '')), '') AS menu_name,
    vm_loyalty_reward_type(promotion_name)     AS reward_type,
    abs(COALESCE(vm_num_sci(discounts), 0))    AS discount,
    COALESCE(vm_num_sci(gross_sales), 0)       AS gross_sales,
    COALESCE(vm_num_sci(net_sales), 0)         AS net_sales
  FROM vm_detailed_sales_info
  WHERE store IS NOT NULL AND week_start IS NOT NULL
    AND btrim(coalesce(order_uuid, '')) <> ''
),
orders AS (
  SELECT
    store, week_start, order_uuid,
    min(customer_id)   AS customer_id,
    min(created_at)    AS created_at,
    min(create_source) AS create_source,
    bool_or(payment_method IN ('deliveroointegration', 'just-eat', 'ubereats')) AS delivery_app,
    SUM(gross_sales)   AS gross_sales,
    SUM(net_sales)     AS net_sales
  FROM lines
  GROUP BY store, week_start, order_uuid
),
members AS (
  SELECT 'Peckers_' || uid AS customer_id, min(registered_at) AS registered_at
  FROM (
    SELECT btrim(user_uuid) AS uid,
           CASE WHEN registered_at ~ '^\d{4}-\d{2}-\d{2}[ T]' THEN registered_at::timestamptz END AS registered_at
    FROM vm_loyalty_users WHERE lower(btrim(user_role)) = 'customer'
    UNION ALL SELECT btrim(uuid),      NULL FROM vm_loyalty_earnt_redeemed
    UNION ALL SELECT btrim(user_uuid), NULL FROM vm_loyalty_lifetime_per_customer
    UNION ALL SELECT btrim(user_uuid), NULL FROM vm_loyalty_per_customer
  ) x
  WHERE coalesce(uid, '') <> ''
  GROUP BY uid
),
tagged AS (
  SELECT
    o.*,
    (m.customer_id IS NOT NULL
      AND o.week_start >= DATE '2026-04-13'
      AND (m.registered_at IS NULL OR o.created_at IS NULL OR o.created_at >= m.registered_at)) AS is_member,
    CASE
      WHEN o.delivery_app               THEN 'Delivery apps'
      WHEN o.create_source = 'delivery' THEN 'Own delivery'
      WHEN o.create_source = 'online'   THEN 'Click & Collect'
      WHEN o.create_source = 'kiosk'    THEN 'Kiosk'
      WHEN o.create_source = 'pos'      THEN 'Till'
      ELSE 'Other'
    END AS channel,
    (o.created_at AT TIME ZONE 'Europe/London') AS local_at
  FROM orders o
  LEFT JOIN members m ON m.customer_id = o.customer_id
),
in_store AS (
  SELECT * FROM tagged WHERE channel IN ('Kiosk', 'Till')
),
facts AS (
  SELECT store, week_start, 'channel'::text AS dimension, channel AS bucket,
         CASE channel WHEN 'Delivery apps' THEN 1 WHEN 'Own delivery' THEN 2 WHEN 'Click & Collect' THEN 3
                      WHEN 'Kiosk' THEN 4 WHEN 'Till' THEN 5 ELSE 6 END AS bucket_rank,
         is_member, order_uuid, net_sales
  FROM tagged
  UNION ALL
  SELECT store, week_start, 'value_band',
         CASE WHEN gross_sales < 8  THEN 'Under £8'
              WHEN gross_sales < 10 THEN '£8–£9.99'
              WHEN gross_sales < 12 THEN '£10–£11.99'
              WHEN gross_sales < 14 THEN '£12–£13.99'
              WHEN gross_sales < 16 THEN '£14–£15.99'
              WHEN gross_sales < 20 THEN '£16–£19.99'
              ELSE '£20+' END,
         CASE WHEN gross_sales < 8 THEN 1 WHEN gross_sales < 10 THEN 2 WHEN gross_sales < 12 THEN 3
              WHEN gross_sales < 14 THEN 4 WHEN gross_sales < 16 THEN 5 WHEN gross_sales < 20 THEN 6 ELSE 7 END,
         is_member, order_uuid, net_sales
  FROM in_store
  UNION ALL
  SELECT store, week_start, 'weekday', to_char(local_at, 'Dy'), EXTRACT(isodow FROM local_at)::int,
         is_member, order_uuid, net_sales
  FROM in_store WHERE local_at IS NOT NULL
  UNION ALL
  SELECT store, week_start, 'daypart',
         CASE WHEN EXTRACT(hour FROM local_at) < 11 THEN 'Before 11am'
              WHEN EXTRACT(hour FROM local_at) < 14 THEN 'Lunch 11–2'
              WHEN EXTRACT(hour FROM local_at) < 17 THEN 'Afternoon 2–5'
              WHEN EXTRACT(hour FROM local_at) < 21 THEN 'Evening 5–9'
              ELSE 'Late 9pm+' END,
         CASE WHEN EXTRACT(hour FROM local_at) < 11 THEN 1 WHEN EXTRACT(hour FROM local_at) < 14 THEN 2
              WHEN EXTRACT(hour FROM local_at) < 17 THEN 3 WHEN EXTRACT(hour FROM local_at) < 21 THEN 4 ELSE 5 END,
         is_member, order_uuid, net_sales
  FROM in_store WHERE local_at IS NOT NULL
  UNION ALL
  SELECT DISTINCT l.store, l.week_start, 'item', l.menu_name, 0, t.is_member, l.order_uuid, 0::numeric
  FROM lines l
  JOIN in_store t ON t.store = l.store AND t.week_start = l.week_start AND t.order_uuid = l.order_uuid
  WHERE l.menu_name IS NOT NULL
  UNION ALL
  SELECT DISTINCT store, week_start, 'reward_' || reward_type, menu_name, 0, true, order_uuid, 0::numeric
  FROM lines
  WHERE reward_type IN ('gamma', 'beta') AND discount > 0 AND menu_name IS NOT NULL
)
SELECT
  COALESCE(store, 'All stores') AS store,
  week_start,
  week_start::text              AS week_start_iso,
  dimension, bucket, bucket_rank, is_member,
  COUNT(DISTINCT order_uuid)    AS orders,
  SUM(net_sales)                AS net_sales
FROM facts
GROUP BY GROUPING SETS ((store, week_start, dimension, bucket, bucket_rank, is_member),
                        (week_start, dimension, bucket, bucket_rank, is_member));

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_vm_loyalty_order_profile_pk
  ON mv_vm_loyalty_order_profile (store, week_start, dimension, bucket, is_member);


-- ---------------------------------------------------------------------------
-- 4. SIGN-UP ACTIVATION — per sign-up week: how many new accounts went on to
--    earn a head from an order (at any store) that week, within 4 weeks, ever.
--    Store = the account's VM store (see the Hitchin launch-week caveat).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW vm_v_loyalty_activation AS
WITH su AS (
  SELECT DISTINCT ON (btrim(user_uuid)) store, week_start, btrim(user_uuid) AS uuid
  FROM vm_loyalty_users
  WHERE store IS NOT NULL AND week_start IS NOT NULL
    AND lower(btrim(user_role)) = 'customer'
    AND btrim(coalesce(user_uuid, '')) <> ''
  ORDER BY btrim(user_uuid), week_start
),
first_visit AS (
  SELECT btrim(user_uuid) AS uuid, min(week_start) AS first_week
  FROM vm_loyalty_per_customer
  WHERE COALESCE(vm_num_sci(points_earnt_click_collect), 0) + COALESCE(vm_num_sci(points_earnt_kiosk), 0)
      + COALESCE(vm_num_sci(points_earnt_opat), 0) + COALESCE(vm_num_sci(points_earnt_delivery), 0) > 0
  GROUP BY btrim(user_uuid)
),
agg AS (
  SELECT
    COALESCE(su.store, 'All stores') AS store,
    su.week_start,
    COUNT(*)                                                                    AS signups,
    COUNT(*) FILTER (WHERE fv.first_week = su.week_start)                       AS visited_same_week,
    COUNT(*) FILTER (WHERE fv.first_week BETWEEN su.week_start AND su.week_start + 21) AS visited_4w,
    COUNT(*) FILTER (WHERE fv.first_week IS NOT NULL)                           AS visited_ever
  FROM su
  LEFT JOIN first_visit fv ON fv.uuid = su.uuid
  GROUP BY GROUPING SETS ((su.store, su.week_start), (su.week_start))
)
SELECT
  w.store, w.week_start, w.week_end, w.week_start_iso, w.pre_launch,
  COALESCE(a.signups, 0)           AS signups,
  COALESCE(a.visited_same_week, 0) AS visited_same_week,
  COALESCE(a.visited_4w, 0)        AS visited_4w,
  COALESCE(a.visited_ever, 0)      AS visited_ever,
  -- Whether all 4 weeks after sign-up are in the data yet.
  (w.week_start + 21 <= (SELECT max(week_start) FROM vm_v_loyalty_weeks)) AS window_4w_complete
FROM vm_v_loyalty_weeks w
LEFT JOIN agg a ON a.store = w.store AND a.week_start = w.week_start;


-- ---------------------------------------------------------------------------
-- 5. WIN-BACK (snapshot) — engaged members close to, or holding, a free meal,
--    and how many of them have gone quiet. Balance is what the app shows the
--    customer (including the starting head). Quiet = no activity in the 21
--    days before the snapshot was taken.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW vm_v_loyalty_winback AS
WITH snap AS (
  SELECT
    store, week_start, btrim(uuid) AS uuid,
    COALESCE(vm_num_sci(current_balance), 0) AS balance,
    CASE WHEN last_activity_date ~ '^\d{4}-\d{2}-\d{2}[ T]' THEN last_activity_date::timestamptz END AS last_activity,
    max(ingested_at::timestamptz) OVER (PARTITION BY store, week_start) AS as_of
  FROM vm_loyalty_earnt_redeemed
  WHERE store IS NOT NULL AND week_start IS NOT NULL
    AND btrim(coalesce(uuid, '')) <> ''
),
m AS (
  SELECT *, (last_activity = TIMESTAMPTZ '2026-04-14 01:00:03+00') AS bulk_import,
         (last_activity IS NULL OR last_activity < as_of - interval '21 days') AS quiet_21d
  FROM snap
)
SELECT
  COALESCE(store, 'All stores') AS store,
  week_start,
  week_start::text              AS week_start_iso,
  COUNT(DISTINCT uuid) FILTER (WHERE NOT bulk_import AND balance BETWEEN 7 AND 9)               AS near_reward,
  COUNT(DISTINCT uuid) FILTER (WHERE NOT bulk_import AND balance BETWEEN 7 AND 9 AND quiet_21d) AS near_reward_quiet,
  COUNT(DISTINCT uuid) FILTER (WHERE NOT bulk_import AND balance >= 10)                         AS meal_ready,
  COUNT(DISTINCT uuid) FILTER (WHERE NOT bulk_import AND balance >= 10 AND quiet_21d)           AS meal_ready_quiet
FROM m
GROUP BY GROUPING SETS ((store, week_start), (week_start));


-- ---------------------------------------------------------------------------
-- 6. APP-FACING VIEWS over the materialized copies + the refresh hook.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW vm_v_loyalty_activity      AS SELECT * FROM mv_vm_loyalty_activity;
CREATE OR REPLACE VIEW vm_v_loyalty_cohorts       AS SELECT * FROM mv_vm_loyalty_cohorts;
CREATE OR REPLACE VIEW vm_v_loyalty_order_profile AS SELECT * FROM mv_vm_loyalty_order_profile;

-- Refreshes EVERY mv_vm_loyalty_* that exists, so the vm-extractor's existing
-- call picks these up with no extractor change, and re-running either SQL
-- file in either order leaves the same function. CONCURRENTLY keeps the
-- dashboard readable during the refresh (each matview has a unique index).
CREATE OR REPLACE FUNCTION vm_refresh_loyalty_snapshots()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mv record;
BEGIN
  FOR mv IN
    SELECT matviewname FROM pg_matviews
    WHERE schemaname = 'public' AND matviewname LIKE 'mv\_vm\_loyalty\_%'
    ORDER BY matviewname
  LOOP
    EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY public.%I', mv.matviewname);
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION vm_refresh_loyalty_snapshots() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON mv_vm_loyalty_activity, mv_vm_loyalty_cohorts, mv_vm_loyalty_order_profile
  FROM anon, authenticated;

GRANT SELECT ON
  vm_v_loyalty_activity,
  vm_v_loyalty_cohorts,
  vm_v_loyalty_order_profile,
  vm_v_loyalty_activation,
  vm_v_loyalty_winback
TO anon, authenticated;
