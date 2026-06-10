-- =============================================================
-- Migration 001 — Supermarket expenses on daily cash entries
-- Adds a per-day supermarket/supplies spend figure to the cash
-- reconciliation row. Informational only — it does NOT affect the
-- Vita-vs-envelope `difference` generated column.
-- Run this in the Supabase SQL editor (or via `supabase db push`).
-- =============================================================

alter table public.daily_cash_entries
  add column if not exists supermarket_expenses numeric(10,2) not null default 0;
