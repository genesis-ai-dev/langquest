-- Add INSERT policies for quest and asset tables
-- These are needed for PowerSync to upload published chapters

-- ============================================================================
-- QUEST TABLE: Allow creators and project owners to insert quests
-- ============================================================================

CREATE POLICY "Quest creators and project owners can insert quests"
ON "public"."quest"
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  -- User is the creator of the quest
  creator_id = auth.uid()
  OR
  -- User is an owner of the project this quest belongs to
  EXISTS (
    SELECT 1
    FROM public.profile_project_link ppl
    WHERE ppl.project_id = quest.project_id
    AND ppl.profile_id = auth.uid()
    AND ppl.membership = 'owner'
    AND ppl.active = true
  )
);

-- ============================================================================
-- ASSET TABLE: Allow creators and project owners to insert assets
-- ============================================================================

CREATE POLICY "Asset creators and project owners can insert assets"
ON "public"."asset"
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  -- User is the creator of the asset
  creator_id = auth.uid()
  OR
  -- User is an owner of a project that will link to this asset
  -- Note: This check is lenient because the asset might be linked after creation
  -- The quest_asset_link policies provide the actual security boundary
  EXISTS (
    SELECT 1
    FROM public.profile_project_link ppl
    WHERE ppl.project_id = asset.project_id
    AND ppl.profile_id = auth.uid()
    AND ppl.membership = 'owner'
    AND ppl.active = true
  )
);

-- ============================================================================
-- LINK TABLES: Ensure INSERT policies exist
-- ============================================================================

-- quest_asset_link
CREATE POLICY "Project owners can insert quest-asset links"
ON "public"."quest_asset_link"
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.quest q
    INNER JOIN public.profile_project_link ppl ON ppl.project_id = q.project_id
    WHERE q.id = quest_asset_link.quest_id
    AND ppl.profile_id = auth.uid()
    AND ppl.membership = 'owner'
    AND ppl.active = true
  )
);

-- asset_content_link
CREATE POLICY "Project owners can insert asset content links"
ON "public"."asset_content_link"
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.asset a
    INNER JOIN public.profile_project_link ppl ON ppl.project_id = a.project_id
    WHERE a.id = asset_content_link.asset_id
    AND ppl.profile_id = auth.uid()
    AND ppl.membership = 'owner'
    AND ppl.active = true
  )
);

-- quest_tag_link
CREATE POLICY "Project owners can insert quest tag links"
ON "public"."quest_tag_link"
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.quest q
    INNER JOIN public.profile_project_link ppl ON ppl.project_id = q.project_id
    WHERE q.id = quest_tag_link.quest_id
    AND ppl.profile_id = auth.uid()
    AND ppl.membership = 'owner'
    AND ppl.active = true
  )
);

-- asset_tag_link
CREATE POLICY "Project owners can insert asset tag links"
ON "public"."asset_tag_link"
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.asset a
    INNER JOIN public.profile_project_link ppl ON ppl.project_id = a.project_id
    WHERE a.id = asset_tag_link.asset_id
    AND ppl.profile_id = auth.uid()
    AND ppl.membership = 'owner'
    AND ppl.active = true
  )
);

-- tag (anyone can insert tags, they're shared)
CREATE POLICY "Authenticated users can insert tags"
ON "public"."tag"
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (true);


