-- =============================================================
-- 062 — a cover driver's day belongs to the store that WORKED them
--
-- A cover driver clocks in at whichever store they're standing in
-- (detectStoreForLocation), and their day and pay are attributed to it:
-- cover_driver_hours.store_id is written from the CLOCK EVENT, and the Tuesday
-- sheet pays it from that store's till.
--
-- Every policy below already agreed — cover_driver_clock_events and
-- cover_driver_hours are both scoped to the store on the ROW, so the host
-- store's manager can read the day, correct its counts and insert the approved
-- row. Only cover_drivers itself was keyed on the driver's HOME store, so the
-- host manager could not read the name or the rates the approval snapshots:
-- the action failed at "Cover driver not found" before its own store guard.
--
-- SELECT is widened to a driver who has clocked a day at a store the caller can
-- access. The modify policy is deliberately left alone — rates and HR stay with
-- the store the driver belongs to.
--
-- Widening only: the existing clauses are kept, so nothing that worked stops.
-- =============================================================

drop policy if exists "cover_drivers_select" on public.cover_drivers;
create policy "cover_drivers_select" on public.cover_drivers
  for select to authenticated
  using (
    public.can_access_store(store_id)
    or id = public.current_cover_driver_id()
    or exists (
      select 1 from public.cover_driver_clock_events e
      where e.cover_driver_id = cover_drivers.id
        and public.can_access_store(e.store_id)
    )
  );

-- Backfill: none. No figure moves — this only lets the manager who already
-- holds the day read the driver it belongs to.
