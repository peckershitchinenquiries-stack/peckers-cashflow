-- =============================================================
-- Migration 061 — A manager's drops for ONE day can be recorded at EACH store
--
-- Run AFTER 060. ADDITIVE in effect: the only index replaced is WIDENED, so
-- every row that satisfied the old rule satisfies this one and nothing the
-- currently deployed build writes stops working (the rule migration 027 nearly
-- broke — see Update 65).
--
-- THE PROBLEM
-- Migration 037 capped a day at ONE deliveries-only session, so a manager who
-- covered a round at Hitchin and another at Stevenage on the same date had
-- nowhere to put the second: the entry modal CORRECTED the first rather than
-- adding to it. Worse, the Tuesday payout read the DAY HEADER, whose single
-- store_id names only the last shift's store — so even two real shifts at two
-- stores billed the whole day's drops to one of them.
--
-- THE FIX
-- Exactly what employees have had since the per-shift store work (Update 98):
-- the shift carries the store, and pay is resolved from the shifts. The cap
-- becomes one deliveries-only row PER STORE, so re-entering a store's round
-- still corrects it rather than paying it twice.
--
-- Idempotent. Run in the Supabase SQL editor (or via `supabase db push`).
-- =============================================================

drop index if exists public.manager_clock_sessions_one_deliveries_only;

create unique index if not exists manager_clock_sessions_one_deliveries_only_per_store
  on public.manager_clock_sessions (clock_event_id, store_id)
  where deliveries_only;

comment on index public.manager_clock_sessions_one_deliveries_only_per_store is
  'One hand-entered deliveries row per day PER STORE (migration 061). Re-recording a store''s round corrects it; a second store''s round is a row of its own.';

-- Backfill: none. Every existing day holds at most one deliveries-only row, so
-- no figure anywhere moves by a penny.

-- =============================================================
-- RLS — the day row follows its SHIFTS, not just its header
--
-- 034 scoped manager_clock_events to can_access_store(store_id). The header
-- carries only the LAST shift's store, so a day whose evening was at the other
-- store became invisible to the manager who signed off its morning round — and
-- Daily Approval needs the day row, not just the session. An EXISTS over the
-- day's sessions is added as an alternative; the existing clauses are kept, so
-- nothing that worked stops.
-- =============================================================
drop policy if exists "manager_clock_select" on public.manager_clock_events;
create policy "manager_clock_select" on public.manager_clock_events
  for select to authenticated
  using (
    public.is_admin(auth.jwt() ->> 'email')
    or manager_id = public.current_allowed_user_id()
    or public.can_access_store(store_id)
    or exists (
      select 1 from public.manager_clock_sessions s
      where s.clock_event_id = manager_clock_events.id
        and public.can_access_store(s.store_id)
    )
  );

drop policy if exists "manager_clock_update" on public.manager_clock_events;
create policy "manager_clock_update" on public.manager_clock_events
  for update to authenticated
  using (
    manager_id = public.current_allowed_user_id()
    or public.can_access_store(store_id)
    or exists (
      select 1 from public.manager_clock_sessions s
      where s.clock_event_id = manager_clock_events.id
        and public.can_access_store(s.store_id)
    )
  )
  with check (
    manager_id = public.current_allowed_user_id()
    or public.can_access_store(store_id)
    or exists (
      select 1 from public.manager_clock_sessions s
      where s.clock_event_id = manager_clock_events.id
        and public.can_access_store(s.store_id)
    )
  );
