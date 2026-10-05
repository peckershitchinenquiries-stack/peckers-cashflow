-- ============================================================================
-- Product Performance — NET sales views (run in the VM Supabase project)
-- Turns the raw item-level NET feed (vm_net_sales_per_product) into weekly
-- per-store product views that mirror the gross vm_v_product_performance chain.
--
--  vm_norm(text)               : name normaliser matching the app's normalizeItem
--  vm_v_product_net            : store × week × product, NET revenue + units
--  vm_v_product_category_net   : the above tagged with category (drill-down)
--
-- Notes
--  - Collapses granularity: SUM(net_sales) per (store, week, product). Handles
--    Stevenage rows currently synced HOURLY (sum of hours = the week) and
--    Hitchin rows synced WEEKLY (sum of one row = itself). Stays correct after
--    the extractor is fixed to weekly.
--  - Units come from the existing gross feed (vm_v_product_performance) — the net
--    feed has no units. Joined on the normalised name (1:1, no fan-out).
--  - Excludes order-level CHARGES (delivery fee, service charge, small order
--    fee, bag fee) and any row whose product_uuid is not a real UUID (that
--    'delivery fee' pseudo-row has product_uuid='delivery fee'). Charges carry a
--    real product_uuid, so the UUID test alone does not catch them.
--  - net_sales is TEXT in the raw table → cast to numeric here.
--
-- Re-runnable: CREATE OR REPLACE; views dropped first (dependency order).
-- IMPORTANT: this file drops vm_mv_category_quarter_net, which is built on
-- vm_v_product_category_net. Run vm_category_quarterly.sql straight after it to
-- rebuild the matview, or the Product Performance quarterly column stays hidden.
-- ============================================================================

-- Name normaliser: lower-case, '&' -> 'and', strip everything non-alphanumeric.
-- Mirrors normalizeItem() in lib/vm-analytics/constants.ts so SQL joins line up
-- with the app's item matching.
create or replace function vm_norm(t text)
returns text
language sql
immutable
as $$
  select regexp_replace(replace(lower(coalesce(btrim(t), '')), '&', 'and'), '[^a-z0-9]+', '', 'g')
$$;

-- The order-level charges that ring through the till as products but are not
-- menu items. Anchored to word boundaries rather than matched as bare
-- substrings: '%charge%' would swallow every "Supercharged ..." item, and
-- '%fee%' would swallow a Coffee or Toffee milkshake the day one is added.
-- Returned from a function so the view and any audit query share one definition.
create or replace function vm_charge_name_pattern()
returns text
language sql
immutable
as $$
  select '(^|[^a-z])(delivery\s+fee|service\s+charge|small\s+order\s+fee|bag\s+fee|carrier\s+bag|surcharge)([^a-z]|$)'
$$;

-- vm_mv_category_quarter_net (vm_category_quarterly.sql) is built ON
-- vm_v_product_category_net, so the view below cannot be replaced while it
-- exists. Dropped explicitly rather than with CASCADE: CASCADE removes it
-- silently and leaves the Product Performance quarterly column blank with
-- nothing to say why. RE-RUN vm_category_quarterly.sql AFTER this file.
drop materialized view if exists vm_mv_category_quarter_net;

drop view if exists vm_v_product_category_net;
drop view if exists vm_v_product_net;

-- One row per (store, week, product): NET revenue (summed to weekly) + units.
create or replace view vm_v_product_net as
with net as (
  select store,
         week_start,
         min(week_end)                                   as week_end,
         vm_norm(product)                                as norm,
         min(btrim(product))                             as item_name,
         sum(coalesce(nullif(btrim(net_sales), '')::numeric, 0)) as net_sales
  from vm_net_sales_per_product
  where product_uuid ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and lower(btrim(product)) !~ vm_charge_name_pattern()
  group by store, week_start, vm_norm(product)
),
units as (
  -- One units total per normalised name so the join can't fan out.
  select store, week_start, vm_norm(item_name) as norm, sum(units_sold) as units_sold
  from vm_v_product_performance
  group by store, week_start, vm_norm(item_name)
)
select n.store,
       n.week_start,
       n.week_end,
       n.item_name,
       coalesce(u.units_sold, 0) as units_sold,
       n.net_sales
from net n
left join units u
  on u.store = n.store
 and u.week_start = n.week_start
 and u.norm = n.norm;

-- Same rows tagged with category (reuses the curated gross mapping / fallback).
create or replace view vm_v_product_category_net as
select p.*, vm_category_for(p.item_name) as category
from vm_v_product_net p;
