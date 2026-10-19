-- ===========================================================================
-- vm_loyalty_views.sql — Loyalty Customers dashboard (VM Analytics, Update 257)
-- ---------------------------------------------------------------------------
-- Run in the VM Supabase project's SQL editor (the one holding the vm_* raw
-- tables), NOT the cashflow project. Requires kpi_views.sql (vm_num) first.
-- Idempotent: CREATE OR REPLACE throughout; safe to re-run after each sync.
--
-- Data brief: vm-extractor/docs/loyalty-dashboard-brief.md
--
-- Conventions (why they matter here):
--   * Every view is AGGREGATED (store/week/channel/promotion/tier). They are
--     granted to anon, so no uuid-level row may ever leave these views.
--   * Every view also emits a store = 'All stores' row per week, computed in
--     SQL. Distinct-person counts (earners, member customers) and ratios
--     (redemption rate, AOV, shares) can't be summed across stores in the app
--     without double counting, so the page reads the estate row instead.
--   * Weekly views LEFT JOIN onto vm_v_loyalty_weeks, so a week with no rows
--     reads 0 (pre-launch, or no redemptions), never missing.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 0. HELPERS
-- ---------------------------------------------------------------------------

-- vm_num strips every non-digit, so '0E-17' becomes 17 (brief §5). Plain and
-- scientific-notation numerics are cast directly; anything else (currency,
-- commas, %) falls back to vm_num. public.vm_num is schema-qualified because
-- materialized-view builds/refreshes run with search_path = pg_catalog
-- (Postgres 17), where an unqualified vm_num isn't found.
CREATE OR REPLACE FUNCTION vm_num_sci(t text)
RETURNS numeric
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN btrim(coalesce(t, '')) ~ '^-?([0-9]+\.?[0-9]*|\.[0-9]+)([eE][-+]?[0-9]+)?$'
      THEN btrim(t)::numeric
    ELSE public.vm_num(t)
  END;
$$;

-- A discount / promotion name -> reward bucket. 'birthday' (Free Churros) is
-- provisional until the verify output confirms the promotion name.
CREATE OR REPLACE FUNCTION vm_loyalty_reward_type(name text)
RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN lower(btrim(coalesce(name, ''))) LIKE 'loyalty gamma%'               THEN 'gamma'
    WHEN lower(btrim(coalesce(name, ''))) LIKE 'loyalty beta%'                THEN 'beta'
    WHEN lower(btrim(coalesce(name, ''))) LIKE 'loyalty alpha%'               THEN 'alpha'
    WHEN lower(btrim(coalesce(name, ''))) LIKE '%free milkshake for signup%'  THEN 'signup'
    WHEN lower(btrim(coalesce(name, ''))) LIKE 'free churros%'                THEN 'birthday'
  END;
$$;


-- ---------------------------------------------------------------------------
-- 1. WEEK SERIES — every Monday from 2026-03-02 to the latest loaded week,
--    for each store plus 'All stores'. Stores are listed explicitly (they
--    mirror STORES in lib/vm-analytics/constants.ts) rather than derived, so
--    a store with no loyalty rows in a week still gets its zero row.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW vm_v_loyalty_weeks AS
WITH bounds AS (
  SELECT GREATEST(
    (SELECT max(week_start) FROM vm_detailed_sales_info     WHERE store IS NOT NULL),
    (SELECT max(week_start) FROM vm_loyalty_users           WHERE store IS NOT NULL),
    (SELECT max(week_start) FROM vm_discounts_info_customer WHERE store IS NOT NULL),
    (SELECT max(week_start) FROM vm_loyalty_per_customer    WHERE store IS NOT NULL)
  ) AS last_week
)
SELECT
  s.store,
  gs::date                       AS week_start,
  (gs::date + 6)                 AS week_end,
  gs::date::text                 AS week_start_iso,
  -- The scheme launched Tue 2026-04-14, i.e. in the week of 2026-04-13.
  (gs::date < DATE '2026-04-13') AS pre_launch
FROM bounds
CROSS JOIN generate_series(DATE '2026-03-02', bounds.last_week, interval '7 days') gs
CROSS JOIN (VALUES ('Peckers Hitchin'), ('Peckers Stevenage'), ('All stores')) s(store)
WHERE bounds.last_week IS NOT NULL;


-- ---------------------------------------------------------------------------
-- 2. SIGN-UPS — new customer accounts registered per week.
--    Hitchin is credited with ~590–815 a week from launch vs Stevenage's
--    ~30–75 (VM Hub attribution, unconfirmed) — the page caveats this.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW vm_v_loyalty_signups AS
WITH u AS (
  SELECT
    COALESCE(store, 'All stores')  AS store,
    week_start,
    COUNT(DISTINCT btrim(user_uuid)) AS signups
  FROM vm_loyalty_users
  WHERE store IS NOT NULL AND week_start IS NOT NULL
    AND lower(btrim(user_role)) = 'customer'
    AND btrim(coalesce(user_uuid, '')) <> ''
  GROUP BY GROUPING SETS ((store, week_start), (week_start))
),
s AS (
  SELECT w.store, w.week_start, w.week_end, w.week_start_iso, w.pre_launch,
         COALESCE(u.signups, 0) AS signups
  FROM vm_v_loyalty_weeks w
  LEFT JOIN u ON u.store = w.store AND u.week_start = w.week_start
)
SELECT
  s.*,
  LAG(signups) OVER w AS prev_signups,
  ROUND(100.0 * (signups - LAG(signups) OVER w) / NULLIF(LAG(signups) OVER w, 0), 1) AS signups_wow_pct,
  SUM(signups) OVER (PARTITION BY store ORDER BY week_start) AS cumulative_signups
FROM s
WINDOW w AS (PARTITION BY store ORDER BY week_start);


-- ---------------------------------------------------------------------------
-- 3. POINTS — earned / redeemed per store-week, from vm_loyalty_per_customer
--    (real points, not the per-channel SHARES table). No rows before the
--    2026-04-13 week: the scheme hadn't launched.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW vm_v_loyalty_points_weekly AS
WITH pc AS (
  SELECT
    store, week_start, btrim(user_uuid) AS user_uuid,
    COALESCE(vm_num_sci(points_earnt_click_collect), 0)    AS e_cc,
    COALESCE(vm_num_sci(points_earnt_kiosk), 0)            AS e_kiosk,
    COALESCE(vm_num_sci(points_earnt_opat), 0)             AS e_opat,
    COALESCE(vm_num_sci(points_earnt_delivery), 0)         AS e_delivery,
    COALESCE(vm_num_sci(points_redeemed_click_collect), 0) AS r_cc,
    COALESCE(vm_num_sci(points_redeemed_kiosk), 0)         AS r_kiosk,
    COALESCE(vm_num_sci(points_redeemed_opat), 0)          AS r_opat,
    COALESCE(vm_num_sci(points_redeemed_delivery), 0)      AS r_delivery
  FROM vm_loyalty_per_customer
  WHERE store IS NOT NULL AND week_start IS NOT NULL
    AND btrim(coalesce(user_uuid, '')) <> ''
),
agg AS (
  SELECT
    COALESCE(store, 'All stores') AS store,
    week_start,
    COUNT(DISTINCT user_uuid) FILTER (WHERE e_cc + e_kiosk + e_opat + e_delivery > 0) AS active_earners,
    COUNT(DISTINCT user_uuid) FILTER (WHERE r_cc + r_kiosk + r_opat + r_delivery > 0) AS active_redeemers,
    COUNT(DISTINCT user_uuid)                                                         AS active_members,
    SUM(e_cc + e_kiosk + e_opat + e_delivery) AS points_earnt,
    SUM(r_cc + r_kiosk + r_opat + r_delivery) AS points_redeemed
  FROM pc
  GROUP BY GROUPING SETS ((store, week_start), (week_start))
),
s AS (
  SELECT
    w.store, w.week_start, w.week_end, w.week_start_iso, w.pre_launch,
    COALESCE(a.active_earners, 0)   AS active_earners,
    COALESCE(a.active_redeemers, 0) AS active_redeemers,
    COALESCE(a.active_members, 0)   AS active_members,
    COALESCE(a.points_earnt, 0)     AS points_earnt,
    COALESCE(a.points_redeemed, 0)  AS points_redeemed
  FROM vm_v_loyalty_weeks w
  LEFT JOIN agg a ON a.store = w.store AND a.week_start = w.week_start
)
SELECT
  s.*,
  ROUND(points_redeemed / NULLIF(points_earnt, 0), 4) AS redemption_rate,
  LAG(active_earners)  OVER w AS prev_active_earners,
  LAG(points_earnt)    OVER w AS prev_points_earnt,
  LAG(points_redeemed) OVER w AS prev_points_redeemed,
  ROUND(100.0 * (active_earners  - LAG(active_earners)  OVER w) / NULLIF(LAG(active_earners)  OVER w, 0), 1) AS active_earners_wow_pct,
  ROUND(100.0 * (points_earnt    - LAG(points_earnt)    OVER w) / NULLIF(LAG(points_earnt)    OVER w, 0), 1) AS points_earnt_wow_pct,
  ROUND(100.0 * (points_redeemed - LAG(points_redeemed) OVER w) / NULLIF(LAG(points_redeemed) OVER w, 0), 1) AS points_redeemed_wow_pct
FROM s
WINDOW w AS (PARTITION BY store ORDER BY week_start);


-- ---------------------------------------------------------------------------
-- 4. POINTS BY CHANNEL — one row per store-week-channel. Shares are derived
--    from points here, never summed from vm_loyalty_per_channel's shares.
--    (That table's 'pos' channel has no per-customer equivalent, so the two
--    don't reconcile exactly — brief §2.)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW vm_v_loyalty_points_channel AS
WITH pc AS (
  SELECT store, week_start, c.channel, c.channel_rank, c.earnt, c.redeemed
  FROM vm_loyalty_per_customer p
  CROSS JOIN LATERAL (VALUES
    ('Click & Collect',      1, vm_num_sci(p.points_earnt_click_collect), vm_num_sci(p.points_redeemed_click_collect)),
    ('Kiosk',                2, vm_num_sci(p.points_earnt_kiosk),         vm_num_sci(p.points_redeemed_kiosk)),
    ('Order & Pay at Table', 3, vm_num_sci(p.points_earnt_opat),          vm_num_sci(p.points_redeemed_opat)),
    ('Delivery',             4, vm_num_sci(p.points_earnt_delivery),      vm_num_sci(p.points_redeemed_delivery))
  ) AS c(channel, channel_rank, earnt, redeemed)
  WHERE p.store IS NOT NULL AND p.week_start IS NOT NULL
),
agg AS (
  SELECT
    COALESCE(store, 'All stores') AS store,
    week_start, channel,
    SUM(COALESCE(earnt, 0))    AS points_earnt,
    SUM(COALESCE(redeemed, 0)) AS points_redeemed
  FROM pc
  GROUP BY GROUPING SETS ((store, week_start, channel), (week_start, channel))
),
s AS (
  SELECT
    w.store, w.week_start, w.week_end, w.week_start_iso, w.pre_launch,
    ch.channel, ch.channel_rank,
    COALESCE(a.points_earnt, 0)    AS points_earnt,
    COALESCE(a.points_redeemed, 0) AS points_redeemed
  FROM vm_v_loyalty_weeks w
  CROSS JOIN (VALUES ('Click & Collect', 1), ('Kiosk', 2), ('Order & Pay at Table', 3), ('Delivery', 4))
    AS ch(channel, channel_rank)
  LEFT JOIN agg a ON a.store = w.store AND a.week_start = w.week_start AND a.channel = ch.channel
)
SELECT
  s.*,
  ROUND(points_earnt    / NULLIF(SUM(points_earnt)    OVER sw, 0), 4) AS earnt_share,
  -- NULL (not 0) when nobody redeemed that store-week: "no redemptions".
  ROUND(points_redeemed / NULLIF(SUM(points_redeemed) OVER sw, 0), 4) AS redeemed_share
FROM s
WINDOW sw AS (PARTITION BY store, week_start);


-- ---------------------------------------------------------------------------
-- 5. DISCOUNTED ORDERS BY DISCOUNT NAME — per store-week-discount: orders,
--    cost, net sales, with WoW against the same discount's PREVIOUS calendar
--    week (self-join, not LAG — a discount unused for a week has no row, and
--    LAG would compare against an older week).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW vm_v_loyalty_discount_orders AS
WITH d AS (
  SELECT
    store, week_start,
    btrim(order_uuid)                                   AS order_uuid,
    COALESCE(NULLIF(btrim(discount_name), ''), '(unnamed)') AS discount_name,
    abs(COALESCE(vm_num_sci(discounts), 0))             AS discount_cost,
    COALESCE(vm_num_sci(net_sales), 0)                  AS net_sales,
    COALESCE(vm_num_sci(gross_sales_before_discounts_and_refunds), 0) AS gross_before_discounts
  FROM vm_discounts_info_customer
  WHERE store IS NOT NULL AND week_start IS NOT NULL
    AND btrim(coalesce(order_uuid, '')) <> ''
),
agg AS (
  SELECT
    COALESCE(store, 'All stores') AS store,
    week_start, discount_name,
    COUNT(DISTINCT order_uuid)  AS orders,
    SUM(discount_cost)          AS discount_cost,
    SUM(net_sales)              AS net_sales,
    SUM(gross_before_discounts) AS gross_before_discounts
  FROM d
  GROUP BY GROUPING SETS ((store, week_start, discount_name), (week_start, discount_name))
)
SELECT
  a.store, a.week_start, (a.week_start + 6) AS week_end, a.week_start::text AS week_start_iso,
  a.discount_name,
  vm_loyalty_reward_type(a.discount_name) AS reward_type,
  a.orders, a.discount_cost, a.net_sales, a.gross_before_discounts,
  p.orders        AS prev_orders,
  p.discount_cost AS prev_discount_cost,
  p.net_sales     AS prev_net_sales,
  ROUND(100.0 * (a.orders        - p.orders)        / NULLIF(p.orders, 0), 1)        AS orders_wow_pct,
  ROUND(100.0 * (a.discount_cost - p.discount_cost) / NULLIF(p.discount_cost, 0), 1) AS discount_cost_wow_pct
FROM agg a
LEFT JOIN agg p
  ON p.store = a.store AND p.discount_name = a.discount_name AND p.week_start = a.week_start - 7;


-- ---------------------------------------------------------------------------
-- 6. PROMOTIONS (VM's own per-promotion totals) — vm_sales_by_discount_type.
--    Kept alongside view 5 because its names differ (e.g. "Loyalty Beta" vs
--    "Loyalty Beta - pick one (…)") and it carries gross_sales_generated.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW vm_v_loyalty_promotions_weekly AS
WITH p AS (
  SELECT
    store, week_start,
    COALESCE(NULLIF(btrim(promotion_name), ''), '(unnamed)') AS promotion_name,
    COALESCE(vm_num_sci(gross_sales_generated), 0)           AS gross_sales_generated,
    abs(COALESCE(vm_num_sci(total_discounts), 0))            AS discount_cost
  FROM vm_sales_by_discount_type
  WHERE store IS NOT NULL AND week_start IS NOT NULL
),
agg AS (
  SELECT
    COALESCE(store, 'All stores') AS store,
    week_start, promotion_name,
    SUM(gross_sales_generated) AS gross_sales_generated,
    SUM(discount_cost)         AS discount_cost
  FROM p
  GROUP BY GROUPING SETS ((store, week_start, promotion_name), (week_start, promotion_name))
)
SELECT
  a.store, a.week_start, (a.week_start + 6) AS week_end, a.week_start::text AS week_start_iso,
  a.promotion_name,
  vm_loyalty_reward_type(a.promotion_name) AS reward_type,
  a.gross_sales_generated, a.discount_cost,
  p.gross_sales_generated AS prev_gross_sales_generated,
  p.discount_cost         AS prev_discount_cost,
  ROUND(100.0 * (a.discount_cost - p.discount_cost) / NULLIF(p.discount_cost, 0), 1) AS discount_cost_wow_pct
FROM agg a
LEFT JOIN agg p
  ON p.store = a.store AND p.promotion_name = a.promotion_name AND p.week_start = a.week_start - 7;


-- ---------------------------------------------------------------------------
-- 7. REWARD REDEMPTIONS BY TIER — dense: every week × every reward type.
--    Alpha is also rung through "Alpha …" SKUs (Update 119). An order is
--    counted once per tier: SKU-only Alpha orders are added only when the
--    same order has no "Loyalty Alpha" discount. Their cost is the SKU line's
--    recorded discount, usually ~0 — the free meal is priced into the SKU.
-- ---------------------------------------------------------------------------
-- Defined as *_live; the app reads the materialized copy (section 11).
CREATE OR REPLACE VIEW vm_v_loyalty_rewards_weekly_live AS
WITH disc AS (
  SELECT
    store, week_start,
    btrim(order_uuid)                       AS order_uuid,
    vm_loyalty_reward_type(discount_name)   AS reward_type,
    abs(COALESCE(vm_num_sci(discounts), 0)) AS cost,
    COALESCE(vm_num_sci(net_sales), 0)      AS net_sales
  FROM vm_discounts_info_customer
  WHERE store IS NOT NULL AND week_start IS NOT NULL
    AND btrim(coalesce(order_uuid, '')) <> ''
    AND vm_loyalty_reward_type(discount_name) IS NOT NULL
),
alpha_lines AS (
  SELECT store, week_start, btrim(order_uuid) AS order_uuid,
         abs(COALESCE(vm_num_sci(discounts), 0)) AS cost,
         COALESCE(vm_num_sci(net_sales), 0)      AS net_sales
  FROM vm_detailed_sales_info
  WHERE store IS NOT NULL AND week_start IS NOT NULL
    AND btrim(coalesce(order_uuid, '')) <> ''
    AND lower(btrim(menu_name)) LIKE 'alpha %'
),
alpha_sku AS (
  SELECT store, week_start, order_uuid, SUM(cost) AS cost, SUM(net_sales) AS net_sales
  FROM alpha_lines a
  WHERE NOT EXISTS (
    SELECT 1 FROM disc d WHERE d.order_uuid = a.order_uuid AND d.reward_type = 'alpha'
  )
  GROUP BY store, week_start, order_uuid
),
ro AS (
  SELECT store, week_start, order_uuid, reward_type, cost, net_sales, false AS via_sku FROM disc
  UNION ALL
  SELECT store, week_start, order_uuid, 'alpha', cost, net_sales, true FROM alpha_sku
),
agg AS (
  SELECT
    COALESCE(store, 'All stores') AS store,
    week_start, reward_type,
    COUNT(DISTINCT order_uuid)                     AS redemptions,
    COUNT(DISTINCT order_uuid) FILTER (WHERE via_sku) AS sku_only_redemptions,
    SUM(cost)      AS reward_cost,
    SUM(net_sales) AS net_sales
  FROM ro
  GROUP BY GROUPING SETS ((store, week_start, reward_type), (week_start, reward_type))
),
s AS (
  SELECT
    w.store, w.week_start, w.week_end, w.week_start_iso, w.pre_launch,
    t.reward_type, t.reward_label, t.reward_rank,
    COALESCE(a.redemptions, 0)          AS redemptions,
    COALESCE(a.sku_only_redemptions, 0) AS sku_only_redemptions,
    COALESCE(a.reward_cost, 0)          AS reward_cost,
    COALESCE(a.net_sales, 0)            AS net_sales
  FROM vm_v_loyalty_weeks w
  CROSS JOIN (VALUES
    ('gamma',    'Gamma — free side',  1),
    ('beta',     'Beta — free main',   2),
    ('alpha',    'Alpha — free meal',  3),
    ('signup',   'Sign-up milkshake',  4),
    ('birthday', 'Birthday churros',   5)
  ) AS t(reward_type, reward_label, reward_rank)
  LEFT JOIN agg a ON a.store = w.store AND a.week_start = w.week_start AND a.reward_type = t.reward_type
)
SELECT
  s.*,
  LAG(redemptions) OVER w AS prev_redemptions,
  LAG(reward_cost) OVER w AS prev_reward_cost,
  ROUND(100.0 * (redemptions - LAG(redemptions) OVER w) / NULLIF(LAG(redemptions) OVER w, 0), 1) AS redemptions_wow_pct,
  ROUND(100.0 * (reward_cost - LAG(reward_cost) OVER w) / NULLIF(LAG(reward_cost) OVER w, 0), 1) AS reward_cost_wow_pct
FROM s
WINDOW w AS (PARTITION BY store, reward_type ORDER BY week_start);


-- ---------------------------------------------------------------------------
-- 8. MEMBERS vs NON-MEMBERS + DISCOUNT PENETRATION — one scan of
--    vm_detailed_sales_info (one row per ORDER LINE), rolled up to orders
--    first so nothing is double counted.
--    A member order = customer_id is 'Peckers_' || a loyalty uuid, the week is
--    on/after launch, and (where we know when they registered) the order was
--    placed after registering. Member columns are NULL pre-launch.
--    Returning member = ordered this week AND placed a member order in an
--    earlier week (anywhere, since launch).
-- ---------------------------------------------------------------------------
-- Defined as *_live; the app reads the materialized copy (section 11) —
-- computed live this took 3.1s (EXPLAIN ANALYZE, 2026-10-16).
CREATE OR REPLACE VIEW vm_v_loyalty_member_sales_live AS
WITH lines AS (
  SELECT
    store, week_start,
    btrim(order_uuid)  AS order_uuid,
    btrim(customer_id) AS customer_id,
    CASE WHEN created_at ~ '^\d{4}-\d{2}-\d{2}[ T]' THEN created_at::timestamptz END AS created_at,
    COALESCE(vm_num_sci(net_sales), 0) AS net_sales
  FROM vm_detailed_sales_info
  WHERE store IS NOT NULL AND week_start IS NOT NULL
    AND btrim(coalesce(order_uuid, '')) <> ''
),
orders AS (
  SELECT store, week_start, order_uuid,
         min(customer_id) AS customer_id,
         min(created_at)  AS created_at,
         SUM(net_sales)   AS net_sales
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
discounted AS (
  SELECT DISTINCT btrim(order_uuid) AS order_uuid
  FROM vm_discounts_info_customer
  WHERE store IS NOT NULL AND btrim(coalesce(order_uuid, '')) <> ''
),
tagged AS (
  SELECT
    o.*,
    (m.customer_id IS NOT NULL
      AND o.week_start >= DATE '2026-04-13'
      AND (m.registered_at IS NULL OR o.created_at IS NULL OR o.created_at >= m.registered_at)) AS is_member,
    (dd.order_uuid IS NOT NULL) AS is_discounted
  FROM orders o
  LEFT JOIN members m     ON m.customer_id = o.customer_id
  LEFT JOIN discounted dd ON dd.order_uuid = o.order_uuid
),
firsts AS (
  SELECT customer_id, min(week_start) AS first_member_week
  FROM tagged WHERE is_member
  GROUP BY customer_id
),
agg AS (
  SELECT
    COALESCE(t.store, 'All stores') AS store,
    t.week_start,
    COUNT(DISTINCT t.order_uuid)                                AS total_orders,
    SUM(t.net_sales)                                            AS total_net_sales,
    COUNT(DISTINCT t.order_uuid) FILTER (WHERE t.is_discounted) AS discounted_orders,
    COUNT(DISTINCT t.order_uuid) FILTER (WHERE t.is_member)     AS member_orders,
    COALESCE(SUM(t.net_sales) FILTER (WHERE t.is_member), 0)    AS member_net_sales,
    COUNT(DISTINCT t.customer_id) FILTER (WHERE t.is_member)    AS member_customers,
    COUNT(DISTINCT t.customer_id) FILTER (WHERE t.is_member AND f.first_member_week < t.week_start) AS returning_members
  FROM tagged t
  LEFT JOIN firsts f ON f.customer_id = t.customer_id
  GROUP BY GROUPING SETS ((t.store, t.week_start), (t.week_start))
),
s AS (
  SELECT
    w.store, w.week_start, w.week_end, w.week_start_iso, w.pre_launch,
    COALESCE(a.total_orders, 0)      AS total_orders,
    COALESCE(a.total_net_sales, 0)   AS total_net_sales,
    COALESCE(a.discounted_orders, 0) AS discounted_orders,
    CASE WHEN w.pre_launch THEN NULL ELSE COALESCE(a.member_orders, 0)     END AS member_orders,
    CASE WHEN w.pre_launch THEN NULL ELSE COALESCE(a.member_net_sales, 0)  END AS member_net_sales,
    CASE WHEN w.pre_launch THEN NULL ELSE COALESCE(a.member_customers, 0)  END AS member_customers,
    CASE WHEN w.pre_launch THEN NULL ELSE COALESCE(a.returning_members, 0) END AS returning_members
  FROM vm_v_loyalty_weeks w
  LEFT JOIN agg a ON a.store = w.store AND a.week_start = w.week_start
)
SELECT
  s.*,
  -- Pre-launch nobody was a member, so every order is a non-member order.
  total_orders    - COALESCE(member_orders, 0)    AS non_member_orders,
  total_net_sales - COALESCE(member_net_sales, 0) AS non_member_net_sales,
  ROUND(member_orders::numeric / NULLIF(total_orders, 0), 4)                       AS member_order_share,
  ROUND(member_net_sales / NULLIF(member_orders, 0), 2)                            AS member_aov,
  ROUND((total_net_sales - COALESCE(member_net_sales, 0))
        / NULLIF(total_orders - COALESCE(member_orders, 0), 0), 2)                 AS non_member_aov,
  ROUND(returning_members::numeric / NULLIF(member_customers, 0), 4)               AS member_repeat_rate,
  ROUND(discounted_orders::numeric / NULLIF(total_orders, 0), 4)                   AS discount_penetration,
  LAG(member_orders) OVER w AS prev_member_orders,
  ROUND(member_orders::numeric / NULLIF(total_orders, 0), 4)
    - LAG(ROUND(member_orders::numeric / NULLIF(total_orders, 0), 4)) OVER w       AS member_order_share_wow_pp
FROM s
WINDOW w AS (PARTITION BY store ORDER BY week_start);


-- ---------------------------------------------------------------------------
-- 9. MEMBER BASE (snapshot) — from vm_loyalty_earnt_redeemed. week_start is
--    the week being synced when the snapshot was taken; history starts at
--    2026-10-05 and can't be backfilled. "Lapsed" is measured from the
--    snapshot's own ingest time, not from today.
--    Tier counts are deliberately NOT here yet: thresholds are pending
--    confirmation of what current_balance measures (see view 10).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW vm_v_loyalty_member_base AS
WITH snap AS (
  SELECT
    store, week_start,
    btrim(uuid) AS uuid,
    COALESCE(vm_num_sci(balance_accrued), 0)  AS balance_accrued,
    COALESCE(vm_num_sci(balance_redeemed), 0) AS balance_redeemed,
    COALESCE(vm_num_sci(current_balance), 0)  AS current_balance,
    CASE WHEN last_activity_date ~ '^\d{4}-\d{2}-\d{2}[ T]' THEN last_activity_date::timestamptz END AS last_activity,
    max(ingested_at::timestamptz) OVER (PARTITION BY store, week_start) AS as_of
  FROM vm_loyalty_earnt_redeemed
  WHERE store IS NOT NULL AND week_start IS NOT NULL
    AND btrim(coalesce(uuid, '')) <> ''
),
flagged AS (
  SELECT
    *,
    -- 8,427 members carry exactly this timestamp: the launch bulk import,
    -- carried over with a balance and never active since.
    (last_activity = TIMESTAMPTZ '2026-04-14 01:00:03+00') AS bulk_import
  FROM snap
)
SELECT
  COALESCE(store, 'All stores')       AS store,
  week_start,
  (week_start + 6)                    AS week_end,
  week_start::text                    AS week_start_iso,
  max(as_of)                          AS as_of,
  COUNT(DISTINCT uuid)                                       AS total_members,
  COUNT(DISTINCT uuid) FILTER (WHERE bulk_import)            AS imported_members,
  COUNT(DISTINCT uuid) FILTER (WHERE NOT bulk_import)        AS active_members,
  COUNT(DISTINCT uuid) FILTER (WHERE NOT bulk_import AND last_activity >= as_of - interval '30 days') AS active_30d_members,
  COUNT(DISTINCT uuid) FILTER (WHERE NOT bulk_import AND last_activity <  as_of - interval '30 days') AS lapsed_members,
  SUM(current_balance)                                       AS points_liability,
  COALESCE(SUM(current_balance) FILTER (WHERE NOT bulk_import), 0) AS points_liability_active,
  SUM(balance_accrued)                                       AS balance_accrued,
  SUM(balance_redeemed)                                      AS balance_redeemed,
  -- Appended last: CREATE OR REPLACE VIEW can only add columns at the end.
  COUNT(DISTINCT uuid) FILTER (WHERE current_balance >= 1)   AS holding_members
FROM flagged
GROUP BY GROUPING SETS ((store, week_start), (week_start));


-- ---------------------------------------------------------------------------
-- 10. BALANCE DISTRIBUTION (snapshot) — member counts per current_balance
--     value, so tier thresholds can be chosen from evidence. Counts only.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW vm_v_loyalty_balance_distribution AS
WITH snap AS (
  SELECT
    store, week_start, btrim(uuid) AS uuid,
    COALESCE(vm_num_sci(current_balance), 0) AS current_balance,
    (CASE WHEN last_activity_date ~ '^\d{4}-\d{2}-\d{2}[ T]' THEN last_activity_date::timestamptz END
       = TIMESTAMPTZ '2026-04-14 01:00:03+00') AS bulk_import
  FROM vm_loyalty_earnt_redeemed
  WHERE store IS NOT NULL AND week_start IS NOT NULL
    AND btrim(coalesce(uuid, '')) <> ''
),
banded AS (
  SELECT
    *,
    -- Exact value up to 50; above that, bands of 50 so outliers stay visible
    -- without one row per value.
    CASE WHEN current_balance <= 50 THEN floor(current_balance)
         ELSE floor(current_balance / 50) * 50 END AS balance_floor,
    CASE WHEN current_balance <= 50 THEN floor(current_balance)::text
         ELSE (floor(current_balance / 50) * 50)::text || '–' || (floor(current_balance / 50) * 50 + 49)::text
    END AS balance_band
  FROM snap
)
SELECT
  COALESCE(store, 'All stores') AS store,
  week_start,
  balance_floor, balance_band,
  COUNT(DISTINCT uuid)                                    AS members,
  COUNT(DISTINCT uuid) FILTER (WHERE bulk_import)         AS imported_members,
  COUNT(DISTINCT uuid) FILTER (WHERE current_balance <> floor(current_balance)) AS non_integer_members
FROM banded
GROUP BY GROUPING SETS ((store, week_start, balance_floor, balance_band), (week_start, balance_floor, balance_band));


-- ---------------------------------------------------------------------------
-- 11. MATERIALIZED COPIES of the two views that scan all of
--     vm_detailed_sales_info. The app-facing names select from these, so the
--     page reads precomputed rows. They go stale until refreshed: the
--     vm-extractor loyalty step must call vm_refresh_loyalty_snapshots() after
--     it loads (core sales load earlier, so this sees both).
--     NOT YET WIRED (as of 2026-10-19): the extractor's LOYALTY step does not
--     call it, so after every sync run `select vm_refresh_loyalty_snapshots();`
--     by hand. Until you do, the Loyalty page shows a "snapshot out of date"
--     banner and "—" for rewards / member share; without the refresh those
--     figures read 0.
--     IF NOT EXISTS keeps re-runs cheap; if a *_live view's columns ever
--     change, DROP MATERIALIZED VIEW ... CASCADE first, then re-run the file.
-- ---------------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_vm_loyalty_member_sales AS
  SELECT * FROM vm_v_loyalty_member_sales_live;
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_vm_loyalty_member_sales_pk
  ON mv_vm_loyalty_member_sales (store, week_start);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_vm_loyalty_rewards_weekly AS
  SELECT * FROM vm_v_loyalty_rewards_weekly_live;
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_vm_loyalty_rewards_weekly_pk
  ON mv_vm_loyalty_rewards_weekly (store, week_start, reward_type);

CREATE OR REPLACE VIEW vm_v_loyalty_member_sales  AS SELECT * FROM mv_vm_loyalty_member_sales;
CREATE OR REPLACE VIEW vm_v_loyalty_rewards_weekly AS SELECT * FROM mv_vm_loyalty_rewards_weekly;

-- CONCURRENTLY keeps the dashboard readable during the refresh (needs the
-- unique indexes above).
CREATE OR REPLACE FUNCTION vm_refresh_loyalty_snapshots()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_vm_loyalty_member_sales;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_vm_loyalty_rewards_weekly;
END;
$$;

-- Supabase lets anon call any public function by default; a 3s refresh must
-- not be triggerable from the public key.
REVOKE EXECUTE ON FUNCTION vm_refresh_loyalty_snapshots() FROM PUBLIC, anon, authenticated;

-- Keep the app on the fast path: the slow *_live views and the raw matviews
-- aren't for the API (Supabase's default privileges would otherwise expose them).
REVOKE ALL ON vm_v_loyalty_member_sales_live, vm_v_loyalty_rewards_weekly_live,
              mv_vm_loyalty_member_sales,     mv_vm_loyalty_rewards_weekly
  FROM anon, authenticated;


-- ---------------------------------------------------------------------------
-- 12. GRANTS — the Next.js app reads through the anon key. All views above
--     are aggregated; none exposes a uuid.
-- ---------------------------------------------------------------------------
GRANT SELECT ON
  vm_v_loyalty_weeks,
  vm_v_loyalty_signups,
  vm_v_loyalty_points_weekly,
  vm_v_loyalty_points_channel,
  vm_v_loyalty_discount_orders,
  vm_v_loyalty_promotions_weekly,
  vm_v_loyalty_rewards_weekly,
  vm_v_loyalty_member_sales,
  vm_v_loyalty_member_base,
  vm_v_loyalty_balance_distribution
TO anon, authenticated;
