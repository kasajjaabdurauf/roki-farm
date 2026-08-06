-- =====================================================================
-- RECOVER agent names for already-registered farmers (non-breaking)
-- The survey stored the agent's name in the "Your name (agent)" field,
-- which is saved on the farmer's survey JSON under enumeratorName
-- (Section 1.1). This copies it into logged_by where missing.
-- =====================================================================
update public.farmers f
set logged_by = (f.survey->>'enumeratorName')
where f.logged_by is null
  and f.survey is not null
  and coalesce(f.survey->>'enumeratorName', '') <> '';

-- show what got recovered:
select id, full_name, logged_by from public.farmers
where logged_by is not null
order by created_at desc
limit 20;
-- =====================================================================
