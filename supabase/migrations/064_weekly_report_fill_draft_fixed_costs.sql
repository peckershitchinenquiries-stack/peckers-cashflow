-- =============================================================
-- Migration 064 — fill the standing costs into the DRAFT weeks already open
--
-- Run AFTER 063. Idempotent.
--
-- 063 taught new weeks to open with their standing costs already entered, and
-- stamped `fixed_amount` onto the lines that already existed so the carry
-- forward had something to carry. What it deliberately did NOT do was touch any
-- week's `amount`.
--
-- That leaves a gap exactly where a manager notices it: a week opened and part
-- filled BEFORE 063 ran has the standing figures stamped but its cells still
-- blank, so the sheet a manager is in the middle of is the one place the
-- feature does not show. This fills those in, once.
--
-- THREE GUARDS, because this writes money nobody typed:
--
--   1. DRAFT reports only. A locked or sent week is a frozen record (the same
--      rule as a confirmed cash_payouts row) and is never rewritten.
--   2. The supplier must have NO amount anywhere in that week — not just a
--      blank row. If T Quality was invoiced £430 and typed into Invoice 1,
--      adding £415 to a second row would turn one invoice into two and double
--      the supplier's week.
--   3. `amount is null` is the test for "blank", not `amount = 0`. A typed zero
--      is a decision — Veggie Express and Butchers are genuinely £0 some weeks —
--      and overwriting it with a standing figure would contradict the manager.
--
-- Idempotent by construction: every row it fills stops being null, so a second
-- run matches nothing.
-- =============================================================

with target as (
  select l.id, l.fixed_amount
  from public.weekly_report_lines l
  join public.weekly_reports r on r.id = l.report_id
  where r.status = 'draft'
    and l.section = 'cogs_supplier'
    and l.fixed_amount is not null
    and l.amount is null
    and not exists (
      select 1
      from public.weekly_report_lines sib
      where sib.report_id = l.report_id
        and sib.section = 'cogs_supplier'
        and regexp_replace(lower(sib.label), '[^a-z0-9]', '', 'g')
          = regexp_replace(lower(l.label), '[^a-z0-9]', '', 'g')
        and sib.amount is not null
    )
)
update public.weekly_report_lines l
   set amount = t.fixed_amount
  from target t
 where t.id = l.id;
