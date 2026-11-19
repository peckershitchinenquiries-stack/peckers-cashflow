-- =============================================================
-- 076 — managers may book other managers' rota shifts (Update 285)
--
-- 017 made manager_shifts admin-only. A manager now books a peer onto the
-- store they are running, the same way they already book employees
-- (rota_shifts) and cover drivers (cover_driver_shifts, 025).
--
-- can_access_store(store_id) = admin, or a manager whose ACTIVE store
-- (migration 020) is that store. USING applies to the row as it stands, so a
-- manager cannot edit or clear a booking held by the other store; WITH CHECK
-- applies to the row written, so they cannot move one there either. The
-- target must be a manager account: this grants rota booking, not a way to
-- schedule admins, employees or cover drivers through this table.
--
-- Pay is unaffected: a manager's fixed daily wage never reads the rota, and
-- their drops are paid from approved clock sessions only.
--
-- Deploy order: safe either way. Before the code ships, the old action still
-- refuses managers; after, both layers allow the same thing. Idempotent.
-- =============================================================

drop policy if exists "manager_shifts_modify" on public.manager_shifts;

create policy "manager_shifts_modify" on public.manager_shifts
  for all to authenticated
  using (public.can_access_store(store_id))
  with check (
    public.can_access_store(store_id)
    and exists (
      select 1 from public.allowed_users au
      where au.id = manager_id and au.role = 'manager'
    )
  );
