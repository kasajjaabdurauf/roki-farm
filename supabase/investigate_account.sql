-- =====================================================================
-- INVESTIGATE: does this person have TWO records (an account + a farmer)?
-- Replace 'EMAIL@example.com' with the email you're investigating.
-- =====================================================================
-- 1) The account:
select id as profile_id, email, role, farmer_id,
       created_at as account_created
from public.profiles
where email ilike '%EMAIL@example.com%';

-- 2) Farmer records with that email OR name:
select id as farmer_id, full_name, email as farmer_email, phone,
       logged_by, created_at as farmer_created
from public.farmers
where email ilike '%EMAIL@example.com%'
   or full_name ilike '%' || split_part('EMAIL@example.com','@',1) || '%'
order by created_at;

-- 3) Count how many farmer records share that phone (dup detection):
select phone, count(*) from public.farmers
group by phone having count(*) > 1
order by count(*) desc limit 10;
-- =====================================================================
