-- =============================================================
-- Migration 065 — Hitchin's three missing standing suppliers
--
-- Run AFTER 064. Idempotent.
--
-- Hitchin's paper Cost of Goods sheet carries Veggie Express, Amazon and
-- Butchers among its shaded standing rows. The app never had them: they were
-- absent from the store's original seed list, so no `weekly_report_lines` row
-- ever existed under those names, so 063's stamp had nothing to attach their
-- standing figures to and 064 had nothing to fill. Adding them to
-- HITCHIN_DEFAULTS does not help either — that list is only ever read for a
-- store with NO history, and Hitchin has months of it.
--
-- All three are £0 on the sheet, so this changes no total anywhere: not COGS,
-- not gross margin, not the Tuesday payout. What it changes is that the sheet
-- on screen now holds the same rows as the sheet on paper, which is the whole
-- point of the standing-cost list — a row that reads £0 says "checked, nothing
-- this week", and a row that is absent says nothing at all.
--
-- `amount` AND `fixed_amount` are both set to 0: the first is this week's
-- figure, the second is what next week opens with and what shades the row.
--
-- DRAFT reports only, as in 064 — a locked or sent week is a frozen record.
-- Future weeks inherit the rows through the ordinary carry-forward, which
-- copies the structure of the newest earlier week holding any lines.
--
-- Appended after the report's last supplier rather than slotted between Lovely
-- Singh and NISA where the paper sheet keeps them. The grid has no reordering,
-- so a predictable position at the end beats guessing at an insertion point.
--
-- Idempotent: the NOT EXISTS below matches on the same FOLDED label the grid
-- groups suppliers by, so a re-run adds nothing and a store that already spells
-- one of them differently is left alone rather than given a duplicate.
-- =============================================================

with hitchin_drafts as (
  select r.id as report_id,
         coalesce(max(l.sort_order), 0) as max_sort
  from public.weekly_reports r
  join public.stores st on st.id = r.store_id
  left join public.weekly_report_lines l
    on l.report_id = r.id
   and l.section = 'cogs_supplier'
  where r.status = 'draft'
    and st.name ilike '%hitchin%'
  group by r.id
),
missing (label, amount, slot) as (
  values
    ('Veggie Express', 0.00, 1),
    ('Amazon',         0.00, 2),
    ('Butchers',       0.00, 3)
)
insert into public.weekly_report_lines
  (report_id, section, label, sort_order, amount, fixed_amount)
select
  d.report_id,
  'cogs_supplier',
  m.label,
  -- Suppliers are spaced MAX_INVOICE_COLUMNS apart so each one's invoices sort
  -- together, matching what SupplierInvoiceGrid writes back.
  d.max_sort + m.slot * 10,
  m.amount,
  m.amount
from hitchin_drafts d
cross join missing m
where not exists (
  select 1
  from public.weekly_report_lines x
  where x.report_id = d.report_id
    and x.section = 'cogs_supplier'
    and regexp_replace(lower(x.label), '[^a-z0-9]', '', 'g')
      = regexp_replace(lower(m.label), '[^a-z0-9]', '', 'g')
);
