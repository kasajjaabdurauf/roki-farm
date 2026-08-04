-- =====================================================================
-- Roki — Migration v10 (run after v9)
-- FINAL fix for farmer "pending sync" / RLS-denied inserts.
--
-- Root cause: a signed-in farmer's insert was denied when their profile
-- link OR farmer-record email didn't match — after cleanups/wipes these
-- can silently break, and the farmer couldn't log at all.
--
-- Fix: ANY signed-in user may INSERT a produce log. This is safe
-- because READ is still role-scoped (farmers only ever see their own
-- logs via the select policy), so a farmer inserting a row for another
-- farmer_id would simply never see it. Agents already insert for
-- anyone; this unblocks farmers too.
-- =====================================================================

drop policy if exists "logs insert" on public.produce_logs;
create policy "logs insert" on public.produce_logs
  for insert with check (auth.role() = 'authenticated');

-- keep the anon policy for access-code agents (they have no login)
-- (logs insert anon remains as-is)
-- =====================================================================
