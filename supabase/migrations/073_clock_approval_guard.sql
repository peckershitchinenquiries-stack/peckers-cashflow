-- =============================================================
-- 073 — clock approval columns are staff-only (Update 273)
--
-- Security: approval is the pay gate (migration 035), but it lives in columns
-- on rows the employee can write. clock_sessions_insert/update (029) and
-- clock_events_insert/update (schema.sql) allow employee_id =
-- current_employee_id() with no column restriction, so an employee could use
-- their own JWT and the public anon key to PATCH their shift to
-- hours_approved = true / approved_hours = 24, or insert a session-less day
-- header carrying approved_hours, and be paid for it on the Tuesday payout.
--
-- The self-write policies must stay: crew clock-in/out (lib/clock-core.ts,
-- app/actions/clock.ts) write these rows through the employee's own session.
-- These triggers restrict only WHAT an end user who is not staff may write:
--
-- clock_sessions (crew)
--   INSERT  a new shift always starts unapproved.
--   UPDATE  approval columns keep their stored values; and once a shift is
--           approved, its times, store, date and delivery counts are frozen —
--           only a manager can change a signed-off shift.
--           (Crew paths only ever touch their own OPEN shift, which can never
--           be approved, so no legitimate crew write is refused.)
--
-- clock_events (crew)
--   INSERT  a new day header always starts unapproved.
--   UPDATE  approved totals keep their stored values; hours_approved may only
--           go true -> false. recomputeDayHeader runs on the employee's own
--           session at clock-in/out and rewrites these columns; the only change
--           it can legitimately make there is "a new unapproved shift means the
--           day is no longer fully approved". Values are held rather than
--           refused so a stale header can never make a clock-out fail; the next
--           manager action recomputes them anyway, and the payout pays from the
--           shifts whenever a day has any.
--
-- Staff (is_staff()) and non-end-user roles (service_role, postgres) are not
-- affected, so Daily Approval, manual entries and the auto clock-out sweep
-- behave exactly as before. Restrictive only; safe before or after the code
-- deploy. Idempotent.
-- =============================================================

-- ---------------------------------------------------------------- sessions
create or replace function public.clock_sessions_guard_approval()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if public.is_staff() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.hours_approved    := false;
    new.approved_hours    := null;
    new.hours_approved_by := null;
    new.hours_approved_at := null;
    return new;
  end if;

  if old.hours_approved and (
       new.clock_in_at            is distinct from old.clock_in_at
    or new.clock_out_at           is distinct from old.clock_out_at
    or new.store_id               is distinct from old.store_id
    or new.event_date             is distinct from old.event_date
    or new.employee_id            is distinct from old.employee_id
    or new.clock_event_id         is distinct from old.clock_event_id
    or new.short_deliveries_count is distinct from old.short_deliveries_count
    or new.long_deliveries_count  is distinct from old.long_deliveries_count
    or new.extra_short_deliveries is distinct from old.extra_short_deliveries
    or new.extra_long_deliveries  is distinct from old.extra_long_deliveries
  ) then
    raise exception 'This shift has been approved. Ask a manager to change it.'
      using errcode = '42501';
  end if;

  new.hours_approved    := old.hours_approved;
  new.approved_hours    := old.approved_hours;
  new.hours_approved_by := old.hours_approved_by;
  new.hours_approved_at := old.hours_approved_at;
  return new;
end;
$$;

drop trigger if exists clock_sessions_guard_approval on public.clock_sessions;
create trigger clock_sessions_guard_approval
  before insert or update on public.clock_sessions
  for each row execute function public.clock_sessions_guard_approval();

-- ------------------------------------------------------------- day headers
create or replace function public.clock_events_guard_approval()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if public.is_staff() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.hours_approved                  := false;
    new.approved_hours                  := null;
    new.hours_approved_by               := null;
    new.hours_approved_at               := null;
    new.approved_short_deliveries_count := null;
    new.approved_long_deliveries_count  := null;
    new.approved_extra_short_deliveries := 0;
    new.approved_extra_long_deliveries  := 0;
    new.approved_session_count          := 0;
    return new;
  end if;

  new.hours_approved                  := old.hours_approved and new.hours_approved;
  new.approved_hours                  := old.approved_hours;
  new.hours_approved_by               := old.hours_approved_by;
  new.hours_approved_at               := old.hours_approved_at;
  new.approved_short_deliveries_count := old.approved_short_deliveries_count;
  new.approved_long_deliveries_count  := old.approved_long_deliveries_count;
  new.approved_extra_short_deliveries := old.approved_extra_short_deliveries;
  new.approved_extra_long_deliveries  := old.approved_extra_long_deliveries;
  new.approved_session_count          := old.approved_session_count;
  return new;
end;
$$;

drop trigger if exists clock_events_guard_approval on public.clock_events;
create trigger clock_events_guard_approval
  before insert or update on public.clock_events
  for each row execute function public.clock_events_guard_approval();
