-- =============================================================
-- Migration 005 — envelope reason semantics (run after 001–004)
--
-- The envelope is now EXPECTED to equal (vita_mojo_sales − supermarket_expenses).
-- A reason is only required when the manager overrides the envelope to a
-- different figure — not merely whenever sales ≠ envelope (which is now the
-- normal case, since supermarket spend reduces the envelope).
-- =============================================================

alter table public.daily_cash_entries
  drop constraint if exists daily_cash_entries_reason_required;

alter table public.daily_cash_entries
  add constraint daily_cash_entries_reason_required
  check (
    envelope_amount = vita_mojo_sales - supermarket_expenses
    or (reason is not null and length(btrim(reason)) > 0)
  );
