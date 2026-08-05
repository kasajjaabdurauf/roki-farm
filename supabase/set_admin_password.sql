-- =====================================================================
-- Set the admin password to EXACTLY: 123456789
-- (run in Supabase SQL Editor — replaces any previous password)
-- =====================================================================
update auth.users
set encrypted_password = crypt('123456789', gen_salt('bf'))
where email = 'zinduro@gmail.com';

-- verify:
select email, created_at from auth.users where email = 'zinduro@gmail.com';
-- =====================================================================
