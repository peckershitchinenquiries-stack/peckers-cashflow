-- =============================================================
-- 074 — a confirmed payout stays locked at the database (Update 274)
--
-- Security: "confirmed payouts are locked; only a Super Admin can unlock or
-- delete" was enforced only in app/actions/payouts.ts. The RLS policies
-- cash_payouts_modify / cash_payout_lines_modify (schema.sql) and
-- cash_payout_adjustments_modify (047) let any manager write anything on their
-- own store's rows, so with their own JWT and the public anon key a manager
-- could PATCH a locked payout back to draft, change a paid line's amount, or
-- rewrite surplus_carry_forward — which becomes next week's opening balance.
--
-- These triggers refuse, for anyone who is not an admin:
--   cash_payouts             UPDATE / DELETE of a locked row, and an INSERT that
--                            arrives already locked or confirmed.
--   cash_payout_lines        any write to a line whose payout is locked.
--   cash_payout_adjustments  same as lines.
--
-- No app flow is affected: every server action already refuses these writes
-- for a locked payout, and confirmPayout locks a row that is still unlocked.
-- Admins (unlockPayout, deletePayout and its cascade) and non-end-user roles
-- (service_role, postgres) pass straight through, like migration 073.
--
-- Also adds cash_payout_lines.paid_amount (fix for the "tick stays on after the
-- amount changes" gap): markLinePaid records the amount the line showed when it
-- was ticked, and the payout sheet warns when the line has since moved.
-- Display only — nothing reads it in the pay maths.
--
-- Additive and idempotent. Run BEFORE deploying the matching code: the new
-- markLinePaid writes paid_amount.
-- =============================================================

-- ------------------------------------------------------- paid_amount column
alter table public.cash_payout_lines
  add column if not exists paid_amount numeric(10,2);

comment on column public.cash_payout_lines.paid_amount is
  'total_payment at the moment the line was ticked paid (Update 274). Null when unticked. A difference from total_payment means the line changed after the cash was handed over.';

-- Lines already ticked: assume what was handed over is what the line shows now.
-- Runs as the migration owner, so the guards below do not apply to it.
update public.cash_payout_lines
   set paid_amount = total_payment
 where is_paid
   and paid_amount is null;

-- ---------------------------------------------------------- payout header
create or replace function public.cash_payouts_guard_lock()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user <> 'authenticated' then
    return coalesce(new, old);
  end if;
  if public.is_admin(auth.jwt() ->> 'email') then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    if new.locked or new.status = 'confirmed' then
      raise exception 'A payout can only be confirmed from the payout sheet.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if old.locked then
    raise exception 'This payout is confirmed and locked. A Super Admin must unlock it to amend.'
      using errcode = '42501';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists cash_payouts_guard_lock on public.cash_payouts;
create trigger cash_payouts_guard_lock
  before insert or update or delete on public.cash_payouts
  for each row execute function public.cash_payouts_guard_lock();

-- ------------------------------------------- lines + adjustments (children)
create or replace function public.cash_payout_children_guard_lock()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_locked boolean;
begin
  if current_user <> 'authenticated' then
    return coalesce(new, old);
  end if;
  if public.is_admin(auth.jwt() ->> 'email') then
    return coalesce(new, old);
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    select p.locked into v_locked from public.cash_payouts p where p.id = old.payout_id;
    if coalesce(v_locked, false) then
      raise exception 'This payout is confirmed and locked. A Super Admin must unlock it to amend.'
        using errcode = '42501';
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    select p.locked into v_locked from public.cash_payouts p where p.id = new.payout_id;
    if coalesce(v_locked, false) then
      raise exception 'This payout is confirmed and locked. A Super Admin must unlock it to amend.'
        using errcode = '42501';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists cash_payout_lines_guard_lock on public.cash_payout_lines;
create trigger cash_payout_lines_guard_lock
  before insert or update or delete on public.cash_payout_lines
  for each row execute function public.cash_payout_children_guard_lock();

drop trigger if exists cash_payout_adjustments_guard_lock on public.cash_payout_adjustments;
create trigger cash_payout_adjustments_guard_lock
  before insert or update or delete on public.cash_payout_adjustments
  for each row execute function public.cash_payout_children_guard_lock();
