-- Add metadata field to quest table for extensible structured data
-- Used for Bible book/chapter identification and other quest-specific metadata
-- Replaces the need to use tags for structural identification

-- Add metadata column to quest table
-- NOTE: Using TEXT (not JSONB) to match Drizzle's text({ mode: 'json' }) behavior
-- This prevents double-encoding issues when PowerSync syncs between SQLite and Postgres
ALTER TABLE "public"."quest" 
  ADD COLUMN IF NOT EXISTS "metadata" text NULL;

-- Add comment to document the field
COMMENT ON COLUMN "public"."quest"."metadata" IS 'Extensible metadata for quests (stored as JSON text). Structure depends on quest type. Example: {"bible": {"book": "gen", "chapter": 1}} for Bible chapters.';

-- Create GIN index for efficient JSON querying even though it's stored as text
-- Postgres can still index and query JSON stored in text columns
CREATE INDEX IF NOT EXISTS "quest_metadata_idx" ON "public"."quest" USING GIN ((metadata::jsonb));

