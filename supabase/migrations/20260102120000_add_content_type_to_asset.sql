-- Add content_type column to asset table
-- This distinguishes between source assets, translations, and transcriptions

-- Add the column with default 'source' (safe for existing data)
ALTER TABLE public.asset
ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'source';

-- Add check constraint to ensure valid values (drop first if exists for idempotency)
ALTER TABLE public.asset DROP CONSTRAINT IF EXISTS asset_content_type_check;
ALTER TABLE public.asset
ADD CONSTRAINT asset_content_type_check
CHECK (content_type IN ('source', 'translation', 'transcription'));

-- Backfill: existing assets with source_asset_id are translations
UPDATE public.asset
SET content_type = 'translation'
WHERE source_asset_id IS NOT NULL
  AND content_type = 'source';

-- Add index for filtering by content_type
CREATE INDEX IF NOT EXISTS asset_content_type_idx ON public.asset(content_type);
