-- =====================================================================
-- Roki — FULL FACTORY RESET (use with extreme care!)
--
-- Deletes EVERYTHING: all farmers, logs, settings and ALL user
-- accounts (auth.users + profiles), then resets the ID sequence so
-- the app starts fresh like day one.
--
-- HOW TO RUN:
--   1. Supabase → SQL Editor → paste → Run.
--   2. You will be signed out everywhere. The next person to sign up
--      automatically becomes the Admin again (first-account rule).
--
-- ⚠️ This is permanent. The nightly backup email is your only recovery.
-- =====================================================================

-- delete all farmers and logs (cascades cleanly)
truncate table public.produce_logs;
truncate table public.farmers;

-- reset settings to defaults
update public.settings
set rules = '{"anomalyDetection":true,"duplicateGuard":true,"incompleteProfile":true,"yieldScoring":true}',
    crops = '{}',
    updated_at = now()
where id = 1;

-- delete ALL user accounts (this cascades to profiles)
delete from auth.users;

-- reset the farmer-id sequence so IDs restart at RFV-UG-00001
alter sequence public.farmers_id_seq restart with 1;

-- =====================================================================
-- DONE. Fresh start.
-- =====================================================================
