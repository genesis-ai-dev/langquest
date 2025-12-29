-- ============================================================================
-- Migration: Add PowerSync Publication for languoid_link_suggestion
-- ============================================================================
-- 
-- PURPOSE:
-- Adds the languoid_link_suggestion table to the PowerSync publication so it
-- can be synced to client devices. This table is referenced in sync-rules.yml
-- but was missing the publication statement.
--
-- AFFECTED TABLES:
-- - languoid_link_suggestion: Adds to PowerSync publication
--
-- SPECIAL CONSIDERATIONS:
-- - Uses idempotent check to avoid errors if already added
-- - Follows the pattern established in other migrations
--
-- ============================================================================

-- Add languoid_link_suggestion to PowerSync publication
-- This table is synced via the user_profile bucket based on profile_id
-- (as defined in sync-rules.yml)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'powersync' AND tablename = 'languoid_link_suggestion'
  ) THEN
    ALTER PUBLICATION "powersync" ADD TABLE ONLY "public"."languoid_link_suggestion";
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Publication might not exist yet, ignore
  NULL;
END $$;

