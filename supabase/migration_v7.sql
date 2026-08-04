-- =====================================================================
-- Roki — Migration v7  (agent access code lives in the cloud)
-- Adds agent_code_hash to settings so the shared field-agent code is
-- the same on EVERY device (admin changes it once in Settings).
-- Apply AFTER migration_v6.
-- =====================================================================

alter table public.settings
  add column if not exists agent_code_hash text;

-- admins may update settings (already covered by "settings update" policy),
-- but ensure the column is readable by authenticated users (covered by
-- "settings select"). Nothing else needed.
-- =====================================================================
