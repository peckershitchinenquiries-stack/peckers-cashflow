-- =============================================================
-- Update 224 repair — the two cross-store days recorded before the fix.
--
-- NOT a migration. A one-off data repair for two specific days; it lives here
-- so the change is reviewable, but it must never be added to the migration
-- runner. Safe to re-run: every write is keyed on a specific session id and
-- the header/rollup are derived from whatever the sessions then hold.
--
--   Rohith Boora, Sat 26/09 — drove Hitchin → Stevenage and never clocked out
--     and back in, so ONE Hitchin session covers both stores. A manager then
--     approved it at 5h of the 10.62h clocked, so Stevenage paid nothing and
--     all 7 drops billed to Hitchin. Split into the two real shifts.
--
--   Pavan, Fri 25/09 — clocked into Stevenage at 16:54, six minutes before its
--     17:00 booking, so the sweep matched the HITCHIN booking and closed him
--     at 17:00. Five minutes recorded for an eight-hour shift. Correct the end.
--
-- Run STEP 0 first and read it. Then run STEP 1–4 as one transaction.
-- Times below are LONDON wall clock, written with the +01:00 BST offset.
-- =============================================================


-- =============================================================
-- STEP 0 — BEFORE. Run this on its own and check it matches what you expect.
-- =============================================================
select
  e.name,
  cs.event_date,
  cs.seq,
  st.name                                               as store,
  to_char(cs.clock_in_at  at time zone 'Europe/London', 'DD Mon HH24:MI') as clock_in,
  to_char(cs.clock_out_at at time zone 'Europe/London', 'DD Mon HH24:MI') as clock_out,
  round(extract(epoch from (cs.clock_out_at - cs.clock_in_at)) / 3600.0, 2) as hours,
  cs.hours_approved,
  cs.approved_hours,
  coalesce(cs.short_deliveries_count, 0) as sd,
  coalesce(cs.long_deliveries_count, 0)  as ld,
  cs.extra_short_deliveries              as ms,
  cs.extra_long_deliveries               as ml,
  cs.auto_clocked_out,
  cs.manual_entry
from clock_sessions cs
join employees e on e.id = cs.employee_id
left join stores st on st.id = cs.store_id
where cs.clock_event_id in (
  'cb0d1582-18e1-48dc-9fa5-bbd61c45f979',  -- Rohith 26/09
  'b68e1ec9-4602-4bd8-9de5-20e643af328c'   -- Pavan  25/09
)
order by e.name, cs.event_date, cs.clock_in_at;


-- =============================================================
-- STEP 1–4 — the repair. Run everything below as ONE block.
-- =============================================================
begin;

-- -------------------------------------------------------------
-- CONFIG. Change the drop splits if the defaults are wrong.
-- -------------------------------------------------------------
create temporary table repair_config on commit drop as
select
  -- Whoever is credited with entering these corrections. This FKs to
  -- auth.users, not allowed_users. The default is the account that already
  -- entered Rohith's manual clock-in on 26/09, so it is known to be valid.
  '339780e9-d7d7-43ee-b4fb-baa611a187c5'::uuid as actor,

  'ba5fa30b-6d6d-45f4-8cbc-0a962d560763'::uuid as hitchin,
  'b7506e8d-4eea-4502-8870-e61bbe1775ca'::uuid as stevenage,

  -- --- Rohith, Sat 26/09 ------------------------------------------------
  -- NOTE: the GPS-verified clock-in was 13:14, not 11:20. You have confirmed
  -- 11:20, so that is what is written; the recorded time is kept in the audit
  -- reason below. The 23:50 finish IS the verified clock-out and is reused
  -- exactly, GPS fix and all.
  '2026-09-26T11:20:00+01:00'::timestamptz as r_hitchin_in,
  '2026-09-26T16:10:00+01:00'::timestamptz as r_handover,
  '2026-09-26T23:50:31.649+01:00'::timestamptz as r_stevenage_out,

  -- The day recorded 6 SD / 1 LD / 0 MS / 1 ML ("Walkern"), ALL currently on
  -- Hitchin. Nothing in the data says how they split, so the default leaves
  -- them where they are rather than inventing a division. EDIT THESE, or
  -- leave them and split the drops in the per-shift boxes on Daily Approval
  -- after this runs — that is what Update 224 added them for.
  6 as r_hitchin_sd,   1 as r_hitchin_ld,   0 as r_hitchin_ms, 1 as r_hitchin_ml,
  0 as r_stevenage_sd, 0 as r_stevenage_ld, 0 as r_stevenage_ms, 0 as r_stevenage_ml,

  -- --- Pavan, Fri 25/09 -------------------------------------------------
  -- The Hitchin shift beneath this (11:56–16:54) is correct and is NOT touched.
  -- The evening's drops were never recorded; they stay NULL so Daily Approval
  -- flags the day rather than asserting a zero nobody counted.
  '2026-09-26T01:00:00+01:00'::timestamptz as p_stevenage_out;


-- -------------------------------------------------------------
-- STEP 1 — Rohith: the existing session becomes the HITCHIN half.
--
-- Its clock-out coordinates were recorded at STEVENAGE, hours later, so they
-- cannot stand against a 16:10 Hitchin finish. Cleared, and the row flagged
-- manual: a row with no coordinates is how this schema says "never
-- location-verified". The clock-in fix goes too, because the confirmed 11:20
-- is not the time that fix was taken.
-- -------------------------------------------------------------
update clock_sessions cs
set store_id            = c.hitchin,
    clock_in_at         = c.r_hitchin_in,
    clock_out_at        = c.r_handover,
    clock_in_lat        = null,
    clock_in_lng        = null,
    clock_out_lat       = null,
    clock_out_lng       = null,
    short_deliveries_count = c.r_hitchin_sd,
    long_deliveries_count  = c.r_hitchin_ld,
    extra_short_deliveries = c.r_hitchin_ms,
    extra_long_deliveries  = c.r_hitchin_ml,
    extra_short_reason  = case when c.r_hitchin_ms > 0 then coalesce(cs.extra_short_reason, 'Update 224 repair') end,
    extra_long_reason   = case when c.r_hitchin_ml > 0 then coalesce(cs.extra_long_reason, 'Walkern') end,
    -- Re-approved below at its own clocked length. Cleared here so a stale 5h
    -- correction cannot survive the split.
    hours_approved      = false,
    approved_hours      = null,
    hours_approved_by   = null,
    hours_approved_at   = null,
    manual_entry        = true,
    manual_entry_by     = c.actor,
    manual_entry_at     = now(),
    manual_entry_reason = 'Update 224 repair: day worked Hitchin then Stevenage on one clock session. Split to the real shifts so each store pays its own. Recorded clock-in was 13:14 (GPS Hitchin); corrected to 11:20 as confirmed by the manager.'
from repair_config c
where cs.id = '70dd89e8-d7dc-4e55-91ad-a1c158c2bd2c';


-- -------------------------------------------------------------
-- STEP 2 — Rohith: insert the STEVENAGE half.
--
-- The 23:50 clock-out fix WAS taken at Stevenage and is genuine, so it is
-- carried onto this row. Only the 16:10 start is a manager's statement.
-- Inserted already closed, so it can never occupy the one-open-session slot.
-- -------------------------------------------------------------
insert into clock_sessions (
  clock_event_id, employee_id, store_id, event_date, seq,
  clock_in_at, clock_out_at,
  clock_in_lat, clock_in_lng, clock_out_lat, clock_out_lng,
  short_deliveries_count, long_deliveries_count,
  extra_short_deliveries, extra_long_deliveries, extra_long_reason,
  manual_entry, manual_entry_by, manual_entry_at, manual_entry_reason
)
select
  'cb0d1582-18e1-48dc-9fa5-bbd61c45f979',
  '939073b6-8df1-470d-af8c-8be969f55320',
  c.stevenage,
  date '2026-09-26',
  coalesce((select max(seq) from clock_sessions
            where clock_event_id = 'cb0d1582-18e1-48dc-9fa5-bbd61c45f979'), 0) + 1,
  c.r_handover,
  c.r_stevenage_out,
  null, null,
  51.8749968, -0.1658929,   -- the genuine Stevenage clock-out fix
  c.r_stevenage_sd, c.r_stevenage_ld,
  c.r_stevenage_ms, c.r_stevenage_ml,
  case when c.r_stevenage_ml > 0 then 'Walkern' end,
  true, c.actor, now(),
  'Update 224 repair: the Stevenage half of a day recorded as one Hitchin session. Clock-out time and GPS are the genuine ones; the 16:10 start is the manager-confirmed handover.'
from repair_config c
-- Re-runnable: does nothing if the Stevenage shift is already there.
where not exists (
  select 1 from clock_sessions
  where clock_event_id = 'cb0d1582-18e1-48dc-9fa5-bbd61c45f979'
    and store_id = c.stevenage
);


-- -------------------------------------------------------------
-- STEP 2b — Rohith: re-approve BOTH shifts at their own clocked length.
--
-- The day was approved before the repair, so it is approved after it — this
-- corrects the record, it does not change who signed it off. No day total is
-- set anywhere: approved_hours stays NULL on each shift, which means "the
-- clocked time stood". Update 224 refuses a day total on a cross-store day
-- precisely because it would land on one store's till.
-- -------------------------------------------------------------
update clock_sessions cs
set hours_approved    = true,
    approved_hours    = null,
    hours_approved_by = c.actor,
    hours_approved_at = now()
from repair_config c
where cs.clock_event_id = 'cb0d1582-18e1-48dc-9fa5-bbd61c45f979'
  and cs.clock_out_at is not null;


-- -------------------------------------------------------------
-- STEP 3 — Pavan: correct the Stevenage finish.
--
-- Stops being an automatic close: a manager is now stating the real time. The
-- clock-out coordinates were never taken (the sweep invented the 17:00), so
-- there are none to clear. Left UNAPPROVED, exactly as it was.
-- -------------------------------------------------------------
update clock_sessions cs
set clock_out_at          = c.p_stevenage_out,
    auto_clocked_out      = false,
    auto_clock_out_source = null,
    auto_clock_out_at     = null,
    manual_entry          = true,
    manual_entry_by       = c.actor,
    manual_entry_at       = now(),
    manual_entry_reason   = 'Update 224 repair: the nightly sweep matched the Hitchin booking and closed this Stevenage shift at 17:00. Corrected to the manager-confirmed 01:00 finish.'
from repair_config c
where cs.id = '42e234f5-a6ad-49dd-b2bf-0494b20b216e';


-- -------------------------------------------------------------
-- STEP 4 — re-derive both day headers from their shifts.
--
-- This mirrors deriveDayHeader() in lib/clock-sessions.ts exactly, which is
-- the app's ONLY writer of these columns. Getting it wrong here would leave
-- the header disagreeing with its own shifts, which is the class of bug this
-- whole repair exists to undo.
--
--   clock_in_at   earliest clock-in                (by clock time, not seq)
--   clock_out_at  latest clock-out, NULL if any shift is open
--   worked_hours  SUM of completed shifts, rounded to the minute
--   store_id      the OPEN shift's store, else the LATEST shift's
--   deliveries    summed across shifts; NULL short/long only if no shift has any
--   approved_*    the same sums over the signed-off shifts
--   hours_approved  true only when every completed shift is signed off
-- -------------------------------------------------------------
with agg as (
  select
    cs.clock_event_id,
    min(cs.clock_in_at) as first_in,
    case when bool_or(cs.clock_out_at is null) then null else max(cs.clock_out_at) end as last_out,
    count(*) as session_count,
    count(*) filter (where cs.clock_out_at is not null) as completed_count,
    round(
      coalesce(sum(extract(epoch from (cs.clock_out_at - cs.clock_in_at)))
               filter (where cs.clock_out_at is not null), 0)::numeric / 60.0
    ) / 60.0 as worked_hours,
    (array_agg(cs.store_id order by (cs.clock_out_at is null) desc, cs.clock_in_at desc))[1] as store_id,

    sum(cs.short_deliveries_count) as sd,
    sum(cs.long_deliveries_count)  as ld,
    coalesce(sum(cs.extra_short_deliveries), 0) as ms,
    coalesce(sum(cs.extra_long_deliveries), 0)  as ml,
    (array_remove(array_agg(nullif(btrim(cs.extra_short_reason), '') order by cs.clock_in_at), null))[1] as ms_reason,
    (array_remove(array_agg(nullif(btrim(cs.extra_long_reason), '')  order by cs.clock_in_at), null))[1] as ml_reason,

    count(*) filter (where cs.hours_approved and cs.clock_out_at is not null) as approved_count,
    round(
      coalesce(sum(coalesce(cs.approved_hours,
                            extract(epoch from (cs.clock_out_at - cs.clock_in_at))::numeric / 3600.0))
               filter (where cs.hours_approved and cs.clock_out_at is not null), 0) * 60
    ) / 60.0 as approved_hours,
    sum(cs.short_deliveries_count) filter (where cs.hours_approved and cs.clock_out_at is not null) as a_sd,
    sum(cs.long_deliveries_count)  filter (where cs.hours_approved and cs.clock_out_at is not null) as a_ld,
    coalesce(sum(cs.extra_short_deliveries) filter (where cs.hours_approved and cs.clock_out_at is not null), 0) as a_ms,
    coalesce(sum(cs.extra_long_deliveries)  filter (where cs.hours_approved and cs.clock_out_at is not null), 0) as a_ml
  from clock_sessions cs
  where cs.clock_event_id in (
    'cb0d1582-18e1-48dc-9fa5-bbd61c45f979',
    'b68e1ec9-4602-4bd8-9de5-20e643af328c'
  )
  group by cs.clock_event_id
)
update clock_events ce
set clock_in_at    = agg.first_in,
    clock_out_at   = agg.last_out,
    worked_hours   = case when agg.completed_count > 0 then agg.worked_hours end,
    session_count  = agg.session_count,
    -- Never nulled: a legacy shift with no store leaves the day's own standing.
    store_id       = coalesce(agg.store_id, ce.store_id),
    -- Only overwrite the raw counts once a shift actually carries one. With no
    -- shift holding a count the sum is not "zero drops" — there is nothing to
    -- sum, and the header may still hold pre-033 counts worth keeping.
    short_deliveries_count = case when agg.sd is not null or agg.ld is not null or agg.ms > 0 or agg.ml > 0
                                  then agg.sd else ce.short_deliveries_count end,
    long_deliveries_count  = case when agg.sd is not null or agg.ld is not null or agg.ms > 0 or agg.ml > 0
                                  then agg.ld else ce.long_deliveries_count end,
    extra_short_deliveries = case when agg.sd is not null or agg.ld is not null or agg.ms > 0 or agg.ml > 0
                                  then agg.ms else ce.extra_short_deliveries end,
    extra_long_deliveries  = case when agg.sd is not null or agg.ld is not null or agg.ms > 0 or agg.ml > 0
                                  then agg.ml else ce.extra_long_deliveries end,
    extra_short_reason     = case when agg.sd is not null or agg.ld is not null or agg.ms > 0 or agg.ml > 0
                                  then agg.ms_reason else ce.extra_short_reason end,
    extra_long_reason      = case when agg.sd is not null or agg.ld is not null or agg.ms > 0 or agg.ml > 0
                                  then agg.ml_reason else ce.extra_long_reason end,
    approved_hours                  = case when agg.approved_count > 0 then agg.approved_hours end,
    approved_short_deliveries_count = agg.a_sd,
    approved_long_deliveries_count  = agg.a_ld,
    approved_extra_short_deliveries = agg.a_ms,
    approved_extra_long_deliveries  = agg.a_ml,
    approved_session_count          = agg.approved_count,
    hours_approved = (agg.approved_count > 0 and agg.approved_count = agg.completed_count),
    -- Both days described the old shape; nothing derives these.
    auto_clocked_out      = false,
    auto_clock_out_source = null,
    auto_clock_out_at     = null,
    hours_approved_by = case when agg.approved_count > 0
                             then coalesce(ce.hours_approved_by, (select actor from repair_config)) end,
    hours_approved_at = case when agg.approved_count > 0 then coalesce(ce.hours_approved_at, now()) end
from agg
where ce.id = agg.clock_event_id;


-- -------------------------------------------------------------
-- STEP 5 — recompute the weekly employee_hours rollup for w/c Mon 21/09.
--
-- Mirrors rollupApprovedWeek(). Keyed on approved_hours being PRESENT, not on
-- hours_approved: since migration 035 a day can be partly approved, and those
-- partial hours are payable, so the rollup has to include them or it disagrees
-- with the Tuesday sheet.
-- -------------------------------------------------------------
with totals as (
  select
    ce.employee_id,
    round(sum(ce.approved_hours) * 60) / 60.0 as total_hours
  from clock_events ce
  where ce.employee_id in (
          '939073b6-8df1-470d-af8c-8be969f55320',  -- Rohith
          'a03c5f7f-5c13-48db-971d-05841def4a78'   -- Pavan
        )
    and ce.event_date between date '2026-09-21' and date '2026-09-27'
    and ce.approved_hours is not null
  group by ce.employee_id
)
update employee_hours eh
set total_hours_worked  = totals.total_hours,
    hourly_rate_snapshot = coalesce(e.hourly_ni_rate, e.hourly_rate, 0),
    approved             = true,
    approved_at          = now()
from totals
join employees e on e.id = totals.employee_id
where eh.employee_id = totals.employee_id
  and eh.week_start_date = date '2026-09-21'
  -- Never touch an admin's manual correction for the same week.
  and eh.source = 'clocked';

commit;


-- =============================================================
-- STEP 6 — AFTER. Check this before you trust the payout.
-- =============================================================
select
  e.name,
  cs.event_date,
  cs.seq,
  st.name as store,
  to_char(cs.clock_in_at  at time zone 'Europe/London', 'DD Mon HH24:MI') as clock_in,
  to_char(cs.clock_out_at at time zone 'Europe/London', 'DD Mon HH24:MI') as clock_out,
  round(extract(epoch from (cs.clock_out_at - cs.clock_in_at)) / 3600.0, 2) as hours,
  cs.hours_approved,
  coalesce(cs.short_deliveries_count, 0) as sd,
  coalesce(cs.long_deliveries_count, 0)  as ld,
  cs.extra_long_deliveries as ml
from clock_sessions cs
join employees e on e.id = cs.employee_id
left join stores st on st.id = cs.store_id
where cs.clock_event_id in (
  'cb0d1582-18e1-48dc-9fa5-bbd61c45f979',
  'b68e1ec9-4602-4bd8-9de5-20e643af328c'
)
order by e.name, cs.event_date, cs.clock_in_at;

-- The day headers the whole app reads.
select
  e.name, ce.event_date, st.name as day_store,
  ce.worked_hours, ce.session_count, ce.hours_approved, ce.approved_hours,
  to_char(ce.clock_in_at  at time zone 'Europe/London', 'DD Mon HH24:MI') as day_in,
  to_char(ce.clock_out_at at time zone 'Europe/London', 'DD Mon HH24:MI') as day_out
from clock_events ce
join employees e on e.id = ce.employee_id
left join stores st on st.id = ce.store_id
where ce.id in (
  'cb0d1582-18e1-48dc-9fa5-bbd61c45f979',
  'b68e1ec9-4602-4bd8-9de5-20e643af328c'
);

-- What the Tuesday payout will now bill to each store.
select
  e.name, st.name as store,
  round(sum(extract(epoch from (cs.clock_out_at - cs.clock_in_at)) / 3600.0)::numeric, 2) as approved_hours,
  sum(coalesce(cs.short_deliveries_count, 0)) as sd,
  sum(coalesce(cs.long_deliveries_count, 0))  as ld
from clock_sessions cs
join employees e on e.id = cs.employee_id
join stores st on st.id = cs.store_id
where cs.event_date between date '2026-09-21' and date '2026-09-27'
  and cs.hours_approved
  and cs.employee_id in (
    '939073b6-8df1-470d-af8c-8be969f55320',
    'a03c5f7f-5c13-48db-971d-05841def4a78'
  )
group by e.name, st.name
order by e.name, st.name;
