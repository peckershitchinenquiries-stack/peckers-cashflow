-- =============================================================
-- Verify the dashboard "Labour %" tile's ROLE split (Updates 237, 238):
--   Managers / Kitchen team / Delivery / ad-hoc.
--
-- Mirrors `lib/dashboard/labour-roles.ts` in SQL so the tile can be checked
-- independently of the app, down to which people make up Kitchen team and
-- Delivery and how much each one carries.
--
-- SET THE WEEK AND STORE IN THE `params` CTE OF EACH QUERY.
--   p_week  = the Monday of the week the tile is showing (its heading's first date)
--   p_store = store name as in `stores.name`, e.g. 'Hitchin Peckers'
--
-- Pricing, straight from labourLineTotals() — rounded PER LINE, then summed:
--   ni_total     = COALESCE(ni_total_override,   ni_hours   * ni_rate)
--   cash_total   = COALESCE(cash_total_override, cash_hours * cash_rate)
--   delivery_pay = delivery_pay
--   hours        = ni_hours + cash_hours        (the `hours` column is a record only)
--
-- THE CLASSIFIER IS `employees.position`, which is a fact: a Driver's hours are
-- delivery cost whatever their drop count says, because the waiting between
-- drops is what the store was paying for. Only a DUAL-ROLE person
-- ("Driver|Kitchen Team Member") is estimated, from cover driver productivity —
-- QUERY 1 shows that rate, QUERY 3 shows who it touches, QUERY 4 shows how much
-- of the Delivery row rests on it.
--
-- `position` is pipe-delimited, so the role tests below use string matching the
-- same way `parsePositions` in lib/types.ts does.
-- =============================================================


-- -------------------------------------------------------------
-- QUERY 1 — the calibrated rate, and where it came from.
--
-- rate = SUM(cover driver hours) / SUM(cover driver drops), clamped to
-- [0.133, 0.667] h (8–40 min). No cover driver hours or no cover driver drops
-- → the 0.333 h (20 min) fallback. It applies ONLY to dual-role employees; if
-- QUERY 3 shows none, this rate moves no money at all this week.
-- -------------------------------------------------------------
with params as (
  select date '2026-09-21' as p_week, 'Hitchin Peckers' as p_store
),
cd as (
  select
    l.person_name,
    round(coalesce(l.ni_hours,0) + coalesce(l.cash_hours,0), 2) as hours,
    coalesce(l.deliveries,0) as drops
  from weekly_report_labour_lines l
  join weekly_reports r on r.id = l.report_id
  join stores s on s.id = r.store_id
  cross join params p
  where r.week_start = p.p_week and s.name = p.p_store and l.source = 'cover_driver'
),
agg as (select coalesce(sum(hours),0) as hours, coalesce(sum(drops),0) as drops from cd)
select
  coalesce(x.person_name, '>>> ALL COVER DRIVERS') as "Cover driver",
  x.hours as "Hours",
  x.drops as "Drops",
  case when x.drops > 0 then to_char(round(x.hours / x.drops, 4), 'FM990.0000') else '—' end as "Raw h/drop",
  case when x.person_name is not null then '' else
    case when a.hours <= 0 or a.drops <= 0 then '0.3330  (FALLBACK — nothing to calibrate from)'
         else to_char(least(0.667, greatest(0.133, a.hours / a.drops)), 'FM990.0000')
              || case when a.hours / a.drops > 0.667 then '  (CLAMPED DOWN)'
                      when a.hours / a.drops < 0.133 then '  (CLAMPED UP)'
                      else '  (within the clamp)' end
    end
  end as "RATE APPLIED"
from (
  select person_name, hours, drops from cd
  union all
  select null, (select hours from agg), (select drops from agg)
) x
cross join agg a
order by (x.person_name is null) asc, x.person_name asc;


-- -------------------------------------------------------------
-- QUERY 2 — the tile's four rows, exactly as it renders them.
--           The TOTAL must equal the tile's headline £ to the penny.
-- -------------------------------------------------------------
with params as (
  select date '2026-09-21' as p_week, 'Hitchin Peckers' as p_store
),
lines as (
  select
    l.source,
    l.person_name,
    e.position,
    case
      when l.source <> 'employee' then null
      when e.position is null then 'both'
      when e.position like '%Driver%' and e.position <> 'Driver' then 'both'
      when e.position = 'Driver' then 'driver'
      else 'kitchen'
    end as role,
    round(coalesce(l.ni_hours,0) + coalesce(l.cash_hours,0), 2) as hours,
    coalesce(l.deliveries,0) as drops,
    round(coalesce(l.ni_total_override,   coalesce(l.ni_hours,0)   * coalesce(l.ni_rate,0)),   2)
    + round(coalesce(l.cash_total_override, coalesce(l.cash_hours,0) * coalesce(l.cash_rate,0)), 2) as hourly_pay,
    round(coalesce(l.delivery_pay, 0), 2) as delivery_pay
  from weekly_report_labour_lines l
  join weekly_reports r on r.id = l.report_id
  join stores s on s.id = r.store_id
  left join employees e on e.id = l.employee_id
  cross join params p
  where r.week_start = p.p_week and s.name = p.p_store
),
rate as (
  select case
    when coalesce(sum(hours),0) <= 0 or coalesce(sum(drops),0) <= 0 then 0.333
    else least(0.667, greatest(0.133, sum(hours) / sum(drops)))
  end as r
  from lines where source = 'cover_driver'
),
kitchen_raw as (
  -- Position decides; only 'both' is estimated, capped at the person's own hours.
  select sum(case
    when l.role = 'kitchen' then l.hourly_pay
    when l.role = 'driver' then 0
    else l.hourly_pay * (1 - (case when l.hours > 0 then least(l.drops * rate.r, l.hours) / l.hours
                                   when l.drops > 0 then 1 else 0 end))
  end) as amount
  from lines l cross join rate where l.source = 'employee'
),
parts as (
  select
    (select coalesce(sum(hourly_pay),0) from lines where source = 'manager') as managers,
    (select coalesce(amount,0) from kitchen_raw) as kitchen,
    -- Employee hourly pay + every certain delivery cost as ONE figure, so
    -- Kitchen and Delivery are made to sum to it exactly (as the app does).
    (select coalesce(sum(hourly_pay),0) from lines where source = 'employee')
    + (select coalesce(sum(delivery_pay),0) from lines where source in ('employee','manager','cover_driver'))
    + (select coalesce(sum(hourly_pay),0) from lines where source = 'cover_driver') as hourly_and_delivery,
    (select coalesce(sum(hourly_pay + delivery_pay),0) from lines where source = 'adhoc') as outsourced,
    (select sum(hourly_pay + delivery_pay) from lines) as labour_total,
    (select coalesce(string_agg(distinct person_name, ' + '), 'Other (ad-hoc cover)')
       from lines where source = 'adhoc') as adhoc_label
),
rows as (
  select 1 as ord, 'Managers' as row_label, round(managers, 2) as amount from parts
  union all select 2, 'Kitchen team', round(kitchen, 2) from parts
  union all select 3, 'Delivery', round(hourly_and_delivery, 2) - round(kitchen, 2) from parts
  union all select 4, adhoc_label, round(outsourced, 2) from parts
)
select
  r.row_label as "Row",
  to_char(r.amount, 'FM999999990.00') as "£",
  to_char(round(100 * r.amount / nullif(p.labour_total, 0), 2), 'FM990.00') || '%' as "% of labour"
from (
  select ord, row_label, amount from rows
  union all select 98, '— TOTAL (must equal the tile''s £ figure)', (select sum(amount) from rows)
  union all select 99, '— the week''s labour priced line by line', (select labour_total from parts)
) r
cross join parts p
order by r.ord;


-- -------------------------------------------------------------
-- QUERY 3 — *** WHO MAKES UP KITCHEN TEAM AND DELIVERY ***
--
-- One row per employee with the position that classified them. A `role` of
-- 'both' is the only row where the rate does anything; 'driver' and 'kitchen'
-- are decided outright.
--
-- Shown rounded for reading; the app sums unrounded and rounds once, so the
-- column totals here can sit a penny off the tile. QUERY 2 is authoritative.
-- -------------------------------------------------------------
with params as (
  select date '2026-09-21' as p_week, 'Hitchin Peckers' as p_store
),
lines as (
  select
    l.source, l.person_name, l.sort_order, e.position, e.store_id as home_store_id,
    case
      when e.position is null then 'both — NO POSITION, falls to the estimate'
      when e.position like '%Driver%' and e.position <> 'Driver' then 'both — ESTIMATED'
      when e.position = 'Driver' then 'driver — 100% delivery'
      else 'kitchen — 100% kitchen'
    end as role_label,
    case
      when e.position is null then 'both'
      when e.position like '%Driver%' and e.position <> 'Driver' then 'both'
      when e.position = 'Driver' then 'driver'
      else 'kitchen'
    end as role,
    round(coalesce(l.ni_hours,0) + coalesce(l.cash_hours,0), 2) as hours,
    coalesce(l.deliveries,0) as drops,
    round(coalesce(l.ni_total_override,   coalesce(l.ni_hours,0)   * coalesce(l.ni_rate,0)),   2)
    + round(coalesce(l.cash_total_override, coalesce(l.cash_hours,0) * coalesce(l.cash_rate,0)), 2) as hourly_pay,
    round(coalesce(l.delivery_pay, 0), 2) as delivery_pay
  from weekly_report_labour_lines l
  join weekly_reports r on r.id = l.report_id
  join stores s on s.id = r.store_id
  left join employees e on e.id = l.employee_id
  cross join params p
  where r.week_start = p.p_week and s.name = p.p_store and l.source = 'employee'
),
rate as (
  select case
    when coalesce(sum(hours),0) <= 0 or coalesce(sum(drops),0) <= 0 then 0.333
    else least(0.667, greatest(0.133, sum(hours) / sum(drops)))
  end as r
  from weekly_report_labour_lines l2
  join weekly_reports r2 on r2.id = l2.report_id
  join stores s2 on s2.id = r2.store_id
  cross join params p2
  cross join lateral (select round(coalesce(l2.ni_hours,0) + coalesce(l2.cash_hours,0), 2) as hours,
                             coalesce(l2.deliveries,0) as drops) v
  where r2.week_start = p2.p_week and s2.name = p2.p_store and l2.source = 'cover_driver'
),
calc as (
  select l.*, hs.name as home_store,
    case l.role when 'kitchen' then l.hourly_pay when 'driver' then 0
      else l.hourly_pay * (1 - (case when l.hours > 0 then least(l.drops * rate.r, l.hours) / l.hours
                                     when l.drops > 0 then 1 else 0 end)) end as kitchen_amt
  from lines l cross join rate
  left join stores hs on hs.id = l.home_store_id
)
select
  0 as ord,
  person_name as "Employee",
  coalesce(position, '(no employee record)') as "Position",
  role_label as "Role",
  coalesce(home_store, '—') as "Home store",
  hours as "Hrs",
  drops as "Drops",
  to_char(hourly_pay, 'FM999990.00') as "Hourly pay £",
  to_char(round(kitchen_amt, 2), 'FM999990.00') as "→ Kitchen £",
  to_char(round(hourly_pay - kitchen_amt, 2), 'FM999990.00') as "→ Delivery £ (hours)",
  to_char(delivery_pay, 'FM999990.00') as "+ Drop pay £"
from calc
union all
select 1, '>>> SUBTOTAL', '', '', '', sum(hours), sum(drops),
  to_char(sum(hourly_pay), 'FM999990.00'),
  to_char(round(sum(kitchen_amt), 2), 'FM999990.00'),
  to_char(round(sum(hourly_pay - kitchen_amt), 2), 'FM999990.00'),
  to_char(sum(delivery_pay), 'FM999990.00')
from calc
order by ord, 2;


-- -------------------------------------------------------------
-- QUERY 4 — the Delivery row built from its parts, so it is clear which of it
--           is FACT and which is the estimate.
--
-- Only the 'both' row is an estimate. If it is £0.00, the whole split is fact
-- and the clamp in QUERY 1 moved no money this week.
-- -------------------------------------------------------------
with params as (
  select date '2026-09-21' as p_week, 'Hitchin Peckers' as p_store
),
lines as (
  select
    l.source,
    case
      when l.source <> 'employee' then null
      when e.position is null then 'both'
      when e.position like '%Driver%' and e.position <> 'Driver' then 'both'
      when e.position = 'Driver' then 'driver'
      else 'kitchen'
    end as role,
    round(coalesce(l.ni_hours,0) + coalesce(l.cash_hours,0), 2) as hours,
    coalesce(l.deliveries,0) as drops,
    round(coalesce(l.ni_total_override,   coalesce(l.ni_hours,0)   * coalesce(l.ni_rate,0)),   2)
    + round(coalesce(l.cash_total_override, coalesce(l.cash_hours,0) * coalesce(l.cash_rate,0)), 2) as hourly_pay,
    round(coalesce(l.delivery_pay, 0), 2) as delivery_pay
  from weekly_report_labour_lines l
  join weekly_reports r on r.id = l.report_id
  join stores s on s.id = r.store_id
  left join employees e on e.id = l.employee_id
  cross join params p
  where r.week_start = p.p_week and s.name = p.p_store
),
rate as (
  select case
    when coalesce(sum(hours),0) <= 0 or coalesce(sum(drops),0) <= 0 then 0.333
    else least(0.667, greatest(0.133, sum(hours) / sum(drops)))
  end as r
  from lines where source = 'cover_driver'
),
parts as (
  select 1 as ord, 'FACT      · driver hourly pay (position = Driver)' as part,
    (select coalesce(sum(hourly_pay),0) from lines where role = 'driver') as amount
  union all select 2, 'ESTIMATE  · dual-role hourly pay x delivery share',
    (select coalesce(sum(l.hourly_pay * (case when l.hours > 0 then least(l.drops * rate.r, l.hours) / l.hours
                                              when l.drops > 0 then 1 else 0 end)), 0)
       from lines l cross join rate where l.role = 'both')
  union all select 3, 'FACT      · employee drop pay',
    (select coalesce(sum(delivery_pay),0) from lines where source = 'employee')
  union all select 4, 'FACT      · cover driver hourly pay',
    (select coalesce(sum(hourly_pay),0) from lines where source = 'cover_driver')
  union all select 5, 'FACT      · cover driver drop pay',
    (select coalesce(sum(delivery_pay),0) from lines where source = 'cover_driver')
  union all select 6, 'FACT      · manager drop pay',
    (select coalesce(sum(delivery_pay),0) from lines where source = 'manager')
)
select ord, part as "Part of the Delivery row", to_char(round(amount, 2), 'FM999999990.00') as "£"
from parts
union all select 7, '>>> DELIVERY ROW TOTAL', to_char(round((select sum(amount) from parts), 2), 'FM999999990.00')
union all select 8, '>>> of which FACT', to_char(round((select sum(amount) from parts where ord <> 2), 2), 'FM999999990.00')
union all select 9, '>>> of which ESTIMATE', to_char(round((select sum(amount) from parts where ord = 2), 2), 'FM999999990.00')
order by 1;


-- -------------------------------------------------------------
-- QUERY 5 — SENSITIVITY: Kitchen and Delivery at each end of the clamp.
--           Identical rows across all four scenarios means no dual-role person
--           worked and the split carries no estimate at all.
-- -------------------------------------------------------------
with params as (
  select date '2026-09-21' as p_week, 'Hitchin Peckers' as p_store
),
lines as (
  select
    l.source,
    case
      when l.source <> 'employee' then null
      when e.position is null then 'both'
      when e.position like '%Driver%' and e.position <> 'Driver' then 'both'
      when e.position = 'Driver' then 'driver'
      else 'kitchen'
    end as role,
    round(coalesce(l.ni_hours,0) + coalesce(l.cash_hours,0), 2) as hours,
    coalesce(l.deliveries,0) as drops,
    round(coalesce(l.ni_total_override,   coalesce(l.ni_hours,0)   * coalesce(l.ni_rate,0)),   2)
    + round(coalesce(l.cash_total_override, coalesce(l.cash_hours,0) * coalesce(l.cash_rate,0)), 2) as hourly_pay,
    round(coalesce(l.delivery_pay, 0), 2) as delivery_pay
  from weekly_report_labour_lines l
  join weekly_reports r on r.id = l.report_id
  join stores s on s.id = r.store_id
  left join employees e on e.id = l.employee_id
  cross join params p
  where r.week_start = p.p_week and s.name = p.p_store
),
applied as (
  select case
    when coalesce(sum(hours),0) <= 0 or coalesce(sum(drops),0) <= 0 then 0.333
    else least(0.667, greatest(0.133, sum(hours) / sum(drops)))
  end as r
  from lines where source = 'cover_driver'
),
scenarios as (
  select 1 as ord, 'MIN clamp  0.133 h/drop (8 min)' as scenario, 0.133::numeric as r
  union all select 2, 'applied rate (what the tile shows)', (select r from applied)
  union all select 3, 'default    0.333 h/drop (20 min)', 0.333
  union all select 4, 'MAX clamp  0.667 h/drop (40 min)', 0.667
),
fixed as (
  select
    (select coalesce(sum(hourly_pay),0) from lines where source='employee')
    + (select coalesce(sum(delivery_pay),0) from lines where source in ('employee','manager','cover_driver'))
    + (select coalesce(sum(hourly_pay),0) from lines where source='cover_driver') as hourly_and_delivery
)
select
  sc.scenario as "Scenario",
  to_char(round(sc.r, 4), 'FM990.0000') as "h/drop",
  to_char(round(k.kitchen, 2), 'FM999999990.00') as "Kitchen team £",
  to_char(round(f.hourly_and_delivery, 2) - round(k.kitchen, 2), 'FM999999990.00') as "Delivery £"
from scenarios sc
cross join fixed f
cross join lateral (
  select coalesce(sum(case l.role
    when 'kitchen' then l.hourly_pay
    when 'driver' then 0
    else l.hourly_pay * (1 - (case when l.hours > 0 then least(l.drops * sc.r, l.hours) / l.hours
                                   when l.drops > 0 then 1 else 0 end)) end), 0) as kitchen
  from lines l where l.source = 'employee'
) k
order by sc.ord;
