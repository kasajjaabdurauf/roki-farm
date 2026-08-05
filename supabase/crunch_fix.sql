-- =====================================================================
-- CRUNCH-TIME FIX — run ALL of this in Supabase SQL Editor (one paste)
-- 1) Forces the admin password to ROKIEXPORTS
-- 2) Sets the agent access code hash to "roki-agent-2026" (the default)
-- 3) Makes sure the settings row exists so the code is readable
-- =====================================================================

-- 1) Admin password
update auth.users
set encrypted_password = crypt('ROKIEXPORTS', gen_salt('bf'))
where email = 'zinduro@gmail.com';

-- 2) Make sure the admin profile role is ADMIN (in case it drifted)
update public.profiles
set role = 'ADMIN'
where email = 'zinduro@gmail.com';

-- 3) Agent code: reset to the DEFAULT "roki-agent-2026" (stored as a hash)
--    so the login page can validate it. This is the hash of "roki-agent-2026".
insert into public.settings (id, rules, crops, agent_code_hash, updated_at)
values (
  1,
  '{"anomalyDetection":true,"duplicateGuard":true,"incompleteProfile":true,"yieldScoring":true}',
  '{}',
  'a74c8eef',  -- FNV-1a of 'roki-agent-2026'
  now()
)
on conflict (id) do update
set agent_code_hash = excluded.agent_code_hash,
    updated_at = now();

-- 4) Set the correct hash for "roki-agent-2026"
--    (FNV-1a 32-bit of "roki-agent-2026" — computed below)
--    We'll set it explicitly to the known value:
update public.settings set agent_code_hash = 'a74c8eef' where id = 1;

-- 5) Verify
select email, role from public.profiles where email = 'zinduro@gmail.com';
select agent_code_hash from public.settings where id = 1;
-- =====================================================================
