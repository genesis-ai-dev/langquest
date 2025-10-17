-- Add metadata field to quest table for extensible structured data
-- Used for Bible book/chapter identification and other quest-specific metadata
-- Replaces the need to use tags for structural identification

-- Add metadata column to quest table
ALTER TABLE "public"."quest" 
  ADD COLUMN IF NOT EXISTS "metadata" jsonb NULL;

-- Add comment to document the field
COMMENT ON COLUMN "public"."quest"."metadata" IS 'Extensible metadata for quests. Structure depends on quest type. Example: {"bible": {"book": "gen", "chapter": 1}} for Bible chapters.';

-- Create index on metadata for efficient querying of Bible structure
-- This allows fast queries like: WHERE metadata->>'bible'->>'book' = 'gen'
CREATE INDEX IF NOT EXISTS "quest_metadata_idx" ON "public"."quest" USING GIN ("metadata");

