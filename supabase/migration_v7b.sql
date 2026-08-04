-- =====================================================================
-- Roki — Migration v7b (run after v7)
-- Fixes the agent access-code cloud write:
--   1) allows ADMINS to insert into settings (needed for the upsert
--      that creates the id=1 row when it's missing)
--   2) ensures the settings row exists
-- =====================================================================

drop policy if exists "settings insert as admin" on public.settings;
create policy "settings insert as admin" on public.settings
  for insert with check (public.get_user_role() = 'ADMIN');

-- ensure the settings row exists
insert into public.settings (id, rules, crops, agent_code_hash, updated_at)
values (
  1,
  '{"anomalyDetection":true,"duplicateGuard":true,"incompleteProfile":true,"yieldScoring":true}',
  '{}',
  null,
  now()
)
on conflict (id) do nothing;
-- =====================================================================
