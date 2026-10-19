-- ===========================================================================
-- vm_loyalty_views_verify.sql — checks for vm_loyalty_views.sql (Update 257)
-- ---------------------------------------------------------------------------
-- Read-only. Run in the VM Supabase project AFTER vm_loyalty_views.sql.
-- The SQL editor only shows the LAST result of a multi-statement run, so run
-- each numbered query on its own (highlight it, then Run) and paste back the
-- result of each.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- Q1. vm_num_sci sanity — every row should have ok = true.
-- ---------------------------------------------------------------------------
SELECT input, vm_num(input) AS vm_num, vm_num_sci(input) AS vm_num_sci, expected,
       vm_num_sci(input) IS NOT DISTINCT FROM expected AS ok
FROM (VALUES
  ('0E-17',                                0::numeric),
  ('123.000000000000000000000000000',      123),
  ('1.5E+2',                               150),
  ('-4.25',                                -4.25),
  ('£1,234.50',                            1234.50),
  ('12',                                   12),
  ('',                                     NULL),
  (NULL,                                   NULL)
) t(input, expected);


-- ---------------------------------------------------------------------------
-- Q2. Row counts + week coverage per view (All stores rows included).
--     Dense views should have (weeks × 3 stores [× channels/tiers]) rows.
-- ---------------------------------------------------------------------------
SELECT 'vm_v_loyalty_weeks' AS view, count(*) AS rows, min(week_start) AS first_week, max(week_start) AS last_week, count(DISTINCT store) AS stores FROM vm_v_loyalty_weeks
UNION ALL SELECT 'vm_v_loyalty_signups',              count(*), min(week_start), max(week_start), count(DISTINCT store) FROM vm_v_loyalty_signups
UNION ALL SELECT 'vm_v_loyalty_points_weekly',        count(*), min(week_start), max(week_start), count(DISTINCT store) FROM vm_v_loyalty_points_weekly
UNION ALL SELECT 'vm_v_loyalty_points_channel',       count(*), min(week_start), max(week_start), count(DISTINCT store) FROM vm_v_loyalty_points_channel
UNION ALL SELECT 'vm_v_loyalty_discount_orders',      count(*), min(week_start), max(week_start), count(DISTINCT store) FROM vm_v_loyalty_discount_orders
UNION ALL SELECT 'vm_v_loyalty_promotions_weekly',    count(*), min(week_start), max(week_start), count(DISTINCT store) FROM vm_v_loyalty_promotions_weekly
UNION ALL SELECT 'vm_v_loyalty_rewards_weekly',       count(*), min(week_start), max(week_start), count(DISTINCT store) FROM vm_v_loyalty_rewards_weekly
UNION ALL SELECT 'vm_v_loyalty_member_sales',         count(*), min(week_start), max(week_start), count(DISTINCT store) FROM vm_v_loyalty_member_sales
UNION ALL SELECT 'vm_v_loyalty_member_base',          count(*), min(week_start), max(week_start), count(DISTINCT store) FROM vm_v_loyalty_member_base
UNION ALL SELECT 'vm_v_loyalty_balance_distribution', count(*), min(week_start), max(week_start), count(DISTINCT store) FROM vm_v_loyalty_balance_distribution;


-- ---------------------------------------------------------------------------
-- Q3. Reconciliation — each view total vs the raw table it comes from.
--     ok = true means they match (to the penny for money).
-- ---------------------------------------------------------------------------
WITH checks AS (
  -- Sign-ups: customer rows in vm_loyalty_users (brief: 5,506 rows, 1 kiosk)
  SELECT 'signups (All stores)' AS check_name,
         (SELECT sum(signups) FROM vm_v_loyalty_signups WHERE store = 'All stores')::numeric AS view_total,
         (SELECT count(DISTINCT btrim(user_uuid)) FROM vm_loyalty_users
           WHERE store IS NOT NULL AND week_start IS NOT NULL AND lower(btrim(user_role)) = 'customer')::numeric AS raw_total
  UNION ALL
  SELECT 'signups (stores sum = All stores)',
         (SELECT sum(signups) FROM vm_v_loyalty_signups WHERE store <> 'All stores'),
         (SELECT sum(signups) FROM vm_v_loyalty_signups WHERE store = 'All stores')
  UNION ALL
  SELECT 'points earnt',
         (SELECT sum(points_earnt) FROM vm_v_loyalty_points_weekly WHERE store = 'All stores'),
         (SELECT sum(coalesce(vm_num_sci(points_earnt_click_collect),0) + coalesce(vm_num_sci(points_earnt_kiosk),0)
                   + coalesce(vm_num_sci(points_earnt_opat),0) + coalesce(vm_num_sci(points_earnt_delivery),0))
            FROM vm_loyalty_per_customer WHERE store IS NOT NULL AND week_start IS NOT NULL)
  UNION ALL
  SELECT 'points redeemed',
         (SELECT sum(points_redeemed) FROM vm_v_loyalty_points_weekly WHERE store = 'All stores'),
         (SELECT sum(coalesce(vm_num_sci(points_redeemed_click_collect),0) + coalesce(vm_num_sci(points_redeemed_kiosk),0)
                   + coalesce(vm_num_sci(points_redeemed_opat),0) + coalesce(vm_num_sci(points_redeemed_delivery),0))
            FROM vm_loyalty_per_customer WHERE store IS NOT NULL AND week_start IS NOT NULL)
  UNION ALL
  SELECT 'points by channel = points weekly (earnt)',
         (SELECT sum(points_earnt) FROM vm_v_loyalty_points_channel WHERE store = 'All stores'),
         (SELECT sum(points_earnt) FROM vm_v_loyalty_points_weekly  WHERE store = 'All stores')
  UNION ALL
  SELECT 'per_customer rows (brief: 7,444)',
         (SELECT count(*) FROM vm_loyalty_per_customer WHERE store IS NOT NULL AND week_start IS NOT NULL), 7444
  UNION ALL
  SELECT 'discounted orders (brief: 7,198)',
         (SELECT sum(orders) FROM vm_v_loyalty_discount_orders WHERE store = 'All stores'),
         (SELECT count(DISTINCT btrim(order_uuid)) FROM vm_discounts_info_customer WHERE store IS NOT NULL AND week_start IS NOT NULL)
  UNION ALL
  SELECT 'discount cost: order table vs promotion table (expect close, not exact)',
         (SELECT round(sum(discount_cost), 2) FROM vm_v_loyalty_discount_orders   WHERE store = 'All stores'),
         (SELECT round(sum(discount_cost), 2) FROM vm_v_loyalty_promotions_weekly WHERE store = 'All stores')
  UNION ALL
  SELECT 'promotion rows (brief: 587)',
         (SELECT count(*) FROM vm_v_loyalty_promotions_weekly WHERE store <> 'All stores'),
         (SELECT count(*) FROM vm_sales_by_discount_type WHERE store IS NOT NULL AND week_start IS NOT NULL)
  UNION ALL
  SELECT 'total orders (member view) vs distinct order_uuid',
         (SELECT sum(total_orders) FROM vm_v_loyalty_member_sales WHERE store <> 'All stores'),
         (SELECT count(DISTINCT (store, btrim(order_uuid))) FROM vm_detailed_sales_info
           WHERE store IS NOT NULL AND week_start IS NOT NULL AND btrim(coalesce(order_uuid,'')) <> '')
  UNION ALL
  SELECT 'total orders vs exec dashboard (different source table: expect close, not exact)',
         (SELECT sum(total_orders) FROM vm_v_loyalty_member_sales WHERE store <> 'All stores'),
         (SELECT sum(number_of_orders) FROM vm_v_exec_dashboard)
  UNION ALL
  SELECT 'net sales: vm_num_sci vs vm_num on detailed sales (diff = sci-notation rows)',
         (SELECT round(sum(total_net_sales), 2) FROM vm_v_loyalty_member_sales WHERE store <> 'All stores'),
         (SELECT round(sum(vm_num(net_sales)), 2) FROM vm_detailed_sales_info
           WHERE store IS NOT NULL AND week_start IS NOT NULL AND btrim(coalesce(order_uuid,'')) <> '')
  UNION ALL
  SELECT 'discounted orders matched to detailed sales (brief: 7,053)',
         (SELECT sum(discounted_orders) FROM vm_v_loyalty_member_sales WHERE store <> 'All stores'), 7053
  UNION ALL
  SELECT 'snapshot members (brief: 14,609)',
         (SELECT sum(total_members) FROM vm_v_loyalty_member_base WHERE store <> 'All stores'
            AND week_start = (SELECT max(week_start) FROM vm_v_loyalty_member_base)),
         (SELECT count(*) FROM vm_loyalty_earnt_redeemed
           WHERE week_start = (SELECT max(week_start) FROM vm_loyalty_earnt_redeemed) AND store IS NOT NULL)
  UNION ALL
  SELECT 'bulk-import members (brief: 8,427)',
         (SELECT sum(imported_members) FROM vm_v_loyalty_member_base WHERE store <> 'All stores'
            AND week_start = (SELECT max(week_start) FROM vm_v_loyalty_member_base)), 8427
  UNION ALL
  SELECT 'balance distribution members = member base',
         (SELECT sum(members) FROM vm_v_loyalty_balance_distribution WHERE store = 'All stores'),
         (SELECT sum(total_members) FROM vm_v_loyalty_member_base WHERE store = 'All stores')
)
SELECT check_name, view_total, raw_total,
       round(view_total, 2) IS NOT DISTINCT FROM round(raw_total, 2) AS ok
FROM checks;


-- ---------------------------------------------------------------------------
-- Q4. current_balance distribution — the key input for tier thresholds.
--     Latest snapshot, All stores, split imported vs not. If balances are
--     Chicken Heads they'll be small integers, mostly 0–10.
-- ---------------------------------------------------------------------------
SELECT balance_band, members, imported_members, members - imported_members AS non_imported_members,
       non_integer_members,
       round(100.0 * members / sum(members) OVER (), 2) AS pct_of_members
FROM vm_v_loyalty_balance_distribution
WHERE store = 'All stores'
  AND week_start = (SELECT max(week_start) FROM vm_v_loyalty_balance_distribution)
ORDER BY balance_floor;


-- ---------------------------------------------------------------------------
-- Q5. Unit evidence — summary stats for every balance-like column, side by
--     side. Heads → integers, mostly ≤ 10, and points earned per member-week
--     of 1–7 (max one head per day). Pounds/points → larger, often decimals.
-- ---------------------------------------------------------------------------
WITH er AS (
  SELECT vm_num_sci(current_balance) AS v, 'earnt_redeemed.current_balance' AS col FROM vm_loyalty_earnt_redeemed
    WHERE week_start = (SELECT max(week_start) FROM vm_loyalty_earnt_redeemed)
  UNION ALL
  SELECT vm_num_sci(balance_accrued), 'earnt_redeemed.balance_accrued' FROM vm_loyalty_earnt_redeemed
    WHERE week_start = (SELECT max(week_start) FROM vm_loyalty_earnt_redeemed)
  UNION ALL
  SELECT vm_num_sci(balance_redeemed), 'earnt_redeemed.balance_redeemed' FROM vm_loyalty_earnt_redeemed
    WHERE week_start = (SELECT max(week_start) FROM vm_loyalty_earnt_redeemed)
  UNION ALL
  SELECT vm_num_sci(points_balance), 'lifetime.points_balance' FROM vm_loyalty_lifetime_per_customer
    WHERE week_start = (SELECT max(week_start) FROM vm_loyalty_lifetime_per_customer)
  UNION ALL
  SELECT coalesce(vm_num_sci(points_earnt_click_collect),0) + coalesce(vm_num_sci(points_earnt_kiosk),0)
       + coalesce(vm_num_sci(points_earnt_opat),0) + coalesce(vm_num_sci(points_earnt_delivery),0),
         'per_customer.points_earnt per member-week (earners only)'
    FROM vm_loyalty_per_customer
    WHERE coalesce(vm_num_sci(points_earnt_click_collect),0) + coalesce(vm_num_sci(points_earnt_kiosk),0)
        + coalesce(vm_num_sci(points_earnt_opat),0) + coalesce(vm_num_sci(points_earnt_delivery),0) > 0
  UNION ALL
  SELECT coalesce(vm_num_sci(points_redeemed_click_collect),0) + coalesce(vm_num_sci(points_redeemed_kiosk),0)
       + coalesce(vm_num_sci(points_redeemed_opat),0) + coalesce(vm_num_sci(points_redeemed_delivery),0),
         'per_customer.points_redeemed per member-week (redeemers only)'
    FROM vm_loyalty_per_customer
    WHERE coalesce(vm_num_sci(points_redeemed_click_collect),0) + coalesce(vm_num_sci(points_redeemed_kiosk),0)
        + coalesce(vm_num_sci(points_redeemed_opat),0) + coalesce(vm_num_sci(points_redeemed_delivery),0) > 0
)
SELECT col,
       count(*)                                              AS n,
       min(v)                                                AS min,
       percentile_cont(0.25) WITHIN GROUP (ORDER BY v)       AS p25,
       percentile_cont(0.50) WITHIN GROUP (ORDER BY v)       AS median,
       percentile_cont(0.75) WITHIN GROUP (ORDER BY v)       AS p75,
       percentile_cont(0.95) WITHIN GROUP (ORDER BY v)       AS p95,
       max(v)                                                AS max,
       round(avg(v), 2)                                      AS avg,
       round(100.0 * count(*) FILTER (WHERE v <> floor(v)) / count(*), 1)       AS pct_non_integer,
       round(100.0 * count(*) FILTER (WHERE v BETWEEN 0 AND 10) / count(*), 1)  AS pct_0_to_10
FROM er
WHERE v IS NOT NULL
GROUP BY col
ORDER BY col;


-- ---------------------------------------------------------------------------
-- Q6. Points redeemed per redemption — if a Gamma/Beta/Alpha costs 3/6/10
--     heads, redeemed values per member-week should cluster on those numbers
--     (or multiples). Top 25 values.
-- ---------------------------------------------------------------------------
SELECT v AS points_redeemed_in_week, count(*) AS member_weeks
FROM (
  SELECT coalesce(vm_num_sci(points_redeemed_click_collect),0) + coalesce(vm_num_sci(points_redeemed_kiosk),0)
       + coalesce(vm_num_sci(points_redeemed_opat),0) + coalesce(vm_num_sci(points_redeemed_delivery),0) AS v
  FROM vm_loyalty_per_customer
) x
WHERE v > 0
GROUP BY v
ORDER BY member_weeks DESC
LIMIT 25;


-- ---------------------------------------------------------------------------
-- Q7. Reward classification — every discount / promotion name and the bucket
--     it lands in. Check: Gamma/Beta/Alpha/sign-up all classified; is
--     "Free Churros" the birthday reward; anything loyalty-like left NULL?
-- ---------------------------------------------------------------------------
SELECT 'discount_name' AS source, discount_name AS name, reward_type,
       sum(orders) AS orders, round(sum(discount_cost), 2) AS cost
FROM vm_v_loyalty_discount_orders WHERE store = 'All stores'
GROUP BY discount_name, reward_type
UNION ALL
SELECT 'promotion_name', promotion_name, reward_type,
       NULL, round(sum(discount_cost), 2)
FROM vm_v_loyalty_promotions_weekly WHERE store = 'All stores'
GROUP BY promotion_name, reward_type
ORDER BY source, cost DESC NULLS LAST;


-- ---------------------------------------------------------------------------
-- Q8. Reward redemptions per tier, all time — and how many Alpha came only
--     through an "Alpha …" SKU (no Loyalty Alpha discount on the order).
-- ---------------------------------------------------------------------------
SELECT reward_type, reward_label,
       sum(redemptions) AS redemptions,
       sum(sku_only_redemptions) AS sku_only_redemptions,
       round(sum(reward_cost), 2) AS reward_cost,
       min(week_start) FILTER (WHERE redemptions > 0) AS first_week_seen
FROM vm_v_loyalty_rewards_weekly
WHERE store = 'All stores'
GROUP BY reward_type, reward_label, reward_rank
ORDER BY reward_rank;


-- ---------------------------------------------------------------------------
-- Q9. Discount sign check — are `discounts` / `total_discounts` stored
--     positive, negative or mixed? (Views use abs(); mixed signs would mean
--     refunds/reversals worth handling separately.)
-- ---------------------------------------------------------------------------
SELECT 'vm_discounts_info_customer.discounts' AS col,
       count(*) FILTER (WHERE vm_num_sci(discounts) > 0) AS positive,
       count(*) FILTER (WHERE vm_num_sci(discounts) < 0) AS negative,
       count(*) FILTER (WHERE vm_num_sci(discounts) = 0) AS zero,
       count(*) FILTER (WHERE vm_num_sci(discounts) IS NULL) AS null_or_bad
FROM vm_discounts_info_customer
UNION ALL
SELECT 'vm_sales_by_discount_type.total_discounts',
       count(*) FILTER (WHERE vm_num_sci(total_discounts) > 0),
       count(*) FILTER (WHERE vm_num_sci(total_discounts) < 0),
       count(*) FILTER (WHERE vm_num_sci(total_discounts) = 0),
       count(*) FILTER (WHERE vm_num_sci(total_discounts) IS NULL)
FROM vm_sales_by_discount_type;


-- ---------------------------------------------------------------------------
-- Q10. Latest-week spot check — what the page's KPI row will read, both
--      stores and estate.
-- ---------------------------------------------------------------------------
SELECT ms.store, ms.week_start,
       s.signups, p.active_earners, p.points_earnt, p.points_redeemed, p.redemption_rate,
       ms.total_orders, ms.member_orders, ms.member_order_share, ms.member_aov, ms.non_member_aov,
       ms.member_repeat_rate, ms.discount_penetration
FROM vm_v_loyalty_member_sales ms
JOIN vm_v_loyalty_signups s       USING (store, week_start)
JOIN vm_v_loyalty_points_weekly p USING (store, week_start)
WHERE ms.week_start = (SELECT max(week_start) FROM vm_v_loyalty_member_sales)
ORDER BY ms.store;


-- ---------------------------------------------------------------------------
-- Q11. Speed of the heaviest view. Live it took 3.1s; it now reads the
--      materialized copy, so "Execution Time" should be a few ms.
-- ---------------------------------------------------------------------------
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM vm_v_loyalty_member_sales
WHERE store = 'All stores' AND week_start = (SELECT max(week_start) FROM mv_vm_loyalty_member_sales);


-- ---------------------------------------------------------------------------
-- Q12. Orders: detailed sales vs the exec dashboard, per store-week — only
--      the rows that differ. Q3 showed 49,087 vs 50,601 in total; this says
--      whether that's whole weeks outside the loyalty range or a steady gap.
-- ---------------------------------------------------------------------------
SELECT e.store, e.week_start,
       e.number_of_orders                     AS exec_orders,
       m.total_orders                         AS detailed_orders,
       e.number_of_orders - COALESCE(m.total_orders, 0) AS diff
FROM vm_v_exec_dashboard e
LEFT JOIN vm_v_loyalty_member_sales m ON m.store = e.store AND m.week_start = e.week_start
WHERE e.number_of_orders IS DISTINCT FROM m.total_orders
ORDER BY e.week_start, e.store;
