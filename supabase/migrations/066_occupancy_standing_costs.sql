-- =============================================================
-- Migration 066 — Occupancy Costs become standing costs too
--
-- Run AFTER 065. Idempotent.
--
-- The occupancy sheet is titled "Fixed Costs" in both stores' workbooks, and it
-- means it: Stevenage's and Hitchin's figures are byte-for-byte identical
-- between w/c 2026-09-14 and w/c 2026-09-21. Rent, Rates, Insurance and the
-- rest were being retyped every Monday for no reason, exactly as the Cost of
-- Goods standing rows were before 063.
--
-- This does for occupancy what 063 and 064 did for Cost of Goods, in one file:
--   PART 1 stamps `fixed_amount` onto the occupancy lines that already exist,
--          so the carry-forward has a standing figure to carry.
--   PART 2 fills `amount` from it on DRAFT weeks whose cell is still blank.
--
-- *** THIS ONE MOVES THE P&L. ***
--
-- Unlike 065's £0 Hitchin rows, occupancy FEEDS the weekly summary. Any draft
-- week currently sitting with blank occupancy lines gains roughly £2,125
-- (Stevenage) or £1,612 (Hitchin) of cost, which lands on Store Contribution
-- and Net Margin. That is the figure those weeks SHOULD have carried — a week
-- showing zero rent was wrong, not cheap — but it is a visible change to weeks
-- someone may already have read, so it is called out here rather than buried.
--
-- The same three guards as 064, for the same reasons:
--   1. DRAFT reports only — a locked or sent week is a frozen record.
--   2. `amount is null` is the test for blank, never `amount = 0`. A typed zero
--      is a decision and is left alone.
--   3. Matched on a FOLDED label (lowercased, punctuation stripped), so
--      "Business Rates" and "Rates" both resolve. Occupancy is one row per
--      cost, so there is no sibling check to make here — unlike a supplier,
--      which can hold several invoices in a week.
--
-- NOTE ON CLEANING SUPPLIES (Stevenage): deliberately absent below. It is the
-- one occupancy line that store leaves blank week after week, so it carries no
-- standing figure and keeps opening empty. Hitchin's is £40 and does.
-- =============================================================

with standing (store_match, label, amount) as (
  values
    -- Stevenage, identical across w/c 2026-09-14 and 2026-09-21.
    ('stevenage', 'gobig',            50.00),
    ('stevenage', 'sportingads',      85.00),
    ('stevenage', 'accountancyfees',  65.00),
    ('stevenage', 'businessrates',   150.00),
    ('stevenage', 'rates',           150.00),
    ('stevenage', 'tradebins',       170.00),
    ('stevenage', 'equipment',       100.00),
    ('stevenage', 'niemployers',     230.00),
    ('stevenage', 'insurance',        45.00),
    ('stevenage', 'software',        220.00),
    ('stevenage', 'lightingpower',   250.00),
    ('stevenage', 'rent',            615.00),
    ('stevenage', 'repairs',          60.00),
    ('stevenage', 'subscriptions',    75.00),
    ('stevenage', 'telephone',        10.00),
    -- Hitchin, likewise identical across both weeks.
    ('hitchin',   'gobig',            70.00),
    ('hitchin',   'accountancyfees',  65.00),
    ('hitchin',   'rates',           104.00),
    ('hitchin',   'businessrates',   104.00),
    ('hitchin',   'cleaningsupplies', 40.00),
    ('hitchin',   'tradebins',       111.00),
    ('hitchin',   'equipment',        50.00),
    ('hitchin',   'niemployers',     140.00),
    ('hitchin',   'insurance',        35.00),
    ('hitchin',   'software',        157.00),
    ('hitchin',   'lightingpower',   250.00),
    ('hitchin',   'rent',            400.00),
    ('hitchin',   'repairs',         105.00),
    ('hitchin',   'subscriptions',    75.00),
    ('hitchin',   'telephone',        10.00)
),
matched as (
  select distinct on (l.id) l.id, s.amount
  from public.weekly_report_lines l
  join public.weekly_reports r on r.id = l.report_id
  join public.stores st on st.id = r.store_id
  join standing s
    on s.label = regexp_replace(lower(l.label), '[^a-z0-9]', '', 'g')
   and st.name ilike '%' || s.store_match || '%'
  where l.section = 'occupancy'
)
update public.weekly_report_lines l
   set fixed_amount = m.amount
  from matched m
 where m.id = l.id
   and l.fixed_amount is distinct from m.amount;

-- PART 2 — the drafts already open, same rules as 064.
with target as (
  select l.id, l.fixed_amount
  from public.weekly_report_lines l
  join public.weekly_reports r on r.id = l.report_id
  where r.status = 'draft'
    and l.section = 'occupancy'
    and l.fixed_amount is not null
    and l.amount is null
)
update public.weekly_report_lines l
   set amount = t.fixed_amount
  from target t
 where t.id = l.id;
