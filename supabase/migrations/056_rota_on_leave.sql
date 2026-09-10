-- =============================================================
-- 056: "On Leave" on the Rota, alongside "Day Off".
--
-- Leave is stored as a Day Off carrying one extra flag, never as a third kind
-- of cell. Every rule that reads `is_day_off` -- zero scheduled hours, Rota
-- totals, the 4-week average, the Live board, the early clock-in OTP gate, the
-- auto clock-out sweep, shift reminders, alerts, clock-in converting the cell
-- into a worked shift -- therefore treats leave exactly like a Day Off with no
-- code change. The flag only changes the LABEL.
--
-- Invariant: is_on_leave implies is_day_off. The trigger enforces it by
-- clearing the flag whenever a row becomes a working shift, so any writer that
-- only knows about is_day_off (clock-in's auto-shift conversion, "apply
-- schedule to week", a future one) can never leave a worked shift marked as
-- leave. A CHECK constraint would instead REJECT those writes, and clock-in's
-- conversion swallows its errors.
--
-- Additive only: safe to run BEFORE deploying the code that reads the column.
-- Run it FIRST -- the new Rota query selects `is_on_leave` and fails without it.
-- =============================================================

alter table public.rota_shifts
  add column if not exists is_on_leave boolean not null default false;
alter table public.manager_shifts
  add column if not exists is_on_leave boolean not null default false;
alter table public.cover_driver_shifts
  add column if not exists is_on_leave boolean not null default false;

create or replace function public.clear_leave_on_working_shift()
returns trigger
language plpgsql
as $$
begin
  if not new.is_day_off then
    new.is_on_leave := false;
  end if;
  return new;
end;
$$;

drop trigger if exists clear_leave_on_working_shift on public.rota_shifts;
create trigger clear_leave_on_working_shift
  before insert or update on public.rota_shifts
  for each row execute function public.clear_leave_on_working_shift();

drop trigger if exists clear_leave_on_working_shift on public.manager_shifts;
create trigger clear_leave_on_working_shift
  before insert or update on public.manager_shifts
  for each row execute function public.clear_leave_on_working_shift();

drop trigger if exists clear_leave_on_working_shift on public.cover_driver_shifts;
create trigger clear_leave_on_working_shift
  before insert or update on public.cover_driver_shifts
  for each row execute function public.clear_leave_on_working_shift();
