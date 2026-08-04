-- =====================================================================
-- Roki — FULL FACTORY RESET (safe version — won't error if tables are
-- missing, so it works even on a partially-initialized project)
--
-- Deletes EVERYTHING that exists: farmers, logs, settings, ALL user
-- accounts (auth.users + profiles), and resets the ID sequence.
--
-- HOW TO RUN:
--   1. Supabase → SQL Editor → paste → Run.
--   2. You will be signed out everywhere. The next person to sign up
--      automatically becomes the Admin again (first-account rule).
--
-- ⚠️ This is permanent. The nightly backup email is your only recovery.
-- =====================================================================

-- delete all farmers and logs IF they exist (CASCADE handles FKs)
do $$
begin
  if to_regclass('public.farmers') is not null then
    truncate table public.farmers cascade;
  end if;
end $$;

-- reset settings to defaults IF the table exists
do $$
begin
  if to_regclass('public.settings') is not null then
    update public.settings
    set rules = '{"anomalyDetection":true,"duplicateGuard":true,"incompleteProfile":true,"yieldScoring":true}',
        crops = '{}',
        agent_code_hash = null,
        updated_at = now()
    where id = 1;
  end if;
end $$;

-- delete ALL user accounts (this cascades to profiles)
delete from auth.users;

-- reset the farmer-id sequence IF it exists so IDs restart at RFV-UG-00001
do $$
begin
  if to_regclass('public.farmers_id_seq') is not null then
    alter sequence public.farmers_id_seq restart with 1;
  end if;
end $$;

-- =====================================================================
-- AFTER THIS: re-apply schema.sql + migration_v2..v7d so the tables and
-- policies exist again, then sign up fresh (first account = Admin).
-- =====================================================================
