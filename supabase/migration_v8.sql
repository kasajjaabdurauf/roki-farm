-- =====================================================================
-- Roki — Migration v8 (run after v7d)
-- Lets access-code field agents (anonymous, no login) INSERT harvest
-- logs. Read was already allowed; writes now match the product vision
-- that agents log harvests in the field.
-- Farmers still cannot insert logs for others (their own insert policy
-- requires the linked farmer_id match).
-- =====================================================================

drop policy if exists "logs insert anon" on public.produce_logs;
create policy "logs insert anon" on public.produce_logs
  for insert with check (auth.role() = 'anon');
-- =====================================================================
