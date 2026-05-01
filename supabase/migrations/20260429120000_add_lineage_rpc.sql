-- ============================================================================
-- get_template_lineage: returns the full fork family tree for any template
-- ============================================================================
-- Given any template ID, walks up to the root ancestor via copied_from_template_id,
-- then walks down to collect all descendants. Returns a flat JSONB array
-- representing the full family tree.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_template_lineage(p_template_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_root_id UUID;
  v_result JSONB;
BEGIN
  -- Walk up to find root ancestor
  WITH RECURSIVE ancestors AS (
    SELECT id, copied_from_template_id
    FROM template WHERE id = p_template_id AND active = true
    UNION ALL
    SELECT t.id, t.copied_from_template_id
    FROM template t
    JOIN ancestors a ON t.id = a.copied_from_template_id
    WHERE t.active = true
  )
  SELECT id INTO v_root_id FROM ancestors WHERE copied_from_template_id IS NULL;

  -- Walk down from root to get entire family
  WITH RECURSIVE family AS (
    SELECT id FROM template WHERE id = COALESCE(v_root_id, p_template_id)
    UNION ALL
    SELECT t.id FROM template t
    JOIN family f ON t.copied_from_template_id = f.id
    WHERE t.active = true
  )
  SELECT jsonb_agg(jsonb_build_object(
    'id', t.id,
    'name', t.name,
    'creator_id', t.creator_id,
    'copied_from_template_id', t.copied_from_template_id,
    'created_at', t.created_at,
    'project_count', t.project_count
  ))
  INTO v_result
  FROM family f
  JOIN template t ON t.id = f.id;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_template_lineage(UUID) TO authenticated;

-- ============================================================================
-- fetch_template_revisions: returns revision history for a template
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_template_revisions(p_template_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_agg(jsonb_build_object(
    'id', r.id,
    'saved_at', r.saved_at,
    'saved_by', r.saved_by,
    'actions', r.actions
  ) ORDER BY r.saved_at DESC)
  INTO v_result
  FROM template_revision r
  WHERE r.template_id = p_template_id;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_template_revisions(UUID) TO authenticated;

-- ============================================================================
-- check_template_compatibility: validates a new structure against existing data
-- ============================================================================
-- Given a template ID and a list of project_template_link IDs, returns the set
-- of template_node_id values that are currently referenced by quests in those
-- projects but would be missing from the provided structure.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_template_compatibility(
  p_template_id UUID,
  p_target_link_ids UUID[],
  p_node_ids TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_missing JSONB;
BEGIN
  SELECT jsonb_agg(DISTINCT q.template_node_id)
  INTO v_missing
  FROM quest q
  JOIN project_template_link ptl ON ptl.project_id = q.project_id
  WHERE ptl.id = ANY(p_target_link_ids)
    AND ptl.template_id = p_template_id
    AND ptl.active = true
    AND q.template_node_id IS NOT NULL
    AND q.template_node_id != ALL(p_node_ids);

  RETURN jsonb_build_object(
    'compatible', v_missing IS NULL,
    'missing_node_ids', COALESCE(v_missing, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_template_compatibility(UUID, UUID[], TEXT[]) TO authenticated;

-- ============================================================================
-- adopt_template_fork: re-point a single project_template_link to a new template
-- ============================================================================
-- Used when a project owner wants to adopt another editor's fork of their
-- current template. Validates ownership, frozen status, and node compatibility.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.adopt_template_fork(
  p_link_id UUID,
  p_target_template_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_link RECORD;
  v_missing JSONB;
BEGIN
  -- Fetch the link and verify ownership
  SELECT ptl.id, ptl.project_id, ptl.template_id, ptl.frozen
  INTO v_link
  FROM project_template_link ptl
  JOIN profile_project_link ppl ON ppl.project_id = ptl.project_id
  WHERE ptl.id = p_link_id
    AND ptl.active = true
    AND ppl.profile_id = v_user_id
    AND ppl.membership = 'owner'
    AND ppl.active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason',
      'Link not found or you are not the project owner');
  END IF;

  IF v_link.frozen THEN
    RETURN jsonb_build_object('ok', false, 'reason',
      'This project link is frozen and cannot be changed');
  END IF;

  -- Verify target template exists and is active
  IF NOT EXISTS (SELECT 1 FROM template WHERE id = p_target_template_id AND active = true) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Target template not found');
  END IF;

  -- Already pointing to this template
  IF v_link.template_id = p_target_template_id THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'Already using this template');
  END IF;

  -- Compatibility check: all referenced node IDs must exist in target
  SELECT jsonb_agg(DISTINCT q.template_node_id)
  INTO v_missing
  FROM quest q
  WHERE q.project_id = v_link.project_id
    AND q.template_node_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM template t,
        LATERAL jsonb_path_query(t.structure, '$.**.id' ) AS node_id
      WHERE t.id = p_target_template_id
        AND node_id #>> '{}' = q.template_node_id
    );

  IF v_missing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false,
      'reason', 'Target template is missing node IDs referenced by existing contributions',
      'missing_node_ids', v_missing);
  END IF;

  -- Re-point the link
  UPDATE project_template_link
  SET template_id = p_target_template_id
  WHERE id = p_link_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.adopt_template_fork(UUID, UUID) TO authenticated;

-- ============================================================================
-- link_template_to_project: add a template link to an existing project
-- ============================================================================

CREATE OR REPLACE FUNCTION public.link_template_to_project(
  p_project_id UUID,
  p_template_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  -- Verify ownership
  IF NOT EXISTS (
    SELECT 1 FROM profile_project_link
    WHERE project_id = p_project_id
      AND profile_id = v_user_id
      AND membership = 'owner'
      AND active = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'You are not the project owner');
  END IF;

  -- Verify template exists and is active
  IF NOT EXISTS (SELECT 1 FROM template WHERE id = p_template_id AND active = true) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Template not found');
  END IF;

  -- Check for existing active link
  IF EXISTS (
    SELECT 1 FROM project_template_link
    WHERE project_id = p_project_id AND template_id = p_template_id AND active = true
  ) THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'Already linked');
  END IF;

  INSERT INTO project_template_link (project_id, template_id, role, active)
  VALUES (p_project_id, p_template_id, 'primary', true);

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_template_to_project(UUID, UUID) TO authenticated;
