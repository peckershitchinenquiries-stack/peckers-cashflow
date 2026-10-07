-- =============================================================
-- Migration 063 — Weekly Report: standing fixed costs, and a note per sheet
--
-- Run AFTER 062. ADDITIVE ONLY: one nullable column and one new table, read by
-- nothing currently deployed, so it is safe to run before the code ships (the
-- rule migration 027 nearly broke — see Update 65).
--
-- (1) FIXED COSTS — the yellow rows on the paper Cost of Goods sheet
--
-- Roughly two thirds of a store's suppliers invoice the same amount every week:
-- Stevenage pays T Quality £415, Hulses £310, Samosa £289 and takes a £128 oil
-- credit, week in week out; Hitchin has its own set. On paper those rows are
-- highlighted and simply copied forward when the workbook is duplicated. In the
-- app they were retyped from scratch every Monday.
--
-- `fixed_amount` is that standing figure, held ON THE LINE for the same reason
-- `unit_rate` is (see 048): it is data that changes, it differs per store, and a
-- week already locked must keep the figure it was actually costed at. A
-- TypeScript constant would silently restate history the day a price moves.
--
-- IT IS NOT THE WEEK'S MONEY. `amount` still is, and still is the only thing
-- the P&L sums. `fixed_amount` only says what a new week OPENS with, which is
-- what keeps "T Quality was £430 that one week" from becoming the new standing
-- figure.
--
-- (2) NOTES — the unreferenced numbers in column F
--
-- Every sheet the managers send carries scribbles beside the grid: "113,142,170
-- oil" next to Magna, "183,107,301,438,130,78,46" next to MS Foods — invoice
-- numbers, kept for the manager's own clarity and summed by nothing. There was
-- nowhere to put them, so they were lost on the way into the app.
--
-- One row per (report, tab) rather than a jsonb map on the header: two sheets
-- open in two tabs would read-modify-write the same map and clobber each other.
-- Deliberately NOT carried forward — these are this week's invoice numbers, not
-- a structure, the same reason `expense` lines are not carried.
--
-- Idempotent.
-- =============================================================

alter table public.weekly_report_lines
  add column if not exists fixed_amount numeric(12,2);

comment on column public.weekly_report_lines.fixed_amount is
  'This line''s STANDING weekly figure — the highlighted rows on the paper sheet. Null = an ordinary variable line. A new week opens with `amount` seeded from it; editing the week''s amount never changes it.';

-- =============================================================
-- Stamp the standing figures onto the lines that already exist.
--
-- WHY THIS IS NEEDED AT ALL. A new week is seeded from the newest earlier week
-- that holds lines, never from the built-in defaults once a store has any
-- history — and both stores have months of it. Without this backfill every
-- carried line would arrive with a null `fixed_amount`, so the prefill would
-- never fire for either store and the built-in defaults would be dead code.
--
-- IT WRITES `fixed_amount` AND NOTHING ELSE. No week's `amount` moves, so no
-- figure anyone has entered, locked or sent changes by a penny — this is new
-- metadata on old rows, not a restatement of them. Locked and sent weeks are
-- stamped too, because the carry-forward may well read its structure from one.
--
-- Matched on a FOLDED label (lowercased, punctuation and spaces stripped), the
-- same way the Cost of Goods grid groups its suppliers: the sheets carry
-- "Cotsco" for Costco and "Amazon+ nisbets" for Amazon + Nisbets, and a strict
-- match would skip exactly the rows this exists to catch.
--
-- ONE ROW PER SUPPLIER PER REPORT. A supplier with two invoice rows in a week
-- must not end up with the standing figure on both, or the next week would open
-- with it entered twice and the sheet would total double.
--
-- Idempotent: re-running overwrites the same rows with the same figures.
-- =============================================================
with standing (store_match, label, amount) as (
  values
    -- Stevenage, from its week commencing 2026-09-21.
    ('stevenage', 'tquality',          415.00),
    ('stevenage', 'jjs',                55.00),
    -- A credit, not a cost: the oil collection pays the store back.
    ('stevenage', 'oil',              -128.00),
    ('stevenage', 'hulses',            310.00),
    ('stevenage', 'softdrinks',        380.00),
    ('stevenage', 'lovelysingh',       200.00),
    ('stevenage', 'edwardswine',       115.00),
    ('stevenage', 'costco',             50.00),
    ('stevenage', 'cotsco',             50.00),
    ('stevenage', 'amazonnisbets',      15.00),
    ('stevenage', 'onestop',            20.00),
    ('stevenage', 'samosa',            289.00),
    ('stevenage', 'bluerollsgloves',   145.00),
    -- Hitchin, from the same week.
    ('hitchin',   'tquality',          300.00),
    ('hitchin',   'jjs',                50.00),
    ('hitchin',   'oil',               -72.00),
    ('hitchin',   'hulses',            250.00),
    ('hitchin',   'softdrinks',        250.00),
    ('hitchin',   'lovelysingh',       150.00),
    ('hitchin',   'veggieexpress',       0.00),
    ('hitchin',   'amazon',              0.00),
    ('hitchin',   'nisa',               10.00),
    ('hitchin',   'butchers',            0.00),
    ('hitchin',   'costco',             50.00)
),
first_per_supplier as (
  select id, amount from (
    select
      l.id,
      s.amount,
      row_number() over (
        partition by l.report_id, regexp_replace(lower(l.label), '[^a-z0-9]', '', 'g')
        order by l.sort_order, l.created_at, l.id
      ) as rn
    from public.weekly_report_lines l
    join public.weekly_reports r on r.id = l.report_id
    join public.stores st on st.id = r.store_id
    join standing s
      on s.label = regexp_replace(lower(l.label), '[^a-z0-9]', '', 'g')
     and st.name ilike '%' || s.store_match || '%'
    where l.section = 'cogs_supplier'
  ) ranked
  where rn = 1
)
update public.weekly_report_lines l
   set fixed_amount = f.amount
  from first_per_supplier f
 where f.id = l.id
   and l.fixed_amount is distinct from f.amount;

create table if not exists public.weekly_report_notes (
  id         uuid primary key default gen_random_uuid(),
  report_id  uuid not null references public.weekly_reports(id) on delete cascade,
  -- The ?tab= value, so a note belongs to the sheet it was written beside.
  tab        text not null check (tab in (
               'summary','cogs','walkern','hitchin','fillings','labour',
               'occupancy','aggregator','expenses','channels')),
  body       text not null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (report_id, tab)
);

comment on table public.weekly_report_notes is
  'A manager''s free-text note against one sheet of one week. Record only — nothing here reaches the P&L, exactly like the scribbled invoice numbers beside the paper grid it replaces.';

create index if not exists weekly_report_notes_report_idx
  on public.weekly_report_notes (report_id);

drop trigger if exists set_weekly_report_notes_updated_at on public.weekly_report_notes;
create trigger set_weekly_report_notes_updated_at
  before update on public.weekly_report_notes
  for each row execute function public.set_updated_at();

-- Same split as every other weekly-report table (048): staff read, because the
-- combined view spans both stores; only the owning store writes.
alter table public.weekly_report_notes enable row level security;

drop policy if exists "weekly_report_notes_select" on public.weekly_report_notes;
drop policy if exists "weekly_report_notes_modify" on public.weekly_report_notes;

create policy "weekly_report_notes_select" on public.weekly_report_notes
  for select to authenticated
  using (public.is_staff());

create policy "weekly_report_notes_modify" on public.weekly_report_notes
  for all to authenticated
  using (
    exists (
      select 1 from public.weekly_reports r
      where r.id = report_id and public.can_access_store(r.store_id)
    )
  )
  with check (
    exists (
      select 1 from public.weekly_reports r
      where r.id = report_id and public.can_access_store(r.store_id)
    )
  );
