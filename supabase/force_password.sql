-- =====================================================================
-- FORCE a known password for an account (instant, no email flow)
-- Replace 'admin@example.com' with the account email, and
-- 'NewPassword123!' with the password you want.
-- Run in Supabase SQL Editor. Then sign in with that password.
-- =====================================================================
select id from auth.users where email = 'admin@example.com';
-- if the above returns a row, copy its id into the next query:
update auth.users
set encrypted_password = crypt('NewPassword123!', gen_salt('bf'))
where email = 'admin@example.com';
-- =====================================================================
