-- =============================================================
-- 006_restore_public_grants.sql
--
-- FIX: every PostgREST query was failing with
--   42501 "permission denied for table <name>"
-- for the anon, authenticated AND service_role roles — i.e. the standard
-- Supabase table privileges on schema public had been wiped (by an ad-hoc
-- REVOKE / RLS-hardening attempt / a restore that didn't carry role grants).
--
-- Symptom in the app: login succeeds at the auth layer, but the middleware's
-- `allowed_users` lookup throws, so the user is treated as un-whitelisted and
-- sent to /access-denied.
--
-- This re-applies Supabase's DEFAULT privilege model. Row access stays fully
-- governed by RLS (already enabled on the sensitive tables), so granting to
-- anon/authenticated is safe — it just lets PostgREST reach the tables before
-- RLS decides which rows are visible.
--
-- Run this in the Supabase SQL Editor (it executes as the table owner, which
-- the service-role API key cannot do).
-- =============================================================

-- Schema usage
grant usage on schema public to anon, authenticated, service_role;

-- Existing objects
grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;

-- Future objects created by the owner (postgres) in this schema
alter default privileges in schema public
  grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;
