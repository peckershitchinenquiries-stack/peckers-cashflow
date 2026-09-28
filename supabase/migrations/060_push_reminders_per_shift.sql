-- =============================================================
-- Migration 060 — one reminder per SHIFT, not per day (Update 225)
--
-- push_reminders / manager_push_reminders are the send log that stops the
-- reminder cron repeating on every run. Their unique key was
-- (person, reminder_date, reminder_type) — one clock-in reminder per person per
-- day. Now that a day can hold a booked morning at one store and a booked
-- evening at another, that key silently swallowed the second shift's reminder:
-- once the morning's had been claimed, the evening one could never be sent.
--
-- The key gains the shift's START TIME, so each booking gets its own reminder and
-- each is still sent exactly once. NOT NULL with a default, deliberately: a
-- nullable column in a unique index makes every legacy row distinct from every
-- other and would let duplicates straight through.
--
-- DEPLOY ORDER: ship the code FIRST, then run this. The new code upserts on the
-- new key, so between deploying it and running this the claim insert fails, the
-- run logs "claim failed" and sends nothing — a reminder is skipped, nothing
-- breaks. Running this before the code ships would instead let the OLD code
-- insert unbounded duplicate rows and re-send the same reminder every few
-- minutes (see CLAUDE.md, "Deploy ordering matters").
--
-- Idempotent and safe to re-run.
-- =============================================================

alter table public.push_reminders
  add column if not exists shift_start time not null default '00:00';

alter table public.manager_push_reminders
  add column if not exists shift_start time not null default '00:00';

-- The old UNIQUE from migrations 015 / 018 is a table constraint, and its
-- generated name is truncated to 63 chars — so it's found by its columns rather
-- than by a name spelled out here and hoped to be right.
do $$
declare
  c record;
begin
  for c in
    select rel.relname as table_name, con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public'
      and con.contype = 'u'
      and rel.relname in ('push_reminders', 'manager_push_reminders')
      and (
        select array_agg(att.attname::text order by att.attname::text)
        from unnest(con.conkey) k
        join pg_attribute att on att.attrelid = con.conrelid and att.attnum = k
      ) in (
        array['employee_id', 'reminder_date', 'reminder_type'],
        array['manager_id', 'reminder_date', 'reminder_type']
      )
  loop
    execute format('alter table public.%I drop constraint %I', c.table_name, c.conname);
  end loop;
end $$;

-- Plain column list, not an expression: PostgREST's `onConflict` names columns,
-- and an expression index can't be an ON CONFLICT target through it.
create unique index if not exists push_reminders_once_per_shift
  on public.push_reminders (employee_id, reminder_date, reminder_type, shift_start);

create unique index if not exists manager_push_reminders_once_per_shift
  on public.manager_push_reminders (manager_id, reminder_date, reminder_type, shift_start);
