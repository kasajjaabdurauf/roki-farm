-- =====================================================================
-- Roki — Migration v7d (run after v7c)
-- Lets access-code field agents (who have NO login) READ the farmer
-- database, so they can see who is registered and help onboard.
-- READ-ONLY: anonymous users can select farmers + produce_logs, but
-- can NEVER insert/update/delete (writes still require a signed-in
-- account with FIELD_AGENT/ADMIN role).
-- =====================================================================

drop policy if exists "farmers select anon" on public.farmers;
create policy "farmers select anon" on public.farmers
  for select using (auth.role() = 'anon');

drop policy if exists "logs select anon" on public.produce_logs;
create policy "logs select anon" on public.produce_logs
  for select using (auth.role() = 'anon');
-- =====================================================================
