-- =============================================================
-- Verify the dashboard "Labour %" tile's three-way split (Update 233).
--
-- Mirrors `labourLineTotals` + `labourCompositionFromLines` in SQL so the
-- figures on the tile can be checked independently of the app.
--
-- SET THE WEEK AND STORE IN THE `params` CTE OF EACH QUERY.
--   p_week  = the Monday of the week the tile is showing (its heading's first date)
--   p_store = store name as in `stores.name`, e.g. 'Hitchin Peckers'
--
-- The pricing rule, straight from labourLineTotals():
--   ni_total     = COALESCE(ni_total_override,   ni_hours   * ni_rate)   rounded to 2dp
--   cash_total   = COALESCE(cash_total_override, cash_hours * cash_rate) rounded to 2dp
--   delivery_pay = delivery_pay                                          rounded to 2dp
-- Rounding is PER LINE and then summed — rounding the sum instead can differ
-- by a penny or two, which is exactly the tolerance the app's check uses.
--
-- Two columns on the table are deliberately NOT in any sum here, because the
-- app does not read them either:
--   * `fixed_pay` — dead since migration 048. A manager's fixed daily wage is
--     written to the NI columns as hours x effective rate, so adding fixed_pay
--     would double-count every manager.
--   * `hours` — a record only. Paid hours are ni_hours + cash_hours.
-- =============================================================


-- -------------------------------------------------------------
-- QUERY 1 — the tile's rows, exactly as it renders them
-- -------------------------------------------------------------
with params as (
  select date '2026-09-28' as p_week, 'Hitchin Peckers' as p_store
),
lines as (
  select
    l.source,
    l.person_name,
    round(coalesce(l.ni_total_override,   coalesce(l.ni_hours,0)   * coalesce(l.ni_rate,0)),   2) as ni_total,
    round(coalesce(l.cash_total_override, coalesce(l.cash_hours,0) * coalesce(l.cash_rate,0)), 2) as cash_total,
    round(coalesce(l.delivery_pay, 0), 2) as delivery_pay
  from weekly_report_labour_lines l
  join weekly_reports r on r.id = l.report_id
  join stores s on s.id = r.store_id
  cross join params p
  where r.week_start = p.p_week
    and s.name = p.p_store
),
total as (select sum(ni_total + cash_total + delivery_pay) as labour_total from lines),
rows as (
  -- Managers: a manager's fixed daily wage (which the sheet carries on the NI
  -- columns) plus any cash HOURS. Their drops are NOT here.
  select 1 as ord, 'Managers' as row_label,
         sum(case when source = 'manager' then ni_total + cash_total else 0 end) as amount
  from lines
  union all
  select 2, 'Kitchen & crew — NI',
         sum(case when source = 'employee' then ni_total else 0 end) from lines
  union all
  select 3, 'Kitchen & crew — cash',
         sum(case when source = 'employee' then cash_total else 0 end) from lines
  union all
  -- Cover drivers' HOURLY pay, on its own row. Their drops are on the next one.
  select 4, 'Cover drivers — cash pay',
         sum(case when source = 'cover_driver' then ni_total + cash_total else 0 end) from lines
  union all
  -- Every per-drop allowance, whoever earned it: crew, managers and cover drivers.
  select 5, 'Delivery — drops',
         sum(case when source in ('employee','manager','cover_driver') then delivery_pay else 0 end) from lines
  union all
  -- Ad-hoc cover. The tile names this row after the people on it, and hides it at zero.
  select 6, coalesce(
             (select string_agg(distinct person_name, ' + ') from lines where source = 'adhoc'),
             'Other (ad-hoc cover)'),
         sum(case when source = 'adhoc' then ni_total + cash_total + delivery_pay else 0 end) from lines
)
select
  r.row_label as "Row",
  to_char(r.amount, 'FM999999990.00') as "£",
  to_char(round(100 * r.amount / nullif(t.labour_total, 0), 2), 'FM990.00') || '%' as "% of labour"
from (
  select ord, row_label, amount from rows
  union all
  select 99, '— TOTAL (must equal the tile''s £ figure)', (select sum(amount) from rows)
) r
cross join total t
order by r.ord;

-- The week's labour total on its own, priced the same way. The TOTAL row above
-- must equal this exactly — if it doesn't, one of the six rows is dropping money.
with params as (
  select date '2026-09-28' as p_week, 'Hitchin Peckers' as p_store
)
select to_char(sum(
    round(coalesce(l.ni_total_override,   coalesce(l.ni_hours,0)   * coalesce(l.ni_rate,0)),   2)
  + round(coalesce(l.cash_total_override, coalesce(l.cash_hours,0) * coalesce(l.cash_rate,0)), 2)
  + round(coalesce(l.delivery_pay,0), 2)), 'FM999999990.00') as "Week's labour total £"
from weekly_report_labour_lines l
join weekly_reports r on r.id = l.report_id
join stores s on s.id = r.store_id
cross join params p
where r.week_start = p.p_week and s.name = p.p_store;


-- -------------------------------------------------------------
-- QUERY 2 — the nine LabourComposition fields, one per row
--           (what the VM Analytics Labour Cost breakdown table shows)
-- -------------------------------------------------------------
with params as (
  select date '2026-09-28' as p_week, 'Hitchin Peckers' as p_store
),
lines as (
  select
    l.source,
    coalesce(l.ni_hours,0)   as ni_hours,
    coalesce(l.cash_hours,0) as cash_hours,
    coalesce(l.deliveries,0) as deliveries,
    round(coalesce(l.ni_total_override,   coalesce(l.ni_hours,0)   * coalesce(l.ni_rate,0)),   2) as ni_total,
    round(coalesce(l.cash_total_override, coalesce(l.cash_hours,0) * coalesce(l.cash_rate,0)), 2) as cash_total,
    round(coalesce(l.delivery_pay, 0), 2) as delivery_pay
  from weekly_report_labour_lines l
  join weekly_reports r on r.id = l.report_id
  join stores s on s.id = r.store_id
  cross join params p
  where r.week_start = p.p_week
    and s.name = p.p_store
),
fields as (
  select 1 as ord, 'employee_ni'         as field, 'Kitchen & crew — NI'      as bucket, sum(case when source='employee' then ni_total else 0 end) as amount from lines
  union all select 2, 'employee_cash',        'Kitchen & crew — cash',    sum(case when source='employee' then cash_total else 0 end) from lines
  union all select 3, 'employee_delivery',    'Delivery — drops',         sum(case when source='employee' then delivery_pay else 0 end) from lines
  union all select 4, 'manager_ni',           'Managers',                 sum(case when source='manager' then ni_total else 0 end) from lines
  union all select 5, 'manager_cash',         'Managers',                 sum(case when source='manager' then cash_total else 0 end) from lines
  union all select 6, 'manager_delivery',     'Delivery — drops',         sum(case when source='manager' then delivery_pay else 0 end) from lines
  union all select 7, 'cover_driver_cash',    'Cover drivers — cash pay', sum(case when source='cover_driver' then ni_total + cash_total else 0 end) from lines
  union all select 8, 'cover_driver_delivery','Delivery — drops',         sum(case when source='cover_driver' then delivery_pay else 0 end) from lines
  union all select 9, 'adhoc',                'Ad-hoc row (named after its people)', sum(case when source='adhoc' then ni_total + cash_total + delivery_pay else 0 end) from lines
)
select
  field as "Composition field",
  bucket as "Goes to bucket",
  to_char(amount, 'FM999999990.00') as "£"
from fields
order by ord;


-- -------------------------------------------------------------
-- QUERY 3 — line by line: who was paid what, and which bucket it landed in.
--           Use this to find the person behind a figure that looks wrong.
-- -------------------------------------------------------------
with params as (
  select date '2026-09-28' as p_week, 'Hitchin Peckers' as p_store
)
select
  l.person_name as "Person",
  l.source as "Source",
  coalesce(l.ni_hours,0)   as "NI hrs",
  coalesce(l.ni_rate,0)    as "NI rate",
  coalesce(l.cash_hours,0) as "Cash hrs",
  coalesce(l.cash_rate,0)  as "Cash rate",
  coalesce(l.deliveries,0) as "Drops",
  case when l.ni_total_override is not null or l.cash_total_override is not null
       then 'YES — typed total wins over hrs × rate' else '' end as "Override?",
  round(coalesce(l.ni_total_override,   coalesce(l.ni_hours,0)   * coalesce(l.ni_rate,0)),   2) as "NI £",
  round(coalesce(l.cash_total_override, coalesce(l.cash_hours,0) * coalesce(l.cash_rate,0)), 2) as "Cash £",
  round(coalesce(l.delivery_pay,0), 2) as "Drop pay £",
  round(
      round(coalesce(l.ni_total_override,   coalesce(l.ni_hours,0)   * coalesce(l.ni_rate,0)),   2)
    + round(coalesce(l.cash_total_override, coalesce(l.cash_hours,0) * coalesce(l.cash_rate,0)), 2)
    + round(coalesce(l.delivery_pay,0), 2), 2) as "Line total £",
  case l.source
    when 'adhoc' then 'Ad-hoc row'
    when 'cover_driver' then 'Cover drivers — cash pay (hours) + Delivery — drops'
    when 'manager' then 'Managers (hours) + Delivery — drops'
    else 'Kitchen & crew NI/cash (hours) + Delivery — drops'
  end as "Bucket"
from weekly_report_labour_lines l
join weekly_reports r on r.id = l.report_id
join stores s on s.id = r.store_id
cross join params p
where r.week_start = p.p_week
  and s.name = p.p_store
order by l.source, l.sort_order, l.person_name;


-- -------------------------------------------------------------
-- QUERY 4 — SNAPSHOT DRIFT CHECK.
--
-- On a LOCKED or SENT report the tile's headline £ comes from the figure frozen
-- at lock (`snapshot.labour_total`), while the breakdown is built from the live
-- lines. If a line has been edited since lock the two disagree, and the tile
-- HIDES the breakdown rather than showing parts that contradict the headline.
--
-- So: if the tile shows a headline but NO breakdown rows, run this. A non-zero
-- "drift" is the explanation — not a bug in the split.
-- -------------------------------------------------------------
with params as (
  select date '2026-09-28' as p_week, 'Hitchin Peckers' as p_store
),
live as (
  select
    r.id,
    sum(
        round(coalesce(l.ni_total_override,   coalesce(l.ni_hours,0)   * coalesce(l.ni_rate,0)),   2)
      + round(coalesce(l.cash_total_override, coalesce(l.cash_hours,0) * coalesce(l.cash_rate,0)), 2)
      + round(coalesce(l.delivery_pay,0), 2)
    ) as live_total
  from weekly_reports r
  join stores s on s.id = r.store_id
  left join weekly_report_labour_lines l on l.report_id = r.id
  cross join params p
  where r.week_start = p.p_week
    and s.name = p.p_store
  group by r.id
)
select
  r.status as "Report status",
  to_char(coalesce(live.live_total,0), 'FM999999990.00') as "Live lines total £",
  case when r.status = 'draft' then '(draft — the headline IS the live total)'
       else to_char(round((r.snapshot->>'labour_total')::numeric, 2), 'FM999999990.00') end
    as "Frozen snapshot £  (the headline on a locked report)",
  case when r.status = 'draft' then '0.00'
       else to_char(round(coalesce(live.live_total,0) - (r.snapshot->>'labour_total')::numeric, 2), 'FM990.00') end
    as "Drift (non-zero ⇒ breakdown hidden)"
from weekly_reports r
join stores s on s.id = r.store_id
join live on live.id = r.id
cross join params p
where r.week_start = p.p_week
  and s.name = p.p_store;
