-- =====================================================================
-- SURGICAL: remove ONE person's farmer record WITHOUT touching their
-- admin access. Run in Supabase SQL Editor.
-- Replace 'THEIR_EMAIL@example.com' with the person's account email.
-- =====================================================================

-- STEP 1 · See what's there (run this first, paste me the result)
select
  p.id as profile_id,
  p.email,
  p.role,
  p.farmer_id as profile_linked_farmer,
  f.id as farmer_record_id,
  f.full_name as farmer_name,
  (select count(*) from public.produce_logs l where l.farmer_id = f.id) as farmer_logs
from public.profiles p
left join public.farmers f on f.id = p.farmer_id or f.email = p.email
where p.email = 'THEIR_EMAIL@example.com';

-- STEP 2 · After you confirm it's safe (run these next):
--   2a) Unlink the account from the farmer record (keep admin intact)
update public.profiles
set farmer_id = null
where email = 'THEIR_EMAIL@example.com';

--   2b) Delete the farmer record + its logs (only if the logs aren't needed)
delete from public.farmers
where email = 'THEIR_EMAIL@example.com'
  and id not in (select farmer_id from public.profiles where email = 'THEIR_EMAIL@example.com');
-- =====================================================================
