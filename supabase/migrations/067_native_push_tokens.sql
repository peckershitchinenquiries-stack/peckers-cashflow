-- =============================================================
-- Migration 067 — native FCM push tokens alongside Web Push (Update 251)
--
-- The Android app (pms-mobile) loads this site in a WebView, and an Android
-- System WebView implements no Push API: there is no PushManager to subscribe
-- with, so public/sw.js and the whole Web Push path cannot deliver a reminder
-- inside the app. Native push through Firebase Cloud Messaging is the only
-- route, and it identifies a device by an FCM registration token rather than
-- by an endpoint URL and a pair of encryption keys.
--
-- Rather than a third and fourth table, the two existing subscription tables
-- gain a `platform` discriminator and a `native_token`. One row per device
-- either way, so "which devices does this person have?" stays one query and
-- Task 6's sender can fan out over a single result set.
--
-- NUMBERING: the plan called this 062, but 062–066 are already applied
-- (062_cover_driver_visiting_store … 066_occupancy_standing_costs). 067 is the
-- next free number.
--
-- DEPLOY ORDER: run this FIRST, then deploy the code. It is purely additive —
-- the currently deployed code selects `id, endpoint, p256dh, auth` and writes
-- `endpoint/p256dh/auth`, so it neither sees nor needs these columns and is
-- unaffected by running this early. Deploying the code first would instead have
-- the new server actions write `platform` and `native_token` into a table that
-- has neither, and every native registration would fail.
--
-- NOT COVERED, deliberately: cover drivers have no push tables at all (see
-- CLAUDE.md "Known gaps" #4), so a cover driver on the app gets no reminders —
-- exactly as they get none in a browser today. Nothing here changes that, and
-- Task 6 must not assume otherwise.
--
-- Idempotent and safe to re-run. Run this in the Supabase SQL Editor.
-- =============================================================

-- ---------- employees ----------

alter table public.push_subscriptions
  add column if not exists platform text not null default 'web';

alter table public.push_subscriptions
  add column if not exists native_token text;

-- ---------- managers ----------

alter table public.manager_push_subscriptions
  add column if not exists platform text not null default 'web';

alter table public.manager_push_subscriptions
  add column if not exists native_token text;

-- ---------- the web columns stop being mandatory ----------
-- A native row has no endpoint and no encryption keys; those three belong to
-- the W3C Push subscription a browser hands over. Dropping NOT NULL is
-- invisible to the deployed code, which always supplies all three.
-- `endpoint`'s UNIQUE from migrations 015/018 is untouched and keeps working:
-- Postgres treats NULLs as distinct in a unique index, so any number of native
-- rows coexist, and the existing upsert on `endpoint` is unaffected.

alter table public.push_subscriptions alter column endpoint drop not null;
alter table public.push_subscriptions alter column p256dh   drop not null;
alter table public.push_subscriptions alter column auth     drop not null;

alter table public.manager_push_subscriptions alter column endpoint drop not null;
alter table public.manager_push_subscriptions alter column p256dh   drop not null;
alter table public.manager_push_subscriptions alter column auth     drop not null;

-- ---------- one row per native device ----------
-- A PLAIN unique index, not a partial one: PostgREST's `onConflict` names
-- columns, and Postgres will not accept a partial index as an ON CONFLICT
-- target unless the statement repeats its predicate — which `onConflict` cannot
-- express. Same reasoning as migration 060, and the trap migration 027 nearly
-- shipped (CLAUDE.md, "Deploy ordering matters").
-- Nullable is fine here: NULLs do not conflict, so every web row is distinct.

create unique index if not exists push_subscriptions_native_token_key
  on public.push_subscriptions (native_token);

create unique index if not exists manager_push_subscriptions_native_token_key
  on public.manager_push_subscriptions (native_token);

-- ---------- a row is either a web subscription or a native one ----------
-- Without this, a half-written row (no endpoint, no token) would be invisible
-- to both senders and look like a device that simply never receives anything.
-- Every existing row satisfies the web branch, because all three columns were
-- NOT NULL until a moment ago.

do $$
declare
  t text;
begin
  for t in select unnest(array['push_subscriptions', 'manager_push_subscriptions'])
  loop
    if not exists (
      select 1
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
      where ns.nspname = 'public'
        and rel.relname = t
        and con.conname = t || '_web_or_native'
    ) then
      execute format(
        'alter table public.%I add constraint %I check (
           (platform = ''web''  and endpoint is not null
                               and p256dh is not null
                               and auth is not null)
           or
           (platform <> ''web'' and native_token is not null)
         )',
        t,
        t || '_web_or_native'
      );
    end if;
  end loop;
end $$;

-- ---------- platform is a closed set ----------
-- 'ios' is listed now although nothing sends to it: the app is Android-only,
-- but an iOS build would use the same column, and a CHECK that has to be
-- widened later is a migration nobody remembers is needed.

do $$
declare
  t text;
begin
  for t in select unnest(array['push_subscriptions', 'manager_push_subscriptions'])
  loop
    if not exists (
      select 1
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
      where ns.nspname = 'public'
        and rel.relname = t
        and con.conname = t || '_platform_check'
    ) then
      execute format(
        'alter table public.%I add constraint %I check (platform in (''web'', ''android'', ''ios''))',
        t,
        t || '_platform_check'
      );
    end if;
  end loop;
end $$;

-- ---------- lookup by platform ----------
-- Task 6's sender splits a person's devices into web and native before it can
-- choose a transport, so platform is on the read path, not just descriptive.

create index if not exists push_subscriptions_platform_idx
  on public.push_subscriptions (employee_id, platform);

create index if not exists manager_push_subscriptions_platform_idx
  on public.manager_push_subscriptions (manager_id, platform);
