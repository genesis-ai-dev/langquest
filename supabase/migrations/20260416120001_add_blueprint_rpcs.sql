-- ============================================================================
-- Template RPCs: publish (fork-always), fork, metadata
-- ============================================================================

-- ============================================================================
-- Helper: validate template structure depth <= 5
-- ============================================================================

CREATE OR REPLACE FUNCTION public._validate_template_depth(p_structure JSONB, p_max_depth INTEGER DEFAULT 5)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_valid BOOLEAN := TRUE;
BEGIN
  WITH RECURSIVE tree AS (
    SELECT
      child.value AS node,
      1 AS depth
    FROM jsonb_array_elements(p_structure->'root'->'children') AS child
    UNION ALL
    SELECT
      grandchild.value AS node,
      tree.depth + 1
    FROM tree,
      jsonb_array_elements(tree.node->'children') AS grandchild
    WHERE tree.node->'children' IS NOT NULL
      AND jsonb_array_length(tree.node->'children') > 0
  )
  SELECT NOT EXISTS (SELECT 1 FROM tree WHERE tree.depth >= p_max_depth)
  INTO v_valid;

  RETURN v_valid;
END;
$$;

-- ============================================================================
-- Helper: validate single-per-lineage flags (is_download_unit, is_version_anchor)
-- ============================================================================

CREATE OR REPLACE FUNCTION public._validate_single_per_lineage(p_structure JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_valid BOOLEAN := TRUE;
BEGIN
  WITH RECURSIVE tree AS (
    SELECT
      p_structure->'root' AS node,
      (p_structure->'root'->>'is_download_unit')::boolean AS ancestor_download,
      (p_structure->'root'->>'is_version_anchor')::boolean AS ancestor_anchor,
      0 AS depth
    UNION ALL
    SELECT
      child.value AS node,
      CASE
        WHEN tree.ancestor_download AND (child.value->>'is_download_unit')::boolean IS TRUE THEN NULL
        WHEN (child.value->>'is_download_unit')::boolean IS TRUE THEN TRUE
        ELSE tree.ancestor_download
      END,
      CASE
        WHEN tree.ancestor_anchor AND (child.value->>'is_version_anchor')::boolean IS TRUE THEN NULL
        WHEN (child.value->>'is_version_anchor')::boolean IS TRUE THEN TRUE
        ELSE tree.ancestor_anchor
      END,
      tree.depth + 1
    FROM tree,
      jsonb_array_elements(tree.node->'children') AS child
    WHERE tree.node->'children' IS NOT NULL
      AND jsonb_array_length(tree.node->'children') > 0
      AND tree.ancestor_download IS NOT NULL
      AND tree.ancestor_anchor IS NOT NULL
  )
  SELECT NOT EXISTS (
    SELECT 1 FROM tree WHERE ancestor_download IS NULL OR ancestor_anchor IS NULL
  )
  INTO v_valid;

  RETURN v_valid;
END;
$$;

-- ============================================================================
-- publish_template (fork-always)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.publish_template(
  p_source_template_id UUID,
  p_structure          JSONB,
  p_name               TEXT,
  p_icon               TEXT DEFAULT NULL,
  p_shared             BOOLEAN DEFAULT FALSE,
  p_target_link_ids    UUID[] DEFAULT '{}',
  p_actions            JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_new_id  UUID := gen_random_uuid();
  v_source  RECORD;
BEGIN
  -- Validate structure depth
  IF NOT _validate_template_depth(p_structure, 5) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Structure exceeds maximum depth of 5');
  END IF;

  -- Validate single-per-lineage flags
  IF NOT _validate_single_per_lineage(p_structure) THEN
    RETURN jsonb_build_object('ok', false, 'reason',
      'is_download_unit or is_version_anchor appears more than once per lineage');
  END IF;

  -- If forking from an existing template, verify it exists and is usable
  IF p_source_template_id IS NOT NULL THEN
    SELECT id, active, locked_for_backward_compat
    INTO v_source
    FROM template
    WHERE id = p_source_template_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'Source template not found');
    END IF;

    IF NOT v_source.active THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'Source template is inactive');
    END IF;

    -- Verify target links belong to caller's projects and are linked to source
    IF array_length(p_target_link_ids, 1) IS NOT NULL THEN
      IF EXISTS (
        SELECT 1 FROM unnest(p_target_link_ids) AS lid
        WHERE NOT EXISTS (
          SELECT 1 FROM project_template_link ptl
          JOIN profile_project_link ppl ON ppl.project_id = ptl.project_id
          WHERE ptl.id = lid
            AND ptl.template_id = p_source_template_id
            AND ppl.profile_id = v_user_id
            AND ppl.membership = 'owner'
            AND ppl.active = true
        )
      ) THEN
        RETURN jsonb_build_object('ok', false, 'reason',
          'Target link IDs include projects you do not own or links not on the source template');
      END IF;
    END IF;
  END IF;

  -- Insert the new template (always a new row)
  INSERT INTO template (
    id, name, icon, structure,
    copied_from_template_id, creator_id,
    shared, active, locked_for_backward_compat, auto_sync
  ) VALUES (
    v_new_id, p_name, p_icon, p_structure,
    p_source_template_id, v_user_id,
    p_shared, true, false, false
  );

  -- Re-point selected project_template_link rows to the new template
  IF array_length(p_target_link_ids, 1) IS NOT NULL THEN
    UPDATE project_template_link
    SET template_id = v_new_id
    WHERE id = ANY(p_target_link_ids);
  END IF;

  -- Record revision for audit
  INSERT INTO template_revision (template_id, structure, actions, saved_by)
  VALUES (v_new_id, p_structure, p_actions, v_user_id);

  RETURN jsonb_build_object('ok', true, 'template_id', v_new_id);
END;
$$;

-- ============================================================================
-- fork_template
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fork_template(p_source_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_new_id UUID;
  v_source RECORD;
BEGIN
  SELECT * INTO v_source
  FROM template
  WHERE id = p_source_id AND active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Source template not found');
  END IF;

  v_new_id := gen_random_uuid();

  INSERT INTO template (
    id, name, icon, structure,
    source_language_id, copied_from_template_id,
    auto_sync, shared, active, creator_id
  ) VALUES (
    v_new_id,
    v_source.name || ' (copy)',
    v_source.icon,
    v_source.structure,
    v_source.source_language_id,
    p_source_id,
    false,
    false,
    true,
    v_user_id
  );

  INSERT INTO template_revision (template_id, structure, saved_by)
  VALUES (v_new_id, v_source.structure, v_user_id);

  RETURN jsonb_build_object('ok', true, 'template_id', v_new_id);
END;
$$;

-- ============================================================================
-- save_template_metadata (non-structural: name, icon, shared)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.save_template_metadata(
  p_template_id UUID,
  p_name        TEXT DEFAULT NULL,
  p_icon        TEXT DEFAULT NULL,
  p_shared      BOOLEAN DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_tmpl RECORD;
BEGIN
  SELECT id, creator_id, locked_for_backward_compat
  INTO v_tmpl
  FROM template
  WHERE id = p_template_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Template not found');
  END IF;

  IF v_tmpl.locked_for_backward_compat THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Template is frozen');
  END IF;

  IF v_tmpl.creator_id != v_user_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Only the creator can update metadata');
  END IF;

  UPDATE template
  SET
    name = COALESCE(p_name, name),
    icon = COALESCE(p_icon, icon),
    shared = COALESCE(p_shared, shared),
    last_updated = NOW()
  WHERE id = p_template_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.publish_template(UUID, JSONB, TEXT, TEXT, BOOLEAN, UUID[], JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fork_template(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_template_metadata(UUID, TEXT, TEXT, BOOLEAN) TO authenticated;
