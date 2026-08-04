-- =====================================================================
-- Roki — Migration v11 (run after v10 / after the video emergency fix)
-- Lets access-code field agents (anonymous) INSERT farmer records when
-- they register a farmer in the field. The farmer later claims the
-- record at signup via phone/email. Reads stay role-scoped.
-- =====================================================================

drop policy if exists "farmers insert anon" on public.farmers;
create policy "farmers insert anon" on public.farmers
  for insert with check (auth.role() = 'anon');
-- =====================================================================
