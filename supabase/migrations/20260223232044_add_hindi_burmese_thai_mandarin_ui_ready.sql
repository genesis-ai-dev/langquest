-- Add Hindi, Burmese, Thai, and Mandarin languoids to dev branch
-- These languoids already exist in production with specific IDs
-- Production IDs:
--   Hindi: 3502e2a1-3cfd-45f7-8167-a9a67d42c76a
--   Burmese: fa8369a5-03a6-4d1e-ba44-152409a2f97c
--   Thai: fe361436-f7ff-4955-a442-59b76623b3c9
--   Mandarin: 0d75d06f-2692-4127-b810-67dd64fa6eee
-- 
-- In local dev, the languoids are created by seeds (which run AFTER migrations),
-- so we use conditional statements that only execute if the languoids exist.

-- ============================================================================
-- Hindi (हिन्दी)
-- ISO 639-3: hin
-- ============================================================================

-- Add Hindi endonymic aliases (हिन्दी, हिंदी) - only if the languoid exists
INSERT INTO public.languoid_alias (
    subject_languoid_id,
    label_languoid_id,
    name,
    alias_type,
    source_names
)
SELECT
    '3502e2a1-3cfd-45f7-8167-a9a67d42c76a',
    '3502e2a1-3cfd-45f7-8167-a9a67d42c76a',
    'हिन्दी',
    'endonym'::public.alias_type,
    ARRAY['lexvo']
WHERE EXISTS (
    SELECT 1 FROM public.languoid WHERE id = '3502e2a1-3cfd-45f7-8167-a9a67d42c76a'
)
ON CONFLICT (subject_languoid_id, label_languoid_id, alias_type, name) DO NOTHING;

INSERT INTO public.languoid_alias (
    subject_languoid_id,
    label_languoid_id,
    name,
    alias_type,
    source_names
)
SELECT
    '3502e2a1-3cfd-45f7-8167-a9a67d42c76a',
    '3502e2a1-3cfd-45f7-8167-a9a67d42c76a',
    'हिंदी',
    'endonym'::public.alias_type,
    ARRAY['lexvo']
WHERE EXISTS (
    SELECT 1 FROM public.languoid WHERE id = '3502e2a1-3cfd-45f7-8167-a9a67d42c76a'
)
ON CONFLICT (subject_languoid_id, label_languoid_id, alias_type, name) DO NOTHING;

-- ============================================================================
-- Burmese (မြန်မာ)
-- ISO 639-3: mya
-- ============================================================================

-- Add Burmese endonymic alias (မြန်မာ) - only if the languoid exists
INSERT INTO public.languoid_alias (
    subject_languoid_id,
    label_languoid_id,
    name,
    alias_type,
    source_names
)
SELECT
    'fa8369a5-03a6-4d1e-ba44-152409a2f97c',
    'fa8369a5-03a6-4d1e-ba44-152409a2f97c',
    'မြန်မာ',
    'endonym'::public.alias_type,
    ARRAY['lexvo']
WHERE EXISTS (
    SELECT 1 FROM public.languoid WHERE id = 'fa8369a5-03a6-4d1e-ba44-152409a2f97c'
)
ON CONFLICT (subject_languoid_id, label_languoid_id, alias_type, name) DO NOTHING;

-- ============================================================================
-- Thai (ไทย)
-- ISO 639-3: tha
-- ============================================================================

-- Add Thai endonymic alias (ไทย) - only if the languoid exists
INSERT INTO public.languoid_alias (
    subject_languoid_id,
    label_languoid_id,
    name,
    alias_type,
    source_names
)
SELECT
    'fe361436-f7ff-4955-a442-59b76623b3c9',
    'fe361436-f7ff-4955-a442-59b76623b3c9',
    'ไทย',
    'endonym'::public.alias_type,
    ARRAY['lexvo']
WHERE EXISTS (
    SELECT 1 FROM public.languoid WHERE id = 'fe361436-f7ff-4955-a442-59b76623b3c9'
)
ON CONFLICT (subject_languoid_id, label_languoid_id, alias_type, name) DO NOTHING;

-- ============================================================================
-- Mandarin (普通话)
-- ISO 639-3: cmn
-- ============================================================================

-- Update name from "Mandarin Chinese" to "Mandarin" to match migration expectations
UPDATE public.languoid
SET name = 'Mandarin', last_updated = NOW()
WHERE id = '0d75d06f-2692-4127-b810-67dd64fa6eee'
  AND name = 'Mandarin Chinese';

-- Add Mandarin endonymic aliases (普通话, 中文) - only if the languoid exists
INSERT INTO public.languoid_alias (
    subject_languoid_id,
    label_languoid_id,
    name,
    alias_type,
    source_names
)
SELECT
    '0d75d06f-2692-4127-b810-67dd64fa6eee',
    '0d75d06f-2692-4127-b810-67dd64fa6eee',
    '普通话',
    'endonym'::public.alias_type,
    ARRAY['lexvo']
WHERE EXISTS (
    SELECT 1 FROM public.languoid WHERE id = '0d75d06f-2692-4127-b810-67dd64fa6eee'
)
ON CONFLICT (subject_languoid_id, label_languoid_id, alias_type, name) DO NOTHING;

INSERT INTO public.languoid_alias (
    subject_languoid_id,
    label_languoid_id,
    name,
    alias_type,
    source_names
)
SELECT
    '0d75d06f-2692-4127-b810-67dd64fa6eee',
    '0d75d06f-2692-4127-b810-67dd64fa6eee',
    '中文',
    'endonym'::public.alias_type,
    ARRAY['lexvo']
WHERE EXISTS (
    SELECT 1 FROM public.languoid WHERE id = '0d75d06f-2692-4127-b810-67dd64fa6eee'
)
ON CONFLICT (subject_languoid_id, label_languoid_id, alias_type, name) DO NOTHING;

-- ============================================================================
-- Add name column to region_alias
-- This was missing from the original table definition.
-- languoid_alias has a name column; region_alias should too.
-- ============================================================================

ALTER TABLE public.region_alias
  ADD COLUMN IF NOT EXISTS name text;

-- Update unique constraint to include name, allowing multiple named aliases
-- per region per language (e.g., "Myanmar" and "Burma" both in English)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.region_alias'::regclass
      AND conname = 'uq_region_alias'
  ) THEN
    EXECUTE 'ALTER TABLE public.region_alias DROP CONSTRAINT uq_region_alias';
  END IF;
  EXECUTE 'ALTER TABLE public.region_alias
           ADD CONSTRAINT uq_region_alias UNIQUE (subject_region_id, label_languoid_id, name)';
END$$;

CREATE INDEX IF NOT EXISTS idx_region_alias_name ON public.region_alias(name);

-- ============================================================================
-- Add "Burma" as a region alias for the Myanmar region
-- Myanmar already exists as a region; Burma is a common English alternative.
-- English languoid ID: bd6027e5-b122-43b9-ba0a-4f5d5a25f1dd
-- ============================================================================

INSERT INTO public.region_alias (
    id,
    subject_region_id,
    label_languoid_id,
    name
)
SELECT
    gen_random_uuid()::text,
    r.id,
    'bd6027e5-b122-43b9-ba0a-4f5d5a25f1dd',
    'Burma'
FROM public.region r
WHERE r.name = 'Myanmar'
ON CONFLICT (subject_region_id, label_languoid_id, name) DO NOTHING;
