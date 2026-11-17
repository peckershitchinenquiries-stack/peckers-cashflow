-- =============================================================
-- 075 — repair manager day headers rebuilt from half a day (Update 282)
--
-- RLS lets a manager read only the manager_clock_sessions at the store they
-- are running (034/061). Approving or withdrawing a PEER's drops ran
-- recomputeManagerDayHeader under that manager's session, so a day split
-- across Hitchin and Stevenage was rewritten from one store's shifts alone:
-- wrong store_id, first clock-in, worked_hours, session_count and drop totals.
-- 26 days since 2026-10-01 (Shreehari, Surya) were found this way.
--
-- The code fix rebuilds with the service-role client. This re-derives the
-- headers that disagree with their own shifts, using the same rules as
-- deriveDayHeader + recomputeManagerDayHeader:
--   bounds / hours / count / store  from REAL shifts (not deliveries_only)
--   drop totals + sign-off          from ALL shifts
--   raw drop totals                 only written when some shift carries one
--
-- Pay is unaffected either way: resolveManagerPayableDrops reads the shifts.
-- Idempotent: a repaired header no longer matches the WHERE, so a re-run
-- updates nothing. Run AFTER the code deploys, or a peer approval made in
-- between can break a repaired day again (re-running this then fixes it).
-- =============================================================

with ordered as (
  select s.*,
         row_number() over (
           partition by s.clock_event_id
           order by s.clock_in_at, s.seq
         ) as rn
  from public.manager_clock_sessions s
),
real_shifts as (
  select
    clock_event_id,
    count(*)                                              as session_count,
    count(*) filter (where clock_out_at is not null)      as completed_count,
    bool_or(clock_out_at is null)                         as is_open,
    min(clock_in_at)                                      as first_in,
    max(clock_out_at)                                     as last_out,
    round(
      coalesce(sum(greatest(extract(epoch from (clock_out_at - clock_in_at)), 0))
        filter (where clock_out_at is not null), 0) / 3600.0 * 60
    ) / 60.0                                              as worked_hours,
    (array_agg(store_id order by clock_in_at desc) filter (where clock_out_at is null and store_id is not null))[1]
                                                          as open_store,
    (array_agg(store_id order by clock_in_at desc))[1]    as latest_store
  from ordered
  where not coalesce(deliveries_only, false)
  group by clock_event_id
),
all_shifts as (
  select
    clock_event_id,
    sum(short_deliveries_count)                           as short_sum,
    sum(long_deliveries_count)                            as long_sum,
    coalesce(sum(extra_short_deliveries), 0)              as extra_short_sum,
    coalesce(sum(extra_long_deliveries), 0)               as extra_long_sum,
    (array_agg(btrim(extra_short_reason) order by rn)
       filter (where nullif(btrim(extra_short_reason), '') is not null))[1] as extra_short_reason,
    (array_agg(btrim(extra_long_reason) order by rn)
       filter (where nullif(btrim(extra_long_reason), '') is not null))[1]  as extra_long_reason,
    count(*) filter (where clock_out_at is not null)      as completed_count,
    count(*) filter (where clock_out_at is not null and coalesce(deliveries_approved, false))
                                                          as approved_count,
    sum(short_deliveries_count)
      filter (where clock_out_at is not null and coalesce(deliveries_approved, false)) as appr_short,
    sum(long_deliveries_count)
      filter (where clock_out_at is not null and coalesce(deliveries_approved, false)) as appr_long,
    coalesce(sum(extra_short_deliveries)
      filter (where clock_out_at is not null and coalesce(deliveries_approved, false)), 0) as appr_extra_short,
    coalesce(sum(extra_long_deliveries)
      filter (where clock_out_at is not null and coalesce(deliveries_approved, false)), 0) as appr_extra_long
  from ordered
  group by clock_event_id
),
derived as (
  select
    r.clock_event_id,
    r.first_in                                             as clock_in_at,
    case when r.is_open then null else r.last_out end      as clock_out_at,
    case when r.completed_count > 0 then r.worked_hours end as worked_hours,
    r.session_count,
    coalesce(r.open_store, r.latest_store)                 as store_id,
    (a.short_sum is not null or a.long_sum is not null
      or a.extra_short_sum > 0 or a.extra_long_sum > 0)    as has_deliveries,
    a.short_sum, a.long_sum, a.extra_short_sum, a.extra_long_sum,
    a.extra_short_reason, a.extra_long_reason,
    a.completed_count, a.approved_count,
    a.appr_short, a.appr_long, a.appr_extra_short, a.appr_extra_long
  from real_shifts r
  join all_shifts a using (clock_event_id)
)
update public.manager_clock_events e
set
  clock_in_at   = d.clock_in_at,
  clock_out_at  = d.clock_out_at,
  worked_hours  = d.worked_hours,
  session_count = d.session_count,
  store_id      = coalesce(d.store_id, e.store_id),
  short_deliveries_count = case when d.has_deliveries then d.short_sum        else e.short_deliveries_count end,
  long_deliveries_count  = case when d.has_deliveries then d.long_sum         else e.long_deliveries_count end,
  extra_short_deliveries = case when d.has_deliveries then d.extra_short_sum  else e.extra_short_deliveries end,
  extra_long_deliveries  = case when d.has_deliveries then d.extra_long_sum   else e.extra_long_deliveries end,
  extra_short_reason     = case when d.has_deliveries then d.extra_short_reason else e.extra_short_reason end,
  extra_long_reason      = case when d.has_deliveries then d.extra_long_reason  else e.extra_long_reason end,
  approved_short_deliveries_count = d.appr_short,
  approved_long_deliveries_count  = d.appr_long,
  approved_extra_short_deliveries = d.appr_extra_short,
  approved_extra_long_deliveries  = d.appr_extra_long,
  approved_session_count          = d.approved_count,
  deliveries_approved             = d.approved_count > 0 and d.approved_count = d.completed_count
from derived d
where d.clock_event_id = e.id
  and (
    e.session_count is distinct from d.session_count
    or e.clock_in_at is distinct from d.clock_in_at
    or e.clock_out_at is distinct from d.clock_out_at
    or e.store_id is distinct from coalesce(d.store_id, e.store_id)
    or abs(coalesce(e.worked_hours, -1) - coalesce(d.worked_hours, -1)) > 0.01
  );
