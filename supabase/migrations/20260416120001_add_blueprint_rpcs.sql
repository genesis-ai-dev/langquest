-- ============================================================================
-- Blueprint RPCs: lock management, publish, fork, create, metadata
-- ============================================================================

-- ============================================================================
-- Helper: validate blueprint structure depth <= 5
-- ============================================================================

CREATE OR REPLACE FUNCTION public._validate_blueprint_depth(p_structure JSONB, p_max_depth INTEGER DEFAULT 5)
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
-- acquire_blueprint_lock
-- ============================================================================

CREATE OR REPLACE FUNCTION public.acquire_blueprint_lock(p_blueprint_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bp RECORD;
  v_user_id UUID := auth.uid();
BEGIN
  SELECT id, locked_by, locked_at, locked_for_backward_compat, structure_version
  INTO v_bp
  FROM template_blueprint
  WHERE id = p_blueprint_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Blueprint not found');
  END IF;

  IF v_bp.locked_for_backward_compat THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Blueprint is frozen for backward compatibility');
  END IF;

  IF v_bp.locked_by IS NOT NULL
    AND v_bp.locked_by != v_user_id
    AND v_bp.locked_at > NOW() - INTERVAL '10 minutes'
  THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'Blueprint is locked by another user',
      'locked_by', v_bp.locked_by,
      'locked_at', v_bp.locked_at
    );
  END IF;

  UPDATE template_blueprint
  SET locked_by = v_user_id, locked_at = NOW()
  WHERE id = p_blueprint_id;

  RETURN jsonb_build_object(
    'ok', true,
    'structure_version', v_bp.structure_version
  );
END;
$$;

-- ============================================================================
-- heartbeat_blueprint_lock
-- ============================================================================

CREATE OR REPLACE FUNCTION public.heartbeat_blueprint_lock(p_blueprint_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_locked_by UUID;
  v_user_id UUID := auth.uid();
BEGIN
  SELECT locked_by INTO v_locked_by
  FROM template_blueprint
  WHERE id = p_blueprint_id
  FOR UPDATE;

  IF v_locked_by IS NULL OR v_locked_by != v_user_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Lock not held by caller');
  END IF;

  UPDATE template_blueprint
  SET locked_at = NOW()
  WHERE id = p_blueprint_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ============================================================================
-- release_blueprint_lock
-- ============================================================================

CREATE OR REPLACE FUNCTION public.release_blueprint_lock(p_blueprint_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_locked_by UUID;
  v_user_id UUID := auth.uid();
BEGIN
  SELECT locked_by INTO v_locked_by
  FROM template_blueprint
  WHERE id = p_blueprint_id
  FOR UPDATE;

  IF v_locked_by IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'Already unlocked');
  END IF;

  IF v_locked_by != v_user_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Lock held by another user');
  END IF;

  UPDATE template_blueprint
  SET locked_by = NULL, locked_at = NULL
  WHERE id = p_blueprint_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ============================================================================
-- force_release_stale_lock
-- ============================================================================

CREATE OR REPLACE FUNCTION public.force_release_stale_lock(p_blueprint_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bp RECORD;
  v_user_id UUID := auth.uid();
BEGIN
  SELECT locked_by, locked_at
  INTO v_bp
  FROM template_blueprint
  WHERE id = p_blueprint_id
  FOR UPDATE;

  IF v_bp.locked_by IS NULL THEN
    UPDATE template_blueprint
    SET locked_by = v_user_id, locked_at = NOW()
    WHERE id = p_blueprint_id;
    RETURN jsonb_build_object('ok', true, 'reason', 'Was unlocked; acquired');
  END IF;

  IF v_bp.locked_at > NOW() - INTERVAL '10 minutes' AND v_bp.locked_by != v_user_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Lock is not stale yet');
  END IF;

  UPDATE template_blueprint
  SET locked_by = v_user_id, locked_at = NOW()
  WHERE id = p_blueprint_id;

  RETURN jsonb_build_object('ok', true, 'reason', 'Stale lock taken over');
END;
$$;

-- ============================================================================
-- publish_blueprint
-- ============================================================================

CREATE OR REPLACE FUNCTION public.publish_blueprint(
  p_blueprint_id    UUID,
  p_base_version    INTEGER,
  p_new_structure   JSONB,
  p_target_link_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bp RECORD;
  v_user_id UUID := auth.uid();
  v_all_link_ids UUID[];
  v_needs_fork BOOLEAN;
  v_new_bp_id UUID;
  v_new_version INTEGER;
  v_link_id UUID;
BEGIN
  -- Lock and verify
  SELECT id, locked_by, locked_for_backward_compat, structure, structure_version
  INTO v_bp
  FROM template_blueprint
  WHERE id = p_blueprint_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Blueprint not found');
  END IF;

  IF v_bp.locked_for_backward_compat THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Blueprint is frozen');
  END IF;

  IF v_bp.locked_by IS DISTINCT FROM v_user_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Lock not held by caller');
  END IF;

  IF v_bp.structure_version != p_base_version THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'Version mismatch',
      'current_version', v_bp.structure_version
    );
  END IF;

  -- Validate structure
  IF NOT _validate_blueprint_depth(p_new_structure, 5) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Structure exceeds maximum depth of 5');
  END IF;

  IF NOT _validate_single_per_lineage(p_new_structure) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'is_download_unit or is_version_anchor appears more than once per lineage');
  END IF;

  -- Verify all target_link_ids belong to projects the caller owns
  IF EXISTS (
    SELECT 1 FROM unnest(p_target_link_ids) AS lid
    WHERE NOT EXISTS (
      SELECT 1 FROM project_blueprint_link pbl
      JOIN profile_project_link ppl ON ppl.project_id = pbl.project_id
      WHERE pbl.id = lid
        AND pbl.blueprint_id = p_blueprint_id
        AND ppl.profile_id = v_user_id
        AND ppl.membership = 'owner'
        AND ppl.active = true
    )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Target link IDs include projects you do not own');
  END IF;

  -- Determine if we need to fork
  SELECT ARRAY_AGG(pbl.id)
  INTO v_all_link_ids
  FROM project_blueprint_link pbl
  WHERE pbl.blueprint_id = p_blueprint_id AND pbl.active = true;

  v_needs_fork := v_all_link_ids IS NOT NULL
    AND array_length(p_target_link_ids, 1) IS DISTINCT FROM array_length(v_all_link_ids, 1)
    AND NOT (p_target_link_ids @> v_all_link_ids AND v_all_link_ids @> p_target_link_ids);

  IF v_needs_fork THEN
    -- Fork: create a new blueprint with the new structure
    v_new_bp_id := gen_random_uuid();
    v_new_version := 1;

    INSERT INTO template_blueprint (
      id, name, icon, structure, structure_version,
      source_language_id, copied_from_blueprint_id,
      auto_sync, shared, active, locked_for_backward_compat,
      creator_id, locked_by, locked_at
    )
    SELECT
      v_new_bp_id, name, icon, p_new_structure, v_new_version,
      source_language_id, p_blueprint_id,
      false, false, true, false,
      v_user_id, v_user_id, NOW()
    FROM template_blueprint WHERE id = p_blueprint_id;

    -- Re-point selected links to the new blueprint
    UPDATE project_blueprint_link
    SET blueprint_id = v_new_bp_id
    WHERE id = ANY(p_target_link_ids);

    -- Write revision for the fork
    INSERT INTO blueprint_revision (blueprint_id, structure_version, structure, saved_by)
    VALUES (v_new_bp_id, v_new_version, p_new_structure, v_user_id);

    RETURN jsonb_build_object(
      'ok', true,
      'forked', true,
      'new_blueprint_id', v_new_bp_id,
      'new_version', v_new_version
    );
  ELSE
    -- Edit in place
    v_new_version := v_bp.structure_version + 1;

    UPDATE template_blueprint
    SET structure = p_new_structure,
        structure_version = v_new_version,
        locked_at = NOW(),
        last_updated = NOW()
    WHERE id = p_blueprint_id;

    INSERT INTO blueprint_revision (blueprint_id, structure_version, structure, saved_by)
    VALUES (p_blueprint_id, v_new_version, p_new_structure, v_user_id);

    RETURN jsonb_build_object(
      'ok', true,
      'forked', false,
      'new_version', v_new_version
    );
  END IF;
END;
$$;

-- ============================================================================
-- create_blueprint
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_blueprint(
  p_structure          JSONB,
  p_name               TEXT,
  p_icon               TEXT DEFAULT NULL,
  p_source_language_id UUID DEFAULT NULL,
  p_shared             BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_bp_id UUID;
BEGIN
  IF NOT _validate_blueprint_depth(p_structure, 5) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Structure exceeds maximum depth of 5');
  END IF;

  v_bp_id := gen_random_uuid();

  INSERT INTO template_blueprint (
    id, name, icon, structure, structure_version,
    source_language_id, auto_sync, shared, active,
    creator_id
  ) VALUES (
    v_bp_id, p_name, p_icon, p_structure, 1,
    p_source_language_id, false, p_shared, true,
    v_user_id
  );

  INSERT INTO blueprint_revision (blueprint_id, structure_version, structure, saved_by)
  VALUES (v_bp_id, 1, p_structure, v_user_id);

  RETURN jsonb_build_object('ok', true, 'blueprint_id', v_bp_id);
END;
$$;

-- ============================================================================
-- fork_blueprint
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fork_blueprint(p_source_id UUID)
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
  FROM template_blueprint
  WHERE id = p_source_id AND active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Source blueprint not found');
  END IF;

  v_new_id := gen_random_uuid();

  INSERT INTO template_blueprint (
    id, name, icon, structure, structure_version,
    source_language_id, copied_from_blueprint_id,
    auto_sync, shared, active, creator_id
  ) VALUES (
    v_new_id,
    v_source.name || ' (copy)',
    v_source.icon,
    v_source.structure,
    1,
    v_source.source_language_id,
    p_source_id,
    false,
    false,
    true,
    v_user_id
  );

  INSERT INTO blueprint_revision (blueprint_id, structure_version, structure, saved_by)
  VALUES (v_new_id, 1, v_source.structure, v_user_id);

  RETURN jsonb_build_object('ok', true, 'blueprint_id', v_new_id);
END;
$$;

-- ============================================================================
-- save_blueprint_metadata (non-structural: name, icon, shared)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.save_blueprint_metadata(
  p_blueprint_id UUID,
  p_name         TEXT DEFAULT NULL,
  p_icon         TEXT DEFAULT NULL,
  p_shared       BOOLEAN DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_bp RECORD;
BEGIN
  SELECT id, creator_id, locked_for_backward_compat
  INTO v_bp
  FROM template_blueprint
  WHERE id = p_blueprint_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Blueprint not found');
  END IF;

  IF v_bp.locked_for_backward_compat THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Blueprint is frozen');
  END IF;

  IF v_bp.creator_id != v_user_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Only the creator can update metadata');
  END IF;

  UPDATE template_blueprint
  SET
    name = COALESCE(p_name, name),
    icon = COALESCE(p_icon, icon),
    shared = COALESCE(p_shared, shared),
    last_updated = NOW()
  WHERE id = p_blueprint_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Grant execute permissions on all RPCs
GRANT EXECUTE ON FUNCTION public.acquire_blueprint_lock(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.heartbeat_blueprint_lock(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_blueprint_lock(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.force_release_stale_lock(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_blueprint(UUID, INTEGER, JSONB, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_blueprint(JSONB, TEXT, TEXT, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fork_blueprint(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_blueprint_metadata(UUID, TEXT, TEXT, BOOLEAN) TO authenticated;
