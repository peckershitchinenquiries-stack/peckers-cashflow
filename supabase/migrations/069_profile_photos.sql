-- =============================================================
-- Migration 069 — profile photos for every login (Update 268)
--
-- Admins, managers, employees and cover drivers can add an OPTIONAL profile
-- photo from the Peckers app. One column on allowed_users covers all four
-- roles, because that is the one row every login has.
--
-- The image itself lives in a PUBLIC storage bucket, `avatars`. Public read
-- keeps the header avatar a plain <img> with no signed-URL round-trip on every
-- page. Writes never come from the browser: the server action uploads with the
-- service-role client after checking the session, so the bucket needs no
-- storage policies at all. Paths are `<allowed_user_id>/<timestamp>-<random>.jpg`
-- — a new name per upload, so a changed photo is never served from cache.
--
-- DEPLOY ORDER: run this FIRST, then deploy the code. Purely additive — the
-- currently deployed code selects `*` from allowed_users and ignores a column
-- it doesn't know. Deploying the code first would make every photo upload fail
-- on the missing bucket and column.
--
-- Idempotent and safe to re-run. Run this in the Supabase SQL Editor.
-- =============================================================

alter table public.allowed_users
  add column if not exists avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
