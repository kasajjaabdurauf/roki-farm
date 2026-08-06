-- ============================================================================
-- ROKI · migration_v15.sql — Agent name recovery + attribution fixes
-- ============================================================================
-- WHAT THIS DOES
--   1. SHOWS how many farmers have an agent credited (logged_by) and how
--      many have a name hidden inside the old survey JSON (enumeratorName).
--   2. COPIES the survey's enumerator name into logged_by for every farmer
--      that has a name there but no credited agent yet.
--   3. SHOWS the result so you can confirm.
--
-- WHY: before this version the app captured the agent's name but a bug meant
--      it never landed on the farmer record (logged_by stayed empty), so the
--      Agent performance page showed "no agent" for everyone. This recovers
--      the names that WERE saved inside the survey. Farmers whose survey has
--      no name either (registered before the field existed) stay blank and
--      can be edited manually from the farmer page.
--
-- SAFE: only fills rows where logged_by is empty. Never overwrites, never
--       deletes anything. Run it as many times as you like.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 1 · Look before you leap — run this FIRST and read the numbers
-- ----------------------------------------------------------------------------
select
  count(*)                                                          as total_farmers,
  count(*) filter (where logged_by is not null and trim(logged_by) <> '')
                                                                     as with_agent,
  count(*) filter (where logged_by is null or trim(logged_by) = '')  as without_agent,
  count(*) filter (
    where (logged_by is null or trim(logged_by) = '')
      and survey is not null
      and trim(coalesce(survey->>'enumeratorName', '')) <> ''
  )                                                                 as recoverable_from_survey
from public.farmers;

-- ----------------------------------------------------------------------------
-- STEP 2 · The recovery UPDATE (fills empty logged_by from the survey)
-- ----------------------------------------------------------------------------
update public.farmers f
set logged_by = trim(coalesce(
    nullif(f.survey->>'enumeratorName', ''),
    nullif(f.survey->>'agentName', ''),
    nullif(f.survey->>'enumerator', ''),
    nullif(f.survey->>'agent_name', ''),
    ''
  )),
  updated_at = f.updated_at          -- keep the original registration time
where (f.logged_by is null or trim(f.logged_by) = '')
  and f.survey is not null
  and trim(coalesce(
        nullif(f.survey->>'enumeratorName', ''),
        nullif(f.survey->>'agentName', ''),
        nullif(f.survey->>'enumerator', ''),
        nullif(f.survey->>'agent_name', ''),
        ''
      )) <> '';

-- ----------------------------------------------------------------------------
-- STEP 3 · Show the recovered agents — run after STEP 2
-- ----------------------------------------------------------------------------
select logged_by, count(*) as farmers
from public.farmers
where logged_by is not null and trim(logged_by) <> ''
group by logged_by
order by farmers desc, logged_by;

-- ----------------------------------------------------------------------------
-- STEP 4 · Farmers still without an agent (these have no recoverable name —
--          register them manually if you know who did it)
-- ----------------------------------------------------------------------------
select id, full_name, phone, district, created_at
from public.farmers
where logged_by is null or trim(logged_by) = ''
order by created_at desc
limit 50;
