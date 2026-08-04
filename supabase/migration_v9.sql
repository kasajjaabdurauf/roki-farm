-- =====================================================================
-- Roki — Migration v9 (run after v8)
-- Makes a signed-in farmer's own harvest-log insert robust:
--   allowed if the row's farmer_id matches
--     (a) their profile link, OR
--     (b) a farmer record whose email equals their auth email
-- This covers farmers whose profiles.farmer_id got unlinked/cleaned
-- but whose farmer record still carries their email.
-- =====================================================================

drop policy if exists "logs insert" on public.produce_logs;
create policy "logs insert" on public.produce_logs
  for insert with check (
    public.get_user_role() in ('ADMIN', 'FIELD_AGENT')
    or farmer_id = (select farmer_id from public.profiles where id = auth.uid())
    or farmer_id in (
      select id from public.farmers
      where lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );
-- =====================================================================
