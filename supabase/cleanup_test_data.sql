-- =====================================================================
-- Roki — Targeted cleanup (the safe, surgical version)
--
-- Use this when you only want to:
--   1) delete the test/sample farmer records you created (and their logs),
--   2) unlink + downgrade the accounts that claimed them (so they're no
--      longer FARMER/admin, and the next signup becomes the Admin again),
--
-- It does NOT touch the schema, the other farmers, or the settings.
-- Run it in the Supabase SQL Editor.
--
-- HOW TO USE:
--   Replace 'FARMER_ID_1', 'FARMER_ID_2' with the actual RFV-UG-XXXXX ids
--   of the two sample farmers (e.g. 'RFV-UG-00005', 'RFV-UG-00006').
-- =====================================================================

-- 1) Delete the two sample farmers + their logs (cascade handles logs)
delete from public.farmers where id in ('FARMER_ID_1', 'FARMER_ID_2');

-- 2) Unlink + downgrade any accounts that were linked to them
--    (sets role back to FIELD_AGENT so they're not farmer/admin anymore;
--     the NEXT signup on a fresh database becomes the Admin automatically)
update public.profiles
set role = 'FIELD_AGENT',
    farmer_id = null
where farmer_id in ('FARMER_ID_1', 'FARMER_ID_2');

-- 3) (Optional) If you also want the two accounts GONE entirely, uncomment:
-- delete from auth.users where id in (
--   select id from public.profiles where farmer_id in ('FARMER_ID_1', 'FARMER_ID_2')
-- );

-- =====================================================================
-- After this: the next brand-new signup becomes the Admin (first-account
-- rule), and you can hand over the project cleanly.
-- =====================================================================
