-- ============================================================================
-- Migration: Add languoid references and creator_id fields
-- ============================================================================
-- 
-- IMPORTANT: Set longer timeout for this migration (large data migration)
-- See: https://supabase.com/docs/guides/database/postgres/timeouts
-- ============================================================================
SET statement_timeout = '30min';

-- ============================================================================
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
-- 4. Increment schema version from 1.0 to 2.0
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

-- First, create indexes to speed up the matching queries
CREATE INDEX IF NOT EXISTS idx_languoid_source_unique_id_lower 
  ON public.languoid_source(lower(trim(unique_identifier))) 
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_languoid_name_lower 
  ON public.languoid(lower(trim(name))) 
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_languoid_alias_name_lower 
  ON public.languoid_alias(lower(trim(name))) 
  WHERE active = true;

-- ============================================================================
-- Build language->languoid mapping in sequential steps (faster than COALESCE with 5 subqueries)
-- Each step only processes unmatched languages from previous step
-- ============================================================================

-- Start with all active languages (languoid_id = NULL means unmatched)
CREATE TEMP TABLE _language_to_languoid_map (
  language_id uuid PRIMARY KEY,
  languoid_id text
);

INSERT INTO _language_to_languoid_map (language_id, languoid_id)
SELECT id, NULL FROM public.language WHERE active = true;
  
  -- Priority 1: Match by ISO 639-3 code
UPDATE _language_to_languoid_map m
SET languoid_id = (
  SELECT ls.languoid_id 
    FROM public.languoid_source ls
  WHERE lower(trim(ls.unique_identifier)) = lower(trim(l.iso639_3))
      AND lower(ls.name) = 'iso639-3'
      AND ls.active = true
  LIMIT 1
)
FROM public.language l
WHERE m.language_id = l.id
  AND m.languoid_id IS NULL
  AND l.iso639_3 IS NOT NULL 
  AND trim(l.iso639_3) != '';
  
-- Priority 2: Match english_name in languoid.name
UPDATE _language_to_languoid_map m
SET languoid_id = (
  SELECT lo.id 
  FROM public.languoid lo 
  WHERE lower(trim(lo.name)) = lower(trim(l.english_name))
    AND lo.active = true
  LIMIT 1
)
FROM public.language l
WHERE m.language_id = l.id
  AND m.languoid_id IS NULL
  AND l.english_name IS NOT NULL 
  AND trim(l.english_name) != '';
    
-- Priority 3: Match english_name in languoid_alias.name
UPDATE _language_to_languoid_map m
SET languoid_id = (
  SELECT la.subject_languoid_id 
    FROM public.languoid_alias la
  WHERE lower(trim(la.name)) = lower(trim(l.english_name))
      AND la.active = true
  LIMIT 1
)
FROM public.language l
WHERE m.language_id = l.id
  AND m.languoid_id IS NULL
  AND l.english_name IS NOT NULL 
  AND trim(l.english_name) != '';
  
-- Priority 4: Match native_name in languoid.name
UPDATE _language_to_languoid_map m
SET languoid_id = (
  SELECT lo.id 
  FROM public.languoid lo 
  WHERE lower(trim(lo.name)) = lower(trim(l.native_name))
    AND lo.active = true
  LIMIT 1
)
FROM public.language l
WHERE m.language_id = l.id
  AND m.languoid_id IS NULL
  AND l.native_name IS NOT NULL 
  AND trim(l.native_name) != '';
    
-- Priority 5: Match native_name in languoid_alias.name
UPDATE _language_to_languoid_map m
SET languoid_id = (
  SELECT la.subject_languoid_id 
    FROM public.languoid_alias la
  WHERE lower(trim(la.name)) = lower(trim(l.native_name))
      AND la.active = true
  LIMIT 1
)
FROM public.language l
WHERE m.language_id = l.id
  AND m.languoid_id IS NULL
  AND l.native_name IS NOT NULL 
  AND trim(l.native_name) != '';

-- ============================================================================
-- Now use the mapping table for all UPDATEs (fast JOINs, no function calls)
-- ============================================================================

-- Populate profile.ui_languoid_id
UPDATE public.profile p
SET ui_languoid_id = m.languoid_id
FROM _language_to_languoid_map m
WHERE p.ui_language_id = m.language_id
  AND p.ui_languoid_id IS NULL
  AND m.languoid_id IS NOT NULL;

-- Populate asset_content_link.languoid_id (235k rows, but fast JOIN using pre-built mapping)
UPDATE public.asset_content_link acl
SET languoid_id = m.languoid_id
FROM _language_to_languoid_map m
WHERE acl.source_language_id = m.language_id
  AND acl.languoid_id IS NULL
  AND acl.active = true
  AND m.languoid_id IS NOT NULL;

-- Populate project_language_link.languoid_id (fast JOIN using pre-built mapping)
UPDATE public.project_language_link pll
SET languoid_id = m.languoid_id
FROM _language_to_languoid_map m
WHERE pll.language_id = m.language_id
  AND pll.languoid_id IS NULL
  AND pll.active = true
  AND m.languoid_id IS NOT NULL;

-- Keep mapping table for STEP 5 and STEP 6

-- ============================================================================
-- STEP 5: Create languoid records for unmatched languages
-- ============================================================================
-- For languages that couldn't be matched to existing languoids, create new
-- languoid records and link them via languoid_source if iso639-3 code exists
-- Uses the mapping table to find unmatched languages (where languoid_id IS NULL)

DO $$
DECLARE
  lang_record RECORD;
  new_languoid_id TEXT;
  languoid_name TEXT;
BEGIN
  -- Find all languages that don't have a matching languoid (using mapping table)
  FOR lang_record IN
    SELECT l.id, l.english_name, l.native_name, l.iso639_3, l.ui_ready, l.creator_id
    FROM public.language l
    INNER JOIN _language_to_languoid_map m ON m.language_id = l.id
    WHERE l.active = true
      AND m.languoid_id IS NULL
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
    
    -- Generate a new languoid ID (using the language's UUID directly)
    -- This ensures idempotency if migration is run multiple times
    new_languoid_id := lang_record.id::text;
    
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
          gen_random_uuid()::text,
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
-- Uses mapping table instead of function calls

UPDATE public.languoid lo
SET ui_ready = true,
    last_updated = NOW()
WHERE lo.id IN (
  SELECT m.languoid_id
  FROM _language_to_languoid_map m
  INNER JOIN public.language l ON l.id = m.language_id
  WHERE l.active = true
    AND l.ui_ready = true
    AND m.languoid_id IS NOT NULL
)
AND lo.ui_ready = false;

-- Also set ui_ready for newly created languoids (where languoid_id = language_id from STEP 5)
UPDATE public.languoid lo
SET ui_ready = true,
    last_updated = NOW()
WHERE lo.id::uuid IN (
  SELECT l.id
FROM public.language l
WHERE l.active = true
  AND l.ui_ready = true
)
  AND lo.ui_ready = false;

-- Cleanup mapping table (no longer needed after STEP 6)
DROP TABLE _language_to_languoid_map;

-- ============================================================================
-- STEP 7: Update schema version
-- ============================================================================

-- Update get_schema_info function to return version 2.0
CREATE OR REPLACE FUNCTION public.get_schema_info()
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'schema_version', '2.0',
    'notes', 'Breaking change: Migrated from language to languoid system'
  );
$$;

-- ============================================================================
-- Note: No helper function cleanup needed - migration uses efficient JOINs
-- ============================================================================


-- ============================================================================
-- Languoid Search RPC Function
-- ============================================================================
-- 
-- PURPOSE:
-- 1. Create pg_trgm extension for trigram-based text search
-- 2. Add GIN trigram indexes on languoid.name and languoid_alias.name
-- 3. Create search_languoids RPC function for intelligent language search
--
-- This function searches across languoid names and aliases, returning
-- ranked results that prioritize:
--   1. Exact matches
--   2. Starts-with matches
--   3. Contains matches
--
-- ============================================================================

-- Enable pg_trgm extension for trigram search
create extension if not exists pg_trgm;

-- Create GIN trigram indexes for performance
-- These indexes significantly speed up ILIKE queries on text columns

-- Index on languoid.name for fast name searches
create index if not exists idx_languoid_name_trgm 
on public.languoid using gin (name gin_trgm_ops);

-- Index on languoid_alias.name for fast alias searches
create index if not exists idx_languoid_alias_name_trgm 
on public.languoid_alias using gin (name gin_trgm_ops);

-- Create the search_languoids RPC function
-- This function searches languoids by name and aliases, returning ranked results
--
-- Parameters:
--   search_query: The search term (minimum 2 characters)
--   result_limit: Maximum number of results to return (default 50)
--   ui_ready_only: If true, only return ui_ready languoids (default false)
--
-- Returns:
--   Table with languoid details, best matching alias, and search rank

create or replace function public.search_languoids(
  search_query text,
  result_limit integer default 50,
  ui_ready_only boolean default false
)
returns table (
  id text,
  name text,
  level text,
  ui_ready boolean,
  parent_id text,
  matched_alias_name text,
  matched_alias_type text,
  iso_code text,
  search_rank integer
)
language plpgsql
security invoker
set search_path = ''
stable
as $$
declare
  normalized_query text;
begin
  -- Validate input
  if search_query is null or length(trim(search_query)) < 2 then
    return;
  end if;
  
  -- Normalize the search query
  normalized_query := lower(trim(search_query));
  
  return query
  with 
  -- Search languoid names directly
  languoid_name_matches as (
    select 
      l.id,
      l.name,
      l.level::text as level,
      l.ui_ready,
      l.parent_id,
      null::text as matched_alias_name,
      null::text as matched_alias_type,
      case
        when lower(l.name) = normalized_query then 1  -- Exact match
        when lower(l.name) like normalized_query || '%' then 2  -- Starts with
        else 3  -- Contains
      end as search_rank
    from public.languoid l
    where l.active = true
      and lower(l.name) ilike '%' || normalized_query || '%'
      and (not ui_ready_only or l.ui_ready = true)
  ),
  
  -- Search languoid aliases
  alias_matches as (
    select distinct on (l.id)
      l.id,
      l.name,
      l.level::text as level,
      l.ui_ready,
      l.parent_id,
      la.name as matched_alias_name,
      la.alias_type::text as matched_alias_type,
      case
        when lower(la.name) = normalized_query then 1  -- Exact match
        when lower(la.name) like normalized_query || '%' then 2  -- Starts with
        else 3  -- Contains
      end as search_rank
    from public.languoid l
    inner join public.languoid_alias la on la.subject_languoid_id = l.id and la.active = true
    where l.active = true
      and lower(la.name) ilike '%' || normalized_query || '%'
      and (not ui_ready_only or l.ui_ready = true)
    order by l.id, 
      case
        when lower(la.name) = normalized_query then 1
        when lower(la.name) like normalized_query || '%' then 2
        else 3
      end,
      la.alias_type  -- Prefer endonyms over exonyms
  ),
  
  -- Combine results, preferring the best rank for each languoid
  combined as (
    select * from languoid_name_matches
    union all
    select * from alias_matches
  ),
  
  -- Deduplicate by languoid id, keeping the best rank
  ranked as (
    select distinct on (c.id)
      c.id,
      c.name,
      c.level,
      c.ui_ready,
      c.parent_id,
      c.matched_alias_name,
      c.matched_alias_type,
      c.search_rank
    from combined c
    order by c.id, c.search_rank, c.matched_alias_name nulls last
  ),
  
  -- Get ISO codes from languoid_source
  with_iso as (
    select 
      r.*,
      ls.unique_identifier as iso_code
    from ranked r
    left join public.languoid_source ls 
      on ls.languoid_id = r.id 
      and lower(ls.name) = 'iso639-3'
      and ls.active = true
  )
  
  select 
    w.id,
    w.name,
    w.level,
    w.ui_ready,
    w.parent_id,
    w.matched_alias_name,
    w.matched_alias_type,
    w.iso_code,
    w.search_rank
  from with_iso w
  order by w.search_rank, w.name
  limit result_limit;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function public.search_languoids(text, integer, boolean) to authenticated;
grant execute on function public.search_languoids(text, integer, boolean) to anon;

-- -- Add comment for documentation (must specify full function signature)
-- comment on function public.search_languoids(text, integer, boolean) is 
-- 'Searches languoids by name and aliases with ranked results. 
-- Returns languoids matching the search query, prioritizing exact matches, 
-- then starts-with matches, then contains matches.
-- Parameters:
--   - search_query: Search term (min 2 chars)
--   - result_limit: Max results (default 50)
--   - ui_ready_only: Only return UI-ready languoids (default false)';

-- ============================================================================
-- STEP 8: Add languoid and region tables to PowerSync publication
-- ============================================================================
-- PowerSync requires tables to be part of the publication for replication.
-- Without this, the tables won't sync to client devices.

ALTER PUBLICATION powersync ADD TABLE public.languoid;
ALTER PUBLICATION powersync ADD TABLE public.languoid_alias;
ALTER PUBLICATION powersync ADD TABLE public.languoid_source;
ALTER PUBLICATION powersync ADD TABLE public.languoid_property;
ALTER PUBLICATION powersync ADD TABLE public.region;
ALTER PUBLICATION powersync ADD TABLE public.region_alias;
ALTER PUBLICATION powersync ADD TABLE public.region_source;
ALTER PUBLICATION powersync ADD TABLE public.region_property;
ALTER PUBLICATION powersync ADD TABLE public.languoid_region;

-- ============================================================================
-- STEP 9: Relax old language_id foreign key constraints
-- ============================================================================
-- Since we're migrating to languoid_id, the old language_id columns should be
-- nullable and have their foreign key constraints removed to allow for:
-- 1. New records that only have languoid_id (no language_id)
-- 2. Uploads of records with languoid_id but not language_id
-- 3. Backward compatibility with existing records that have language_id

-- project.target_language_id: Remove NOT NULL and FK constraint
ALTER TABLE public.project 
  ALTER COLUMN target_language_id DROP NOT NULL;

ALTER TABLE public.project 
  DROP CONSTRAINT IF EXISTS projects_target_language_id_fkey;

-- project_language_link.language_id: Remove FK constraint only
-- Note: Can't drop NOT NULL because language_id is part of the composite primary key
-- New records should use a placeholder UUID when no language_id exists
ALTER TABLE public.project_language_link 
  DROP CONSTRAINT IF EXISTS project_language_link_language_id_fkey;

-- asset.source_language_id: Remove FK constraint (NOT NULL already removed in prior migration)
ALTER TABLE public.asset 
  DROP CONSTRAINT IF EXISTS assets_source_language_id_fkey;

-- asset_content_link.source_language_id: Remove FK constraint
ALTER TABLE public.asset_content_link 
  DROP CONSTRAINT IF EXISTS asset_content_link_source_language_id_fkey;

-- translation.target_language_id: Remove NOT NULL and FK constraint
ALTER TABLE public.translation 
  ALTER COLUMN target_language_id DROP NOT NULL;

ALTER TABLE public.translation 
  DROP CONSTRAINT IF EXISTS translations_target_language_id_fkey;

-- profile.ui_language_id: Remove FK constraint (already nullable)
ALTER TABLE public.profile 
  DROP CONSTRAINT IF EXISTS users_ui_language_id_fkey;

-- ============================================================================
-- STEP 10: Change project_language_link PK to use languoid_id
-- ============================================================================
-- Migrate the primary key from (project_id, language_id, language_type) to
-- (project_id, languoid_id, language_type). This makes languoid the canonical
-- reference for project languages going forward.

-- First, ensure all rows have languoid_id populated (should already be done by STEP 4-5)
-- For any remaining NULLs, recreate the mapping using efficient JOINs (same as STEP 4)

-- Create temp mapping table using JOINs (no function calls)
CREATE TEMP TABLE _pll_step10_map AS
SELECT 
  l.id as language_id,
  COALESCE(
    (SELECT ls.languoid_id FROM public.languoid_source ls 
     WHERE l.iso639_3 IS NOT NULL AND trim(l.iso639_3) != ''
       AND lower(trim(ls.unique_identifier)) = lower(trim(l.iso639_3))
       AND lower(ls.name) = 'iso639-3' AND ls.active = true LIMIT 1),
    (SELECT lo.id FROM public.languoid lo 
     WHERE l.english_name IS NOT NULL AND trim(l.english_name) != ''
       AND lower(trim(lo.name)) = lower(trim(l.english_name)) AND lo.active = true LIMIT 1),
    (SELECT la.subject_languoid_id FROM public.languoid_alias la 
     WHERE l.english_name IS NOT NULL AND trim(l.english_name) != ''
       AND lower(trim(la.name)) = lower(trim(l.english_name)) AND la.active = true LIMIT 1),
    (SELECT lo.id FROM public.languoid lo 
     WHERE l.native_name IS NOT NULL AND trim(l.native_name) != ''
       AND lower(trim(lo.name)) = lower(trim(l.native_name)) AND lo.active = true LIMIT 1),
    (SELECT la.subject_languoid_id FROM public.languoid_alias la 
     WHERE l.native_name IS NOT NULL AND trim(l.native_name) != ''
       AND lower(trim(la.name)) = lower(trim(l.native_name)) AND la.active = true LIMIT 1),
    -- Fallback: use language_id as languoid_id (for newly created languoids in STEP 5)
    l.id::text
  ) as languoid_id
FROM public.language l
WHERE l.id IN (
  SELECT DISTINCT language_id FROM public.project_language_link
  WHERE language_id IS NOT NULL AND languoid_id IS NULL
)
AND l.active = true;

CREATE INDEX ON _pll_step10_map(language_id);

-- Fast JOIN-based UPDATE for remaining NULLs
UPDATE public.project_language_link pll
SET languoid_id = m.languoid_id
FROM _pll_step10_map m
WHERE pll.language_id = m.language_id
  AND pll.languoid_id IS NULL
  AND m.languoid_id IS NOT NULL;

DROP TABLE _pll_step10_map;

-- For any still-NULL languoid_id, create new languoid records
DO $$
DECLARE
  pll_record RECORD;
  new_languoid_id TEXT;
  lang_record RECORD;
BEGIN
  FOR pll_record IN
    SELECT pll.*, l.english_name, l.native_name, l.iso639_3
    FROM public.project_language_link pll
    LEFT JOIN public.language l ON l.id = pll.language_id
    WHERE pll.languoid_id IS NULL
  LOOP
    -- Generate languoid ID from language_id or random UUID
    new_languoid_id := COALESCE(pll_record.language_id::text, gen_random_uuid()::text);
    
    -- Create languoid if it doesn't exist
    INSERT INTO public.languoid (id, name, level, ui_ready, active, created_at, last_updated)
    VALUES (
      new_languoid_id,
      COALESCE(pll_record.english_name, pll_record.native_name, 'Unknown'),
      'language',
      false,
      true,
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;
    
    -- Update the link record
    UPDATE public.project_language_link
    SET languoid_id = new_languoid_id
    WHERE project_id = pll_record.project_id
      AND language_id = pll_record.language_id
      AND language_type = pll_record.language_type;
  END LOOP;
END $$;

-- Now drop old PK and create new one
ALTER TABLE public.project_language_link 
  DROP CONSTRAINT IF EXISTS project_language_link_pkey;

-- Make languoid_id NOT NULL (required for PK)
ALTER TABLE public.project_language_link
  ALTER COLUMN languoid_id SET NOT NULL;

-- Make language_id nullable (no longer part of PK)
ALTER TABLE public.project_language_link
  ALTER COLUMN language_id DROP NOT NULL;

-- Create new primary key
ALTER TABLE public.project_language_link
  ADD CONSTRAINT project_language_link_pkey 
  PRIMARY KEY (project_id, languoid_id, language_type);

-- Add index on language_id for backward compatibility queries
CREATE INDEX IF NOT EXISTS idx_pll_language_id 
  ON public.project_language_link(language_id) 
  WHERE language_id IS NOT NULL;

-- ============================================================================
-- STEP 11: Update clone function to use new PK
-- ============================================================================
-- The perform_clone_step function needs to include languoid_id when inserting
-- into project_language_link, since it's now part of the PK.

CREATE OR REPLACE FUNCTION public.perform_clone_step(p_job_id uuid, p_batch_size integer DEFAULT 25)
 RETURNS TABLE(done boolean, message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare
  v_locked boolean;
  v_stage text;
  v_status text;
  v_opts jsonb;
  v_root_project_id uuid;
  v_dst_project_id uuid;
  v_new_name text;
  v_target_language_id uuid;
  v_target_languoid_id text;
  v_creator_id uuid;
  v_rows int := 0;
  v_last int := 0;
  qrec record;
  arec record;
  lrec record;
begin
  select pg_try_advisory_lock(hashtext(p_job_id::text)) into v_locked;
  if not coalesce(v_locked, false) then
    return query select false, 'lock not acquired';
    return;
  end if;

  select (progress->>'stage')::text, status, options, root_project_id
  into v_stage, v_status, v_opts, v_root_project_id
  from public.clone_job
  where id = p_job_id;
  if v_stage is null then v_stage := 'seed_project'; end if;

  if v_stage = 'done' then
    update public.clone_job
    set status = 'done', updated_at = now()
    where id = p_job_id and status != 'done';
    return query select true, 'done';
  end if;

  update public.clone_job set status = 'running', updated_at = now() where id = p_job_id;

  v_new_name := coalesce(v_opts->>'new_project_name', 'Cloned Project');
  v_target_language_id := nullif(v_opts->>'target_language_id','')::uuid;
  v_target_languoid_id := nullif(v_opts->>'target_languoid_id','');
  v_creator_id := nullif(v_opts->>'creator_id','')::uuid;
  p_batch_size := greatest(coalesce(p_batch_size, (v_opts->>'batch_size')::int), 1);

  perform set_config('app.clone_mode','on', true);

  if v_stage = 'seed_project' then
    if not exists (select 1 from public.map_project where job_id = p_job_id and src_id = v_root_project_id) then

      insert into public.project (
        name,
        description,
        target_language_id,
        active,
        creator_id,
        private,
        visible,
        download_profiles,
        template,
        created_at,
        last_updated
      )
      select
        v_new_name,
        p.description,
        coalesce(v_target_language_id, p.target_language_id),
        coalesce(p.active, true),
        v_creator_id,
        p.private,
        p.visible,
        '{}'::uuid[],
        p.template,
        now(),
        now()
      from public.project p
      where p.id = v_root_project_id
      returning id into v_dst_project_id;

      insert into public.map_project(job_id, src_id, dst_id)
      values (p_job_id, v_root_project_id, v_dst_project_id)
      on conflict do nothing;

      -- Copy source language links with languoid_id (new PK)
      insert into public.project_language_link(project_id, language_id, languoid_id, language_type, active, created_at, last_updated)
      select v_dst_project_id, pll.language_id, pll.languoid_id, pll.language_type, pll.active, now(), now()
      from public.project_language_link pll
      where pll.project_id = v_root_project_id and pll.language_type = 'source'
      on conflict do nothing;

      -- Create target language link if specified
      if v_target_languoid_id is not null then
        insert into public.project_language_link(project_id, language_id, languoid_id, language_type, active, created_at, last_updated)
        values (v_dst_project_id, v_target_language_id, v_target_languoid_id, 'target', true, now(), now())
        on conflict do nothing;
      elsif v_target_language_id is not null then
        -- Fallback: try to find languoid_id from the source project's target link
        insert into public.project_language_link(project_id, language_id, languoid_id, language_type, active, created_at, last_updated)
        select v_dst_project_id, v_target_language_id, pll.languoid_id, 'target', true, now(), now()
        from public.project_language_link pll
        where pll.project_id = v_root_project_id and pll.language_type = 'target'
        limit 1
        on conflict do nothing;
      end if;

      insert into public.profile_project_link (profile_id, project_id, membership, active)
      values (v_creator_id, v_dst_project_id, 'owner', true)
      on conflict do nothing;

    else
      select dst_id into v_dst_project_id from public.map_project where job_id = p_job_id and src_id = v_root_project_id;
      insert into public.profile_project_link (profile_id, project_id, membership, active)
      values (v_creator_id, v_dst_project_id, 'owner', true)
      on conflict do nothing;
    end if;

    update public.clone_job
    set progress = coalesce(progress,'{}'::jsonb) || jsonb_build_object('stage','clone_quests','dst_project_id', v_dst_project_id::text),
        updated_at = now()
    where id = p_job_id;
    return query select false, 'seeded project';
  end if;

  if v_dst_project_id is null then
    select dst_id into v_dst_project_id from public.map_project where job_id = p_job_id and src_id = v_root_project_id;
  end if;

  if v_stage = 'clone_quests' then
    for qrec in
      select q.*
      from public.quest q
      where q.project_id = v_root_project_id and q.active
        and not exists (select 1 from public.map_quest mq where mq.job_id = p_job_id and mq.src_id = q.id)
      order by q.created_at
      limit p_batch_size
    loop
      insert into public.quest (project_id, name, complete, metadata, order_index, active, creator_id, visible, download_profiles, created_at, last_updated)
      values (v_dst_project_id, qrec.name, qrec.complete, qrec.metadata, qrec.order_index, qrec.active, v_creator_id, qrec.visible, '{}'::uuid[], now(), now())
      returning id into lrec;

      insert into public.map_quest(job_id, src_id, dst_id)
      values (p_job_id, qrec.id, lrec.id);

      v_rows := v_rows + 1;
    end loop;

    if v_rows < p_batch_size then
      update public.clone_job set progress = progress || '{"stage":"clone_assets"}'::jsonb, updated_at = now() where id = p_job_id;
      return query select false, format('quests done, cloned %s', v_rows);
    else
      return query select false, format('cloned %s quests', v_rows);
    end if;
  end if;

  if v_stage = 'clone_assets' then
    for arec in
      select a.*
      from public.asset a
      where a.project_id = v_root_project_id and a.active
        and not exists (select 1 from public.map_asset ma where ma.job_id = p_job_id and ma.src_id = a.id)
      order by a.created_at
      limit p_batch_size
    loop
      insert into public.asset (name, images, active, creator_id, visible, clone_id, download_profiles, source_language_id, project_id, created_at, last_updated)
      values (arec.name, arec.images, arec.active, v_creator_id, arec.visible, arec.id, '{}'::uuid[], arec.source_language_id, v_dst_project_id, now(), now())
      returning id into lrec;

      insert into public.map_asset(job_id, src_id, dst_id)
      values (p_job_id, arec.id, lrec.id);

      v_rows := v_rows + 1;
    end loop;

    if v_rows < p_batch_size then
      update public.clone_job set progress = progress || '{"stage":"clone_asset_content_links"}'::jsonb, updated_at = now() where id = p_job_id;
      return query select false, format('assets done, cloned %s', v_rows);
    else
      return query select false, format('cloned %s assets', v_rows);
    end if;
  end if;

  if v_stage = 'clone_asset_content_links' then
    for arec in
      select acl.*, ma.dst_id as new_asset_id
      from public.asset_content_link acl
      join public.map_asset ma on ma.job_id = p_job_id and ma.src_id = acl.asset_id
      where acl.active
        and not exists (select 1 from public.map_asset_content_link macl where macl.job_id = p_job_id and macl.src_id = acl.id)
      order by acl.created_at
      limit p_batch_size
    loop
      insert into public.asset_content_link (asset_id, audio, text, active, download_profiles, source_language_id, created_at, last_updated)
      values (arec.new_asset_id, arec.audio, arec.text, arec.active, '{}'::uuid[], arec.source_language_id, now(), now())
      returning id into lrec;

      insert into public.map_asset_content_link(job_id, src_id, dst_id)
      values (p_job_id, arec.id, lrec.id);

      v_rows := v_rows + 1;
    end loop;

    if v_rows < p_batch_size then
      update public.clone_job set progress = progress || '{"stage":"clone_quest_asset_links"}'::jsonb, updated_at = now() where id = p_job_id;
      return query select false, format('asset_content_links done, cloned %s', v_rows);
    else
      return query select false, format('cloned %s asset_content_links', v_rows);
    end if;
  end if;

  if v_stage = 'clone_quest_asset_links' then
    for arec in
      select qal.*, mq.dst_id as new_quest_id, ma.dst_id as new_asset_id
      from public.quest_asset_link qal
      join public.map_quest mq on mq.job_id = p_job_id and mq.src_id = qal.quest_id
      join public.map_asset ma on ma.job_id = p_job_id and ma.src_id = qal.asset_id
      where qal.active
        and not exists (
          select 1 from public.quest_asset_link existing
          where existing.quest_id = mq.dst_id and existing.asset_id = ma.dst_id
        )
      order by qal.created_at
      limit p_batch_size
    loop
      insert into public.quest_asset_link (quest_id, asset_id, visible, active, download_profiles, created_at, last_updated)
      values (arec.new_quest_id, arec.new_asset_id, arec.visible, arec.active, '{}'::uuid[], now(), now())
      on conflict do nothing;

      v_rows := v_rows + 1;
    end loop;

    if v_rows < p_batch_size then
      update public.clone_job set progress = progress || '{"stage":"clone_quest_closures"}'::jsonb, updated_at = now() where id = p_job_id;
      return query select false, format('quest_asset_links done, cloned %s', v_rows);
    else
      return query select false, format('cloned %s quest_asset_links', v_rows);
    end if;
  end if;

  if v_stage = 'clone_quest_closures' then
    for arec in
      select qc.*, mqa.dst_id as new_ancestor_id, mqd.dst_id as new_descendant_id
      from public.quest_closure qc
      join public.map_quest mqa on mqa.job_id = p_job_id and mqa.src_id = qc.ancestor_id
      join public.map_quest mqd on mqd.job_id = p_job_id and mqd.src_id = qc.descendant_id
      where not exists (
        select 1 from public.quest_closure existing
        where existing.ancestor_id = mqa.dst_id and existing.descendant_id = mqd.dst_id
      )
      limit p_batch_size
    loop
      insert into public.quest_closure (ancestor_id, descendant_id, depth, active, download_profiles, created_at, last_updated)
      values (arec.new_ancestor_id, arec.new_descendant_id, arec.depth, arec.active, '{}'::uuid[], now(), now())
      on conflict do nothing;

      v_rows := v_rows + 1;
    end loop;

    if v_rows < p_batch_size then
      update public.clone_job set progress = progress || '{"stage":"clone_tags"}'::jsonb, updated_at = now() where id = p_job_id;
      return query select false, format('quest_closures done, cloned %s', v_rows);
    else
      return query select false, format('cloned %s quest_closures', v_rows);
    end if;
  end if;

  if v_stage = 'clone_tags' then
    for arec in
      select t.*
      from public.tag t
      where t.project_id = v_root_project_id and t.active
        and not exists (select 1 from public.map_tag mt where mt.job_id = p_job_id and mt.src_id = t.id)
      order by t.created_at
      limit p_batch_size
    loop
      insert into public.tag (project_id, name, tag_type, active, download_profiles, created_at, last_updated)
      values (v_dst_project_id, arec.name, arec.tag_type, arec.active, '{}'::uuid[], now(), now())
      returning id into lrec;

      insert into public.map_tag(job_id, src_id, dst_id)
      values (p_job_id, arec.id, lrec.id);

      v_rows := v_rows + 1;
    end loop;

    if v_rows < p_batch_size then
      update public.clone_job set progress = progress || '{"stage":"clone_quest_tag_links"}'::jsonb, updated_at = now() where id = p_job_id;
      return query select false, format('tags done, cloned %s', v_rows);
    else
      return query select false, format('cloned %s tags', v_rows);
    end if;
  end if;

  if v_stage = 'clone_quest_tag_links' then
    for arec in
      select qtl.*, mq.dst_id as new_quest_id, mt.dst_id as new_tag_id
      from public.quest_tag_link qtl
      join public.map_quest mq on mq.job_id = p_job_id and mq.src_id = qtl.quest_id
      join public.map_tag mt on mt.job_id = p_job_id and mt.src_id = qtl.tag_id
      where qtl.active
        and not exists (
          select 1 from public.quest_tag_link existing
          where existing.quest_id = mq.dst_id and existing.tag_id = mt.dst_id
        )
      limit p_batch_size
    loop
      insert into public.quest_tag_link (quest_id, tag_id, active, download_profiles, created_at, last_updated)
      values (arec.new_quest_id, arec.new_tag_id, arec.active, '{}'::uuid[], now(), now())
      on conflict do nothing;

      v_rows := v_rows + 1;
    end loop;

    if v_rows < p_batch_size then
      update public.clone_job set progress = progress || '{"stage":"clone_asset_tag_links"}'::jsonb, updated_at = now() where id = p_job_id;
      return query select false, format('quest_tag_links done, cloned %s', v_rows);
    else
      return query select false, format('cloned %s quest_tag_links', v_rows);
    end if;
  end if;

  if v_stage = 'clone_asset_tag_links' then
    for arec in
      select atl.*, ma.dst_id as new_asset_id, mt.dst_id as new_tag_id
      from public.asset_tag_link atl
      join public.map_asset ma on ma.job_id = p_job_id and ma.src_id = atl.asset_id
      join public.map_tag mt on mt.job_id = p_job_id and mt.src_id = atl.tag_id
      where atl.active
        and not exists (
          select 1 from public.asset_tag_link existing
          where existing.asset_id = ma.dst_id and existing.tag_id = mt.dst_id
        )
      limit p_batch_size
    loop
      insert into public.asset_tag_link (asset_id, tag_id, active, download_profiles, created_at, last_updated)
      values (arec.new_asset_id, arec.new_tag_id, arec.active, '{}'::uuid[], now(), now())
      on conflict do nothing;

      v_rows := v_rows + 1;
    end loop;

    if v_rows < p_batch_size then
      update public.clone_job set progress = progress || '{"stage":"done"}'::jsonb, status = 'done', updated_at = now() where id = p_job_id;
      return query select true, 'done';
    else
      return query select false, format('cloned %s asset_tag_links', v_rows);
    end if;
  end if;

  return query select false, format('unknown stage: %s', v_stage);
exception when others then
  update public.clone_job set status = 'failed', updated_at = now() where id = p_job_id;
  raise;
end;
$function$;


-- ============================================================================
-- STEP 12: Convert languoid/region table IDs from TEXT to UUID
-- ============================================================================
-- All IDs should be UUID for consistency. The existing data already has
-- UUID-conforming values, so this is a safe type conversion.

-- Drop the old search_languoids function (different signature) before type conversion
-- The newer search_languoids(text, integer, boolean) supersedes it
DROP FUNCTION IF EXISTS public.search_languoids(text, int);

-- Drop foreign key constraints first (they reference text columns)
ALTER TABLE public.languoid DROP CONSTRAINT IF EXISTS languoid_parent_id_fkey;
ALTER TABLE public.languoid_alias DROP CONSTRAINT IF EXISTS languoid_alias_subject_languoid_id_fkey;
ALTER TABLE public.languoid_alias DROP CONSTRAINT IF EXISTS languoid_alias_label_languoid_id_fkey;
ALTER TABLE public.languoid_source DROP CONSTRAINT IF EXISTS languoid_source_languoid_id_fkey;
ALTER TABLE public.languoid_property DROP CONSTRAINT IF EXISTS languoid_property_languoid_id_fkey;
ALTER TABLE public.languoid_region DROP CONSTRAINT IF EXISTS languoid_region_languoid_id_fkey;
ALTER TABLE public.languoid_region DROP CONSTRAINT IF EXISTS languoid_region_region_id_fkey;
ALTER TABLE public.region DROP CONSTRAINT IF EXISTS region_parent_id_fkey;
ALTER TABLE public.region_alias DROP CONSTRAINT IF EXISTS region_alias_subject_region_id_fkey;
ALTER TABLE public.region_alias DROP CONSTRAINT IF EXISTS region_alias_label_languoid_id_fkey;
ALTER TABLE public.region_source DROP CONSTRAINT IF EXISTS region_source_region_id_fkey;
ALTER TABLE public.region_property DROP CONSTRAINT IF EXISTS region_property_region_id_fkey;

-- Drop FK constraints on tables that reference languoid
ALTER TABLE public.project_language_link DROP CONSTRAINT IF EXISTS project_language_link_languoid_id_fkey;
ALTER TABLE public.asset_content_link DROP CONSTRAINT IF EXISTS asset_content_link_languoid_id_fkey;
ALTER TABLE public.profile DROP CONSTRAINT IF EXISTS profile_ui_languoid_id_fkey;

-- Convert languoid.id from TEXT to UUID
ALTER TABLE public.languoid
  ALTER COLUMN id TYPE uuid USING id::uuid,
  ALTER COLUMN parent_id TYPE uuid USING parent_id::uuid;

-- Convert languoid_alias columns
ALTER TABLE public.languoid_alias
  ALTER COLUMN id TYPE uuid USING id::uuid,
  ALTER COLUMN subject_languoid_id TYPE uuid USING subject_languoid_id::uuid,
  ALTER COLUMN label_languoid_id TYPE uuid USING label_languoid_id::uuid;

-- Convert languoid_source columns
ALTER TABLE public.languoid_source
  ALTER COLUMN id TYPE uuid USING id::uuid,
  ALTER COLUMN languoid_id TYPE uuid USING languoid_id::uuid;

-- Convert languoid_property columns
ALTER TABLE public.languoid_property
  ALTER COLUMN id TYPE uuid USING id::uuid,
  ALTER COLUMN languoid_id TYPE uuid USING languoid_id::uuid;

-- Convert region.id from TEXT to UUID
ALTER TABLE public.region
  ALTER COLUMN id TYPE uuid USING id::uuid,
  ALTER COLUMN parent_id TYPE uuid USING parent_id::uuid;

-- Convert region_alias columns
ALTER TABLE public.region_alias
  ALTER COLUMN id TYPE uuid USING id::uuid,
  ALTER COLUMN subject_region_id TYPE uuid USING subject_region_id::uuid,
  ALTER COLUMN label_languoid_id TYPE uuid USING label_languoid_id::uuid;

-- Convert region_source columns
ALTER TABLE public.region_source
  ALTER COLUMN id TYPE uuid USING id::uuid,
  ALTER COLUMN region_id TYPE uuid USING region_id::uuid;

-- Convert region_property columns
ALTER TABLE public.region_property
  ALTER COLUMN id TYPE uuid USING id::uuid,
  ALTER COLUMN region_id TYPE uuid USING region_id::uuid;

-- Convert languoid_region columns
ALTER TABLE public.languoid_region
  ALTER COLUMN id TYPE uuid USING id::uuid,
  ALTER COLUMN languoid_id TYPE uuid USING languoid_id::uuid,
  ALTER COLUMN region_id TYPE uuid USING region_id::uuid;

-- Convert FK columns in other tables
ALTER TABLE public.project_language_link
  ALTER COLUMN languoid_id TYPE uuid USING languoid_id::uuid;

ALTER TABLE public.asset_content_link
  ALTER COLUMN languoid_id TYPE uuid USING languoid_id::uuid;

ALTER TABLE public.profile
  ALTER COLUMN ui_languoid_id TYPE uuid USING ui_languoid_id::uuid;

-- Re-add foreign key constraints with UUID types
ALTER TABLE public.languoid
  ADD CONSTRAINT languoid_parent_id_fkey
    FOREIGN KEY (parent_id) REFERENCES public.languoid(id) ON DELETE SET NULL DEFERRABLE;

ALTER TABLE public.languoid_alias
  ADD CONSTRAINT languoid_alias_subject_languoid_id_fkey
    FOREIGN KEY (subject_languoid_id) REFERENCES public.languoid(id) ON DELETE CASCADE,
  ADD CONSTRAINT languoid_alias_label_languoid_id_fkey
    FOREIGN KEY (label_languoid_id) REFERENCES public.languoid(id) ON DELETE SET NULL;

ALTER TABLE public.languoid_source
  ADD CONSTRAINT languoid_source_languoid_id_fkey
    FOREIGN KEY (languoid_id) REFERENCES public.languoid(id) ON DELETE CASCADE;

ALTER TABLE public.languoid_property
  ADD CONSTRAINT languoid_property_languoid_id_fkey
    FOREIGN KEY (languoid_id) REFERENCES public.languoid(id) ON DELETE CASCADE;

ALTER TABLE public.region
  ADD CONSTRAINT region_parent_id_fkey
    FOREIGN KEY (parent_id) REFERENCES public.region(id) ON DELETE SET NULL DEFERRABLE;

ALTER TABLE public.region_alias
  ADD CONSTRAINT region_alias_subject_region_id_fkey
    FOREIGN KEY (subject_region_id) REFERENCES public.region(id) ON DELETE CASCADE,
  ADD CONSTRAINT region_alias_label_languoid_id_fkey
    FOREIGN KEY (label_languoid_id) REFERENCES public.languoid(id) ON DELETE SET NULL;

ALTER TABLE public.region_source
  ADD CONSTRAINT region_source_region_id_fkey
    FOREIGN KEY (region_id) REFERENCES public.region(id) ON DELETE CASCADE;

ALTER TABLE public.region_property
  ADD CONSTRAINT region_property_region_id_fkey
    FOREIGN KEY (region_id) REFERENCES public.region(id) ON DELETE CASCADE;

ALTER TABLE public.languoid_region
  ADD CONSTRAINT languoid_region_languoid_id_fkey
    FOREIGN KEY (languoid_id) REFERENCES public.languoid(id) ON DELETE CASCADE,
  ADD CONSTRAINT languoid_region_region_id_fkey
    FOREIGN KEY (region_id) REFERENCES public.region(id) ON DELETE CASCADE;

ALTER TABLE public.project_language_link
  ADD CONSTRAINT project_language_link_languoid_id_fkey
    FOREIGN KEY (languoid_id) REFERENCES public.languoid(id) ON DELETE SET NULL;

ALTER TABLE public.asset_content_link
  ADD CONSTRAINT asset_content_link_languoid_id_fkey
    FOREIGN KEY (languoid_id) REFERENCES public.languoid(id) ON DELETE SET NULL;

ALTER TABLE public.profile
  ADD CONSTRAINT profile_ui_languoid_id_fkey
    FOREIGN KEY (ui_languoid_id) REFERENCES public.languoid(id) ON DELETE SET NULL;


-- ============================================================================
-- STEP 13: Update add_to_download_profiles RPC to include languoid tables
-- ============================================================================
-- Now that languoid tables use UUID ids, we can add them to the existing RPC

CREATE OR REPLACE FUNCTION public.add_to_download_profiles(
  p_table_name text,
  p_record_id  uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_sql text;
  v_rows_affected int;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate table name (prevent SQL injection)
  IF p_table_name NOT IN (
    'quest', 'project', 'asset', 'asset_content_link',
    'vote', 'tag', 'language',
    'languoid', 'languoid_alias', 'languoid_source', 'languoid_property',
    'languoid_region', 'region', 'region_alias', 'region_source', 'region_property'
  ) THEN
    RAISE EXCEPTION 'Invalid table name: %', p_table_name;
  END IF;

  -- Append user id if not already present
  v_sql := format(
    'UPDATE %I
       SET download_profiles = array_append(
             COALESCE(download_profiles, ARRAY[]::uuid[]),
             %L::uuid
           ),
           last_updated = now()
     WHERE id = %L
       AND (download_profiles IS NULL OR NOT %L::uuid = ANY(download_profiles))',
    p_table_name,
    v_user_id,
    p_record_id,
    v_user_id
  );

  EXECUTE v_sql;
  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  RETURN v_rows_affected > 0;
END;
$$;


-- ============================================================================
-- STEP 14: Update remove_from_download_profiles RPC to include languoid tables
-- ============================================================================

CREATE OR REPLACE FUNCTION public.remove_from_download_profiles(
  p_table_name text,
  p_record_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sql text;
  v_user_id uuid;
  v_rows_affected integer;
BEGIN
  -- Get current user ID from auth context
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Validate table name (prevent SQL injection)
  IF p_table_name NOT IN (
    'quest', 'project', 'asset', 'asset_content_link',
    'vote', 'tag', 'language',
    'languoid', 'languoid_alias', 'languoid_source', 'languoid_property',
    'languoid_region', 'region', 'region_alias', 'region_source', 'region_property'
  ) THEN
    RAISE EXCEPTION 'Invalid table name: %', p_table_name;
  END IF;

  -- Build dynamic SQL to remove profile from array
  v_sql := format(
    'UPDATE %I
       SET download_profiles = array_remove(download_profiles, %L::uuid),
           last_updated = now()
     WHERE id = %L
       AND download_profiles IS NOT NULL
       AND %L::uuid = ANY(download_profiles)',
    p_table_name,
    v_user_id,
    p_record_id,
    v_user_id
  );

  EXECUTE v_sql;
  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  RETURN v_rows_affected > 0;
END;
$$;


-- ============================================================================
-- STEP 15: Recreate search_languoids with UUID return types
-- ============================================================================
-- Now that languoid.id is UUID, we need to update the function return types

DROP FUNCTION IF EXISTS public.search_languoids(text, integer, boolean);

CREATE OR REPLACE FUNCTION public.search_languoids(
  search_query text,
  result_limit integer default 50,
  ui_ready_only boolean default false
)
RETURNS TABLE (
  id uuid,
  name text,
  level text,
  ui_ready boolean,
  parent_id uuid,
  matched_alias_name text,
  matched_alias_type text,
  iso_code text,
  search_rank integer
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
STABLE
AS $$
DECLARE
  normalized_query text;
BEGIN
  -- Validate input
  IF search_query IS NULL OR length(trim(search_query)) < 2 THEN
    RETURN;
  END IF;
  
  -- Normalize the search query
  normalized_query := lower(trim(search_query));
  
  RETURN QUERY
  WITH 
  -- Search languoid names directly
  languoid_name_matches AS (
    SELECT 
      l.id,
      l.name,
      l.level::text AS level,
      l.ui_ready,
      l.parent_id,
      NULL::text AS matched_alias_name,
      NULL::text AS matched_alias_type,
      CASE
        WHEN lower(l.name) = normalized_query THEN 1  -- Exact match
        WHEN lower(l.name) LIKE normalized_query || '%' THEN 2  -- Starts with
        ELSE 3  -- Contains
      END AS search_rank
    FROM public.languoid l
    WHERE l.active = true
      AND lower(l.name) ILIKE '%' || normalized_query || '%'
      AND (NOT ui_ready_only OR l.ui_ready = true)
  ),
  
  -- Search languoid aliases
  alias_matches AS (
    SELECT DISTINCT ON (l.id)
      l.id,
      l.name,
      l.level::text AS level,
      l.ui_ready,
      l.parent_id,
      la.name AS matched_alias_name,
      la.alias_type::text AS matched_alias_type,
      CASE
        WHEN lower(la.name) = normalized_query THEN 1  -- Exact match
        WHEN lower(la.name) LIKE normalized_query || '%' THEN 2  -- Starts with
        ELSE 3  -- Contains
      END AS search_rank
    FROM public.languoid l
    INNER JOIN public.languoid_alias la ON la.subject_languoid_id = l.id AND la.active = true
    WHERE l.active = true
      AND lower(la.name) ILIKE '%' || normalized_query || '%'
      AND (NOT ui_ready_only OR l.ui_ready = true)
    ORDER BY l.id, 
      CASE
        WHEN lower(la.name) = normalized_query THEN 1
        WHEN lower(la.name) LIKE normalized_query || '%' THEN 2
        ELSE 3
      END,
      la.alias_type  -- Prefer endonyms over exonyms
  ),
  
  -- Combine results, preferring the best rank for each languoid
  combined AS (
    SELECT * FROM languoid_name_matches
    UNION ALL
    SELECT * FROM alias_matches
  ),
  
  -- Deduplicate by languoid id, keeping the best rank
  ranked AS (
    SELECT DISTINCT ON (c.id)
      c.id,
      c.name,
      c.level,
      c.ui_ready,
      c.parent_id,
      c.matched_alias_name,
      c.matched_alias_type,
      c.search_rank
    FROM combined c
    ORDER BY c.id, c.search_rank, c.matched_alias_name NULLS LAST
  ),
  
  -- Get ISO codes from languoid_source
  with_iso AS (
    SELECT 
      r.*,
      ls.unique_identifier AS iso_code
    FROM ranked r
    LEFT JOIN public.languoid_source ls 
      ON ls.languoid_id = r.id 
      AND lower(ls.name) = 'iso639-3'
      AND ls.active = true
  )
  
  SELECT 
    w.id,
    w.name,
    w.level,
    w.ui_ready,
    w.parent_id,
    w.matched_alias_name,
    w.matched_alias_type,
    w.iso_code,
    w.search_rank
  FROM with_iso w
  ORDER BY w.search_rank, w.name
  LIMIT result_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_languoids(text, integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_languoids(text, integer, boolean) TO anon;
