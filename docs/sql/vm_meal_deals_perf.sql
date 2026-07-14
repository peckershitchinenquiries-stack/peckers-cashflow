-- vm_v_meal_deals performance fix (Fix #2 for the Weekly Exception Report timeout)
-- Run in the VM Supabase project's SQL editor (the project hosting the vm_*
-- tables/views), NOT the cashflow project.
--
-- DIAGNOSIS (confirmed via EXPLAIN ANALYZE):
--   vm_v_meal_deals uses LAG() OVER (PARTITION BY store ORDER BY week_start) to
--   get the previous-week delta, so it must aggregate DISTINCT meal-deal baskets
--   across ALL ~93k meal-deal line items for ALL weeks on every request, then
--   filter to the single requested week at the end. That is ~5.6s even on a warm
--   cache (CPU-bound), and exceeds statement_timeout on a cold cache -> the
--   "getMealDeals: cancelling statement due to statement timeout" error.
--
--   An index does NOT fix this (the view already uses one) — the full-history
--   window aggregation is the cost. The fix is to precompute the ~36 result rows
--   once (materialised view) and read them instantly.
--
-- App-side graceful degradation is already in place (updates.md Update 17); this
-- removes the root cause. Run sections 1-4 in order.

-- ---------------------------------------------------------------------------
-- 1. Precompute the whole view once as a materialised view
--    (same body as the current view, just materialised).
-- ---------------------------------------------------------------------------
drop materialized view if exists public.mv_vm_meal_deals cascade;

create materialized view public.mv_vm_meal_deals as
with base as (
  select
    store,
    week_start,
    week_end,
    count(distinct meal_deal_basket_uuid) as deal_baskets
  from vm_detailed_sales_info
  where store is not null
    and week_start is not null
    and meal_deal_name is not null
    and btrim(meal_deal_name) <> ''
    and meal_deal_basket_uuid is not null
    and btrim(meal_deal_basket_uuid) <> ''
  group by store, week_start, week_end
)
select
  store,
  week_start,
  week_end,
  deal_baskets,
  lag(deal_baskets) over w as prev_deal_baskets,
  deal_baskets - lag(deal_baskets) over w as deal_baskets_delta
from base
window w as (partition by store order by week_start);

-- Unique index is REQUIRED for REFRESH ... CONCURRENTLY (non-blocking refresh).
create unique index if not exists idx_mv_vm_meal_deals_pk
  on public.mv_vm_meal_deals (store, week_start);

-- ---------------------------------------------------------------------------
-- 2. Point the app's view name at the matview so NO app code changes.
--    getMealDeals() still reads vm_v_meal_deals; it now hits precomputed rows.
-- ---------------------------------------------------------------------------
drop view if exists public.vm_v_meal_deals;

create view public.vm_v_meal_deals as
  select store, week_start, week_end, deal_baskets, prev_deal_baskets, deal_baskets_delta
  from public.mv_vm_meal_deals;

-- Re-grant read access (grants are lost when the old view is dropped).
grant select on public.vm_v_meal_deals to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Verify — this should now return in a few milliseconds.
-- ---------------------------------------------------------------------------
explain (analyze, buffers)
select * from public.vm_v_meal_deals
where week_start = '2026-07-06';

-- ---------------------------------------------------------------------------
-- 4. Keep it fresh — refresh AFTER each weekly data load into
--    vm_detailed_sales_info. Safe to re-run; CONCURRENTLY does not block reads.
--    Until this is refreshed, the view shows the last-refreshed week's data.
-- ---------------------------------------------------------------------------
refresh materialized view concurrently public.mv_vm_meal_deals;

-- Optional: automate the weekly refresh with pg_cron (if the extension is
-- enabled). Adjust the schedule to run just after your weekly import.
-- select cron.schedule('refresh_mv_vm_meal_deals', '30 6 * * 1',
--   $$refresh materialized view concurrently public.mv_vm_meal_deals$$);
