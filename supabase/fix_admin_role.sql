-- =====================================================================
-- IMMEDIATE FIX: make your account an ADMIN (run in Supabase SQL Editor)
-- Replace 'YOUR_EMAIL@example.com' with the admin account's email.
-- =====================================================================
update public.profiles
set role = 'ADMIN'
where email = 'YOUR_EMAIL@example.com';

-- verify it took:
select email, role, farmer_id from public.profiles order by created_at;
-- =====================================================================
