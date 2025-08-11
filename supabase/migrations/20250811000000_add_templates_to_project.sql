-- Migration: Add templates column to project for lazy materialization
-- Date: 2025-08-11

-- Up
ALTER TABLE public.project
ADD COLUMN IF NOT EXISTS templates jsonb;

COMMENT ON COLUMN public.project.templates IS 'Optional list of template identifiers (e.g., ["every-language-bible"]) enabling lazy materialization of quests/assets.';

-- Note: No default set to allow null vs. empty list semantics.

-- Down (manual rollback)
-- ALTER TABLE public.project DROP COLUMN IF EXISTS templates;


