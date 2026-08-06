-- =====================================================================
-- Roki — Migration v14 (two groups only: Admin + Field Agent)
-- Converts any leftover FARMER-role accounts to FIELD_AGENT (the farmer
-- role no longer exists in the app).
-- =====================================================================
update public.profiles
set role = 'FIELD_AGENT'
where role = 'FARMER';
-- =====================================================================
