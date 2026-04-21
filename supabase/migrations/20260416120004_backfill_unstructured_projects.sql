-- ============================================================================
-- Backfill unstructured projects with auto-generated blueprints
-- ============================================================================
-- For each active unstructured project, walks the quest tree and generates
-- a blueprint JSONB structure mirroring the existing quest hierarchy.
-- Node IDs are random 10-char strings (nanoid-style, per C10).
-- These blueprints are locked_for_backward_compat since the underlying
-- projects use FK-based tree navigation (quest.parent_id).
-- ============================================================================

-- Helper: generate a random 10-char alphanumeric ID (nanoid-style)
CREATE OR REPLACE FUNCTION _generate_node_id()
RETURNS TEXT
LANGUAGE sql
VOLATILE
AS $$
  SELECT string_agg(
    substr('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', (random() * 61)::int + 1, 1),
    ''
  )
  FROM generate_series(1, 10);
$$;

-- Main backfill: process each unstructured project
DO $$
DECLARE
  v_project RECORD;
  v_quest RECORD;
  v_blueprint_id UUID;
  v_pbl_id UUID;
  v_structure JSONB;
  v_quest_nodes JSONB;
  v_child_nodes JSONB;
  v_node_id TEXT;
  v_node_ids JSONB := '{}'::jsonb;
BEGIN
  -- Process each active unstructured project
  FOR v_project IN
    SELECT p.id, p.name
    FROM public.project p
    WHERE p.template = 'unstructured'
      AND p.active = true
  LOOP
    -- Generate a blueprint ID
    v_blueprint_id := gen_random_uuid();
    v_node_ids := '{}'::jsonb;

    -- First pass: assign node IDs to all quests in this project
    FOR v_quest IN
      SELECT q.id, q.name, q.parent_id
      FROM public.quest q
      WHERE q.project_id = v_project.id
        AND q.active = true
      ORDER BY q.created_at
    LOOP
      v_node_id := _generate_node_id();
      v_node_ids := v_node_ids || jsonb_build_object(v_quest.id::text, v_node_id);
    END LOOP;

    -- Build the tree structure recursively
    -- Start with root children (quests with no parent)
    SELECT COALESCE(jsonb_agg(node ORDER BY q.created_at), '[]'::jsonb)
    INTO v_quest_nodes
    FROM (
      SELECT q.id, q.name, q.created_at,
        jsonb_build_object(
          'id', v_node_ids->>q.id::text,
          'name', COALESCE(q.name, 'Untitled'),
          'node_type', 'quest',
          'linkable_type', 'quest',
          'children', (
            SELECT COALESCE(jsonb_agg(
              jsonb_build_object(
                'id', v_node_ids->>child.id::text,
                'name', COALESCE(child.name, 'Untitled'),
                'node_type', 'quest',
                'linkable_type', 'quest',
                'children', (
                  SELECT COALESCE(jsonb_agg(
                    jsonb_build_object(
                      'id', v_node_ids->>grandchild.id::text,
                      'name', COALESCE(grandchild.name, 'Untitled'),
                      'node_type', 'quest',
                      'linkable_type', 'quest'
                    ) ORDER BY grandchild.created_at
                  ), '[]'::jsonb)
                  FROM public.quest grandchild
                  WHERE grandchild.parent_id = child.id
                    AND grandchild.active = true
                )
              ) ORDER BY child.created_at
            ), '[]'::jsonb)
            FROM public.quest child
            WHERE child.parent_id = q.id
              AND child.active = true
          )
        ) AS node
      FROM public.quest q
      WHERE q.project_id = v_project.id
        AND q.parent_id IS NULL
        AND q.active = true
    ) sub
    JOIN public.quest q ON q.id = sub.id;

    -- Build the full structure
    v_structure := jsonb_build_object(
      'format_version', 1,
      'root', jsonb_build_object(
        'id', 'root',
        'name', COALESCE(v_project.name, 'Project'),
        'node_type', 'root',
        'children', v_quest_nodes
      )
    );

    -- Insert the blueprint
    INSERT INTO public.template_blueprint (
      id, name, icon, structure, structure_version,
      auto_sync, shared, active, locked_for_backward_compat,
      download_profiles
    ) VALUES (
      v_blueprint_id,
      v_project.name || ' (auto-generated)',
      'folder',
      v_structure,
      1,
      false,
      false,
      true,
      true,
      '{}'
    );

    -- Create project_blueprint_link
    v_pbl_id := gen_random_uuid();
    INSERT INTO public.project_blueprint_link (
      id, project_id, blueprint_id, role, active, download_profiles
    ) VALUES (
      v_pbl_id, v_project.id, v_blueprint_id, 'primary', true, '{}'
    );

    -- Set blueprint_link_id and blueprint_node_id on all quests
    UPDATE public.quest q
    SET blueprint_link_id = v_pbl_id,
        blueprint_node_id = v_node_ids->>q.id::text
    WHERE q.project_id = v_project.id
      AND q.active = true
      AND q.blueprint_node_id IS NULL;

    -- Set blueprint_link_id on all assets for this project
    UPDATE public.asset a
    SET blueprint_link_id = v_pbl_id
    WHERE a.project_id = v_project.id
      AND a.active = true
      AND a.blueprint_link_id IS NULL;

  END LOOP;
END;
$$;

-- Clean up helper function
DROP FUNCTION IF EXISTS _generate_node_id();
