-- =====================================================================
-- Roki — Migration v13 (run after v12)
-- Adds the logged_by column to farmers (the agent who registered the
-- farmer, for performance-based pay). The app sends it; without this
-- column the insert was rejected ("column does not exist") and nothing
-- synced.
-- =====================================================================

alter table public.farmers
  add column if not exists logged_by text;

-- =====================================================================
