-- ============================================================================
-- Migration: Add languoid references and creator_id fields
-- ============================================================================
-- 
-- PURPOSE:
-- 0. Migrate old field values to new link tables (must happen first):
--    - project.target_language_id → project_language_link (language_type='target')
--    - asset.source_language_id → asset_content_link.source_language_id (all entries per asset)
-- 1. Add creator_id field to all languoid and region tables
-- 2. Add languoid reference fields:
--    - profile.ui_languoid_id (parallel to ui_language_id)
--    - asset_content_link.languoid_id (parallel to source_language_id)
--    - project_language_link.languoid_id (parallel to language_id)
-- 3. Find matching languoid records (by name, alias, and/or iso639-3 code) and fill in new fields
-- 4. Increment schema version from 1.0 to 1.1
--
-- ============================================================================

-- ============================================================================
-- STEP 0: Migrate old field values to new link tables
-- ============================================================================
-- This must happen BEFORE adding new columns, as the languoid matching logic
-- depends on having complete data in the link tables.

-- Migrate project.target_language_id to project_language_link (language_type='target')
INSERT INTO public.project_language_link (
    project_id,
    language_id,
    language_type,
    download_profiles,
    active,
    created_at,
    last_updated
)
SELECT 
    p.id,
    p.target_language_id,
    'target',
    COALESCE(p.download_profiles, '{}'::uuid[]),
    p.active,
    p.created_at,
    p.last_updated
FROM public.project p
WHERE p.target_language_id IS NOT NULL
  AND p.active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.project_language_link pll
    WHERE pll.project_id = p.id
      AND pll.language_type = 'target'
      AND pll.language_id = p.target_language_id
      AND pll.active = true
  )
ON CONFLICT (project_id, language_id, language_type) DO NOTHING;

-- Migrate asset.source_language_id to asset_content_link.source_language_id
-- All asset_content_link entries for an asset must have the same source_language_id as the asset.
-- Only update existing entries - do not create new asset_content_link entries.

UPDATE public.asset_content_link acl
SET source_language_id = a.source_language_id,
    last_updated = NOW()
FROM public.asset a
WHERE acl.asset_id = a.id
  AND a.source_language_id IS NOT NULL
  AND a.active = true
  AND acl.active = true
  AND (acl.source_language_id IS NULL OR acl.source_language_id != a.source_language_id);

-- ============================================================================
-- STEP 1: Add creator_id to languoid and region tables
-- ============================================================================

-- Add creator_id to languoid table
ALTER TABLE public.languoid 
ADD COLUMN IF NOT EXISTS creator_id uuid REFERENCES public.profile(id) ON DELETE SET NULL;

-- Add creator_id to languoid_alias table
ALTER TABLE public.languoid_alias 
ADD COLUMN IF NOT EXISTS creator_id uuid REFERENCES public.profile(id) ON DELETE SET NULL;

-- Add creator_id to languoid_source table
ALTER TABLE public.languoid_source 
ADD COLUMN IF NOT EXISTS creator_id uuid REFERENCES public.profile(id) ON DELETE SET NULL;

-- Add creator_id to languoid_property table
ALTER TABLE public.languoid_property 
ADD COLUMN IF NOT EXISTS creator_id uuid REFERENCES public.profile(id) ON DELETE SET NULL;

-- Add creator_id to region table
ALTER TABLE public.region 
ADD COLUMN IF NOT EXISTS creator_id uuid REFERENCES public.profile(id) ON DELETE SET NULL;

-- Add creator_id to region_alias table
ALTER TABLE public.region_alias 
ADD COLUMN IF NOT EXISTS creator_id uuid REFERENCES public.profile(id) ON DELETE SET NULL;

-- Add creator_id to region_source table
ALTER TABLE public.region_source 
ADD COLUMN IF NOT EXISTS creator_id uuid REFERENCES public.profile(id) ON DELETE SET NULL;

-- Add creator_id to region_property table
ALTER TABLE public.region_property 
ADD COLUMN IF NOT EXISTS creator_id uuid REFERENCES public.profile(id) ON DELETE SET NULL;

-- Add creator_id to languoid_region table
ALTER TABLE public.languoid_region 
ADD COLUMN IF NOT EXISTS creator_id uuid REFERENCES public.profile(id) ON DELETE SET NULL;

-- ============================================================================
-- STEP 2: Add languoid reference fields
-- ============================================================================

-- Add ui_languoid_id to profile table
ALTER TABLE public.profile 
ADD COLUMN IF NOT EXISTS ui_languoid_id text REFERENCES public.languoid(id) ON DELETE SET NULL;

-- Add languoid_id to asset_content_link table
ALTER TABLE public.asset_content_link 
ADD COLUMN IF NOT EXISTS languoid_id text REFERENCES public.languoid(id) ON DELETE SET NULL;

-- Add languoid_id to project_language_link table
ALTER TABLE public.project_language_link 
ADD COLUMN IF NOT EXISTS languoid_id text REFERENCES public.languoid(id) ON DELETE SET NULL;

-- ============================================================================
-- STEP 3: Create indexes for new foreign keys
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_languoid_creator ON public.languoid(creator_id) WHERE creator_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_languoid_alias_creator ON public.languoid_alias(creator_id) WHERE creator_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_languoid_source_creator ON public.languoid_source(creator_id) WHERE creator_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_languoid_property_creator ON public.languoid_property(creator_id) WHERE creator_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_region_creator ON public.region(creator_id) WHERE creator_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_region_alias_creator ON public.region_alias(creator_id) WHERE creator_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_region_source_creator ON public.region_source(creator_id) WHERE creator_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_region_property_creator ON public.region_property(creator_id) WHERE creator_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_languoid_region_creator ON public.languoid_region(creator_id) WHERE creator_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profile_ui_languoid ON public.profile(ui_languoid_id) WHERE ui_languoid_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asset_content_link_languoid ON public.asset_content_link(languoid_id) WHERE languoid_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_project_language_link_languoid ON public.project_language_link(languoid_id) WHERE languoid_id IS NOT NULL;

-- ============================================================================
-- STEP 4: Find and populate matching languoid records
-- ============================================================================

-- Helper function to find matching languoid by language record
-- Priority: ISO 639-3 code > english_name > native_name
CREATE OR REPLACE FUNCTION find_matching_languoid(lang_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  lang_record RECORD;
  matched_languoid_id text;
BEGIN
  -- Get language record
  SELECT iso639_3, english_name, native_name INTO lang_record
  FROM public.language
  WHERE id = lang_id AND active = true;
  
  IF lang_record IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Priority 1: Match by ISO 639-3 code
  IF lang_record.iso639_3 IS NOT NULL AND trim(lang_record.iso639_3) != '' THEN
    SELECT ls.languoid_id INTO matched_languoid_id
    FROM public.languoid_source ls
    WHERE lower(trim(ls.unique_identifier)) = lower(trim(lang_record.iso639_3))
      AND lower(ls.name) = 'iso639-3'
      AND ls.active = true
    LIMIT 1;
    
    IF matched_languoid_id IS NOT NULL THEN
      RETURN matched_languoid_id;
    END IF;
  END IF;
  
  -- Priority 2: Match by english_name (check languoid.name first, then alias)
  IF lang_record.english_name IS NOT NULL AND trim(lang_record.english_name) != '' THEN
    -- Check languoid.name
    SELECT id INTO matched_languoid_id
    FROM public.languoid
    WHERE lower(trim(name)) = lower(trim(lang_record.english_name))
      AND active = true
    LIMIT 1;
    
    IF matched_languoid_id IS NOT NULL THEN
      RETURN matched_languoid_id;
    END IF;
    
    -- Check languoid_alias.name
    SELECT la.subject_languoid_id INTO matched_languoid_id
    FROM public.languoid_alias la
    WHERE lower(trim(la.name)) = lower(trim(lang_record.english_name))
      AND la.active = true
    LIMIT 1;
    
    IF matched_languoid_id IS NOT NULL THEN
      RETURN matched_languoid_id;
    END IF;
  END IF;
  
  -- Priority 3: Match by native_name (check languoid.name first, then alias)
  IF lang_record.native_name IS NOT NULL AND trim(lang_record.native_name) != '' THEN
    -- Check languoid.name
    SELECT id INTO matched_languoid_id
    FROM public.languoid
    WHERE lower(trim(name)) = lower(trim(lang_record.native_name))
      AND active = true
    LIMIT 1;
    
    IF matched_languoid_id IS NOT NULL THEN
      RETURN matched_languoid_id;
    END IF;
    
    -- Check languoid_alias.name
    SELECT la.subject_languoid_id INTO matched_languoid_id
    FROM public.languoid_alias la
    WHERE lower(trim(la.name)) = lower(trim(lang_record.native_name))
      AND la.active = true
    LIMIT 1;
    
    IF matched_languoid_id IS NOT NULL THEN
      RETURN matched_languoid_id;
    END IF;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Populate profile.ui_languoid_id from profile.ui_language_id
UPDATE public.profile p
SET ui_languoid_id = find_matching_languoid(p.ui_language_id)
WHERE p.ui_language_id IS NOT NULL
  AND p.ui_languoid_id IS NULL;

-- Populate asset_content_link.languoid_id from asset_content_link.source_language_id
UPDATE public.asset_content_link acl
SET languoid_id = find_matching_languoid(acl.source_language_id)
WHERE acl.source_language_id IS NOT NULL
  AND acl.languoid_id IS NULL
  AND acl.active = true;

-- Populate project_language_link.languoid_id from project_language_link.language_id
UPDATE public.project_language_link pll
SET languoid_id = find_matching_languoid(pll.language_id)
WHERE pll.language_id IS NOT NULL
  AND pll.languoid_id IS NULL
  AND pll.active = true;

-- ============================================================================
-- STEP 5: Create languoid records for unmatched languages
-- ============================================================================
-- For languages that couldn't be matched to existing languoids, create new
-- languoid records and link them via languoid_source if iso639-3 code exists

DO $$
DECLARE
  lang_record RECORD;
  new_languoid_id TEXT;
  languoid_name TEXT;
BEGIN
  -- Find all languages that don't have a matching languoid
  FOR lang_record IN
    SELECT l.id, l.english_name, l.native_name, l.iso639_3, l.ui_ready, l.creator_id
    FROM public.language l
    WHERE l.active = true
      AND find_matching_languoid(l.id) IS NULL
  LOOP
    -- Determine languoid name (prefer english_name, fallback to native_name)
    languoid_name := COALESCE(
      NULLIF(trim(lang_record.english_name), ''),
      NULLIF(trim(lang_record.native_name), '')
    );
    
    -- Skip if no name available
    IF languoid_name IS NULL OR languoid_name = '' THEN
      CONTINUE;
    END IF;
    
    -- Generate a new languoid ID (using a deterministic approach based on language ID)
    -- This ensures idempotency if migration is run multiple times
    new_languoid_id := 'lang-' || replace(lang_record.id::text, '-', '');
    
    -- Check if languoid already exists (idempotency check)
    IF NOT EXISTS (SELECT 1 FROM public.languoid WHERE id = new_languoid_id) THEN
      -- Create the languoid record
      INSERT INTO public.languoid (
        id,
        name,
        level,
        ui_ready,
        active,
        creator_id,
        created_at,
        last_updated
      ) VALUES (
        new_languoid_id,
        languoid_name,
        'language',
        COALESCE(lang_record.ui_ready, false),
        true,
        lang_record.creator_id,
        NOW(),
        NOW()
      );
      
      -- Create languoid_source record if iso639-3 code exists
      IF lang_record.iso639_3 IS NOT NULL AND trim(lang_record.iso639_3) != '' THEN
        INSERT INTO public.languoid_source (
          id,
          name,
          languoid_id,
          unique_identifier,
          active,
          creator_id,
          created_at,
          last_updated
        ) VALUES (
          'lsrc-' || replace(lang_record.id::text, '-', ''),
          'iso639-3',
          new_languoid_id,
          trim(lang_record.iso639_3),
          true,
          lang_record.creator_id,
          NOW(),
          NOW()
        )
        ON CONFLICT (languoid_id, unique_identifier) DO NOTHING;
      END IF;
    END IF;
    
    -- Now update the references to point to the newly created languoid
    -- Update profile.ui_languoid_id
    UPDATE public.profile
    SET ui_languoid_id = new_languoid_id
    WHERE ui_language_id = lang_record.id
      AND ui_languoid_id IS NULL;
    
    -- Update asset_content_link.languoid_id
    UPDATE public.asset_content_link
    SET languoid_id = new_languoid_id
    WHERE source_language_id = lang_record.id
      AND languoid_id IS NULL
      AND active = true;
    
    -- Update project_language_link.languoid_id
    UPDATE public.project_language_link
    SET languoid_id = new_languoid_id
    WHERE language_id = lang_record.id
      AND languoid_id IS NULL
      AND active = true;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 6: Set languoid.ui_ready=true for matched languoids
-- ============================================================================
-- Update languoid.ui_ready based on corresponding language.ui_ready for all
-- matched languoids (both newly created and existing)

UPDATE public.languoid lo
SET ui_ready = true,
    last_updated = NOW()
FROM public.language l
WHERE l.active = true
  AND l.ui_ready = true
  AND find_matching_languoid(l.id) = lo.id
  AND lo.ui_ready = false;

-- ============================================================================
-- STEP 7: Update schema version
-- ============================================================================

-- Update get_schema_info function to return version 1.1
CREATE OR REPLACE FUNCTION public.get_schema_info()
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'schema_version', '1.1',
    'notes', 'Added languoid references and creator_id fields to languoid/region tables'
  );
$$;

-- ============================================================================
-- Cleanup: Drop helper function (optional - can keep for future use)
-- ============================================================================

-- Keep the function for potential future use, but comment out if you want to drop it:
-- DROP FUNCTION IF EXISTS find_matching_languoid(uuid);

