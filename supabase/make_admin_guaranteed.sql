-- =====================================================================
-- GUARANTEED admin promotion — run in Supabase SQL Editor
-- Promotes THE MOST RECENTLY CREATED account to ADMIN (works even if
-- you don't know the exact email, or there are duplicates).
-- =====================================================================

update public.profiles
set role = 'ADMIN'
where id = (
  select id from public.profiles
  order by created_at desc
  limit 1
);

-- show the result:
select email, role, farmer_id, created_at from public.profiles order by created_at desc;
-- =====================================================================
