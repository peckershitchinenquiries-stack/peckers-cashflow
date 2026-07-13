-- =============================================================
-- 015_push_subscriptions.sql
--
-- Web Push clock-in / clock-out reminders.
--
-- Employees forget to clock in when they arrive (and to clock out when they
-- leave). These two tables power a browser push reminder that fires at the
-- employee's scheduled shift start (and end), even when the app is closed.
--
--  * push_subscriptions — one row per browser/device an employee has opted in
--    from. Holds the W3C Push subscription (endpoint + encryption keys) the
--    server needs to deliver a notification to that device.
--
--  * push_reminders — a once-per-day-per-type send log. The reminder cron runs
--    every few minutes; this table's UNIQUE constraint is what stops the same
--    "time to clock in" reminder going out on every run.
--
-- Writes/reads are done by the server with the service-role client (mirrors how
-- account provisioning and auto-shift creation work), so RLS here is a safety
-- net: staff can review, and an employee can only ever see/manage their own row.
--
-- Run this in the Supabase SQL Editor.
-- =============================================================

-- ---------- subscriptions ----------
create table if not exists public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references public.employees(id) on delete cascade,
  -- The push service URL for this device. Unique so re-subscribing the same
  -- browser updates (not duplicates) its row.
  endpoint      text not null unique,
  -- Client public key + auth secret from the PushSubscription, needed to
  -- encrypt the payload for this device.
  p256dh        text not null,
  auth          text not null,
  user_agent    text,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

create index if not exists push_subscriptions_employee_idx
  on public.push_subscriptions (employee_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_select" on public.push_subscriptions;
drop policy if exists "push_subscriptions_insert" on public.push_subscriptions;
drop policy if exists "push_subscriptions_update" on public.push_subscriptions;
drop policy if exists "push_subscriptions_delete" on public.push_subscriptions;

-- Staff can review who has reminders on; an employee sees only their own rows.
create policy "push_subscriptions_select" on public.push_subscriptions
  for select to authenticated
  using (
    public.is_staff()
    or employee_id in (select id from public.employees where auth_user_id = auth.uid())
  );

-- An employee may manage their own subscription rows directly (fallback for a
-- caller-client write path; the server actions use the service-role client).
create policy "push_subscriptions_insert" on public.push_subscriptions
  for insert to authenticated
  with check (employee_id in (select id from public.employees where auth_user_id = auth.uid()));

create policy "push_subscriptions_update" on public.push_subscriptions
  for update to authenticated
  using (employee_id in (select id from public.employees where auth_user_id = auth.uid()));

create policy "push_subscriptions_delete" on public.push_subscriptions
  for delete to authenticated
  using (employee_id in (select id from public.employees where auth_user_id = auth.uid()));

grant all on public.push_subscriptions to authenticated, service_role;

-- ---------- send log (idempotency) ----------
create table if not exists public.push_reminders (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid not null references public.employees(id) on delete cascade,
  reminder_date  date not null,
  reminder_type  text not null check (reminder_type in ('clock_in','clock_out')),
  store_id       uuid references public.stores(id) on delete set null,
  sent_at        timestamptz not null default now(),
  -- One reminder of each type per employee per day — the cron inserts this row
  -- BEFORE sending, so a duplicate insert (next cron run) means "already sent".
  unique (employee_id, reminder_date, reminder_type)
);

create index if not exists push_reminders_date_idx
  on public.push_reminders (reminder_date desc);

alter table public.push_reminders enable row level security;

drop policy if exists "push_reminders_select" on public.push_reminders;

-- Server-written (service role). Staff may review the send log.
create policy "push_reminders_select" on public.push_reminders
  for select to authenticated
  using (public.is_staff());

grant all on public.push_reminders to authenticated, service_role;
