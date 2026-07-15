-- =============================================================
-- 018_manager_push_subscriptions.sql
--
-- Extends clock-in/out browser push reminders (015_push_subscriptions.sql) to
-- managers. Managers are login accounts (allowed_users), not employees, so —
-- same reasoning as manager_clock_events vs clock_events, manager_shifts vs
-- rota_shifts — this mirrors the employee push tables but keyed on manager_id.
--
-- Run this in the Supabase SQL Editor.
-- =============================================================

create table if not exists public.manager_push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  manager_id    uuid not null references public.allowed_users(id) on delete cascade,
  endpoint      text not null unique,
  p256dh        text not null,
  auth          text not null,
  user_agent    text,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

create index if not exists manager_push_subscriptions_manager_idx
  on public.manager_push_subscriptions (manager_id);

alter table public.manager_push_subscriptions enable row level security;

drop policy if exists "manager_push_subscriptions_select" on public.manager_push_subscriptions;
drop policy if exists "manager_push_subscriptions_insert" on public.manager_push_subscriptions;
drop policy if exists "manager_push_subscriptions_update" on public.manager_push_subscriptions;
drop policy if exists "manager_push_subscriptions_delete" on public.manager_push_subscriptions;

-- Admin can review; a manager sees/manages only their own row (mirrors
-- manager_clock_events RLS — public.current_allowed_user_id() resolves the
-- caller's allowed_users.id from their JWT email).
create policy "manager_push_subscriptions_select" on public.manager_push_subscriptions
  for select to authenticated
  using (public.is_admin(auth.jwt() ->> 'email') or manager_id = public.current_allowed_user_id());

create policy "manager_push_subscriptions_insert" on public.manager_push_subscriptions
  for insert to authenticated
  with check (manager_id = public.current_allowed_user_id());

create policy "manager_push_subscriptions_update" on public.manager_push_subscriptions
  for update to authenticated
  using (manager_id = public.current_allowed_user_id());

create policy "manager_push_subscriptions_delete" on public.manager_push_subscriptions
  for delete to authenticated
  using (manager_id = public.current_allowed_user_id());

grant all on public.manager_push_subscriptions to authenticated, service_role;

-- ---------- send log (idempotency) ----------
create table if not exists public.manager_push_reminders (
  id             uuid primary key default gen_random_uuid(),
  manager_id     uuid not null references public.allowed_users(id) on delete cascade,
  reminder_date  date not null,
  reminder_type  text not null check (reminder_type in ('clock_in','clock_out')),
  store_id       uuid references public.stores(id) on delete set null,
  sent_at        timestamptz not null default now(),
  unique (manager_id, reminder_date, reminder_type)
);

create index if not exists manager_push_reminders_date_idx
  on public.manager_push_reminders (reminder_date desc);

alter table public.manager_push_reminders enable row level security;

drop policy if exists "manager_push_reminders_select" on public.manager_push_reminders;

create policy "manager_push_reminders_select" on public.manager_push_reminders
  for select to authenticated
  using (public.is_staff());

grant all on public.manager_push_reminders to authenticated, service_role;
