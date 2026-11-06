-- =============================================================
-- 072 — stop keeping generated passwords in allowed_users (Update 273)
--
-- Security: allowed_users.temp_password held each new or reset account's live
-- password in plaintext, and the allowed_users SELECT policy lets every
-- MANAGER read every row (is_staff()). A manager could read another manager's
-- or any not-yet-changed account's password and sign in as them.
--
-- Nothing ever read the column: create/reset actions already return the
-- password once for display. From Update 273 the app no longer writes it; this
-- clears what is already stored. must_change_password is untouched, so anyone
-- still on their first password is still forced to change it.
--
-- DEPLOY ORDER: run AFTER the Update 273 code is live (the old build still
-- writes the column on create/reset). Running early is harmless but leaves
-- any account created in between with a stored copy until this is re-run.
--
-- Do NOT re-enable the one-time backfill in schema.sql that sets
-- must_change_password = false where temp_password is null — after this
-- migration that would clear the forced change for every account.
--
-- The column itself is kept (dropping it would break the old build's inserts);
-- drop it in a later migration once Update 273 is deployed. Idempotent.
-- =============================================================

update public.allowed_users
   set temp_password = null
 where temp_password is not null;
