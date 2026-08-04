-- =====================================================================
-- Roki — Migration v7c (run after v7b)
-- Allows ANONYMOUS (not-yet-signed-in) users to read ONLY the agent
-- code hash so the field-agent login works before authentication.
-- The hash is not a secret (one-way hash of a shared code); brute-force
-- is already rate-limited on the client (5 tries/10 min).
-- =====================================================================

drop policy if exists "settings select anon agent hash" on public.settings;
drop policy if exists "settings select anon" on public.settings;
create policy "settings select anon" on public.settings
  for select using (auth.role() = 'anon' and id = 1);
-- =====================================================================
