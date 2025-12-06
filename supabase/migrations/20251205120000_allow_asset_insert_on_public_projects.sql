-- Migration: Allow asset inserts on public projects + languoid/region id defaults
-- Purpose: 
--   1. Update the asset INSERT RLS policy to allow any authenticated user
--      to create translation assets on public projects (must have source_asset_id)
--   2. Add default gen_random_uuid() to languoid and region table id fields

-- ============================================================================
-- PART 1: Update asset INSERT RLS policy
-- ============================================================================

DROP POLICY IF EXISTS "Asset insert limited to owners and members" ON public.asset;

CREATE POLICY "Asset insert limited to owners and members"
ON public.asset
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  asset.creator_id = (SELECT auth.uid())
  AND (
    -- User is a member or owner of the project
    EXISTS (
      SELECT 1
      FROM profile_project_link ppl
      WHERE ppl.profile_id = (SELECT auth.uid())
        AND ppl.active = true
        AND ppl.membership IN ('owner', 'member')
        AND ppl.project_id = asset.project_id
    )
    -- OR user is the project creator
    OR EXISTS (
      SELECT 1
      FROM project p
      WHERE p.id = asset.project_id
        AND p.creator_id = (SELECT auth.uid())
    )
    -- OR the project is public AND this is a translation (has source_asset_id)
    OR (
      asset.source_asset_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM project p
        WHERE p.id = asset.project_id
          AND p.private = false
      )
    )
  )
);

-- ============================================================================
-- PART 1B: Update asset_content_link INSERT RLS policy
-- ============================================================================

DROP POLICY IF EXISTS "Asset content insert limited to owners and members" ON public.asset_content_link;

CREATE POLICY "Asset content insert limited to owners and members"
ON public.asset_content_link
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  -- User is a member or owner of the project
  EXISTS (
    SELECT 1
    FROM asset a
    JOIN profile_project_link ppl ON ppl.project_id = a.project_id
    WHERE a.id = asset_content_link.asset_id
      AND ppl.profile_id = (SELECT auth.uid())
      AND ppl.membership IN ('owner', 'member')
      AND ppl.active = true
  )
  -- OR user is the project creator
  OR EXISTS (
    SELECT 1
    FROM asset a
    JOIN project p ON p.id = a.project_id
    WHERE a.id = asset_content_link.asset_id
      AND p.creator_id = (SELECT auth.uid())
  )
  -- OR the project is public AND the asset is a translation (has source_asset_id)
  OR EXISTS (
    SELECT 1
    FROM asset a
    JOIN project p ON p.id = a.project_id
    WHERE a.id = asset_content_link.asset_id
      AND a.source_asset_id IS NOT NULL
      AND p.private = false
  )
);

-- ============================================================================
-- PART 1C: Update quest_asset_link INSERT RLS policy
-- ============================================================================

DROP POLICY IF EXISTS "Quest asset link insert limited to owners and members" ON public.quest_asset_link;

CREATE POLICY "Quest asset link insert limited to owners and members"
ON public.quest_asset_link
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  -- User is a member or owner of the project
  EXISTS (
    SELECT 1
    FROM quest q
    JOIN profile_project_link ppl ON ppl.project_id = q.project_id
    WHERE q.id = quest_asset_link.quest_id
      AND ppl.profile_id = (SELECT auth.uid())
      AND ppl.membership IN ('owner', 'member')
      AND ppl.active = true
  )
  -- OR user is the project creator
  OR EXISTS (
    SELECT 1
    FROM quest q
    JOIN project p ON p.id = q.project_id
    WHERE q.id = quest_asset_link.quest_id
      AND p.creator_id = (SELECT auth.uid())
  )
  -- OR the project is public AND the asset is a translation (has source_asset_id)
  OR EXISTS (
    SELECT 1
    FROM quest q
    JOIN project p ON p.id = q.project_id
    JOIN asset a ON a.id = quest_asset_link.asset_id
    WHERE q.id = quest_asset_link.quest_id
      AND a.source_asset_id IS NOT NULL
      AND p.private = false
  )
);

-- ============================================================================
-- PART 2: Add default gen_random_uuid() to languoid and region table ids
-- ============================================================================

-- Languoid tables
ALTER TABLE public.languoid 
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE public.languoid_alias 
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE public.languoid_source 
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE public.languoid_property 
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Region tables
ALTER TABLE public.region 
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE public.region_alias 
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE public.region_source 
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE public.region_property 
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Junction table
ALTER TABLE public.languoid_region 
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

