-- =============================================================
-- Migration 011 — Weekly Summary manual inputs
--
-- Creates a table to store manager-entered operational costs for
-- the Weekly Summary dashboard. Managers enter:
-- - COGS (Cost of Goods)
-- - COGS Hitchin (complementary store value)
-- - Fillings and Samosas revenue
-- - Packaging, Marketing, Labour, Occupancy costs
-- - Aggregator (commission) costs
-- - Budget percentages for Gross Margin and Labour
--
-- Unique constraint on (store, week_start_iso) ensures one entry per
-- store per week. Managers can edit entries within their store's records.
-- =============================================================

create table if not exists public.weekly_summary_inputs (
  id uuid primary key default gen_random_uuid(),
  store text not null,
  week_start_iso date not null,

  -- Manager-entered operational metrics
  cogs numeric(10,2),
  cogs_hitchin numeric(10,2),
  fillings_and_samosas numeric(10,2),
  packaging_costs numeric(10,2),
  marketing numeric(10,2),
  labour_cost numeric(10,2),
  occupancy_cost numeric(10,2),
  aggregator_costs numeric(10,2),

  -- Budget percentages (stored as decimals: 0.65 for 65%)
  gross_margin_budget_pct numeric(5,4),
  labour_budget_pct numeric(5,4),

  -- Metadata
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),

  -- Ensure one entry per store per week
  unique(store, week_start_iso),

  -- Ensure valid store names
  constraint valid_store check (store in ('Peckers Hitchin', 'Peckers Stevenage'))
);

-- Enable RLS
alter table public.weekly_summary_inputs enable row level security;

-- Allow authenticated users to read/write their own store's data
-- (In production, refine to check the user's assigned store)
create policy "Allow authenticated users to read" on public.weekly_summary_inputs
  for select using (auth.role() = 'authenticated');

create policy "Allow authenticated users to insert" on public.weekly_summary_inputs
  for insert with check (auth.role() = 'authenticated');

create policy "Allow authenticated users to update" on public.weekly_summary_inputs
  for update using (auth.role() = 'authenticated');

-- Update the updated_at timestamp on modification
create or replace function public.update_weekly_summary_inputs_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists weekly_summary_inputs_update_timestamp on public.weekly_summary_inputs;
create trigger weekly_summary_inputs_update_timestamp
  before update on public.weekly_summary_inputs
  for each row execute function public.update_weekly_summary_inputs_timestamp();

-- Index for common queries
create index if not exists idx_weekly_summary_inputs_store_week
  on public.weekly_summary_inputs(store, week_start_iso desc);
