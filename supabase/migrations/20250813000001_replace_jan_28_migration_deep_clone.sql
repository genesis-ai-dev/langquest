CREATE OR REPLACE FUNCTION public.deep_clone_project(
  source_project_id uuid,
  new_project_name text,
  new_project_description text DEFAULT NULL,
  source_language_id uuid DEFAULT NULL,
  target_language_id uuid DEFAULT NULL,
  owner_user_id uuid DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
-- body unchanged…
DECLARE
  new_project_id uuid;
  source_project_rec record;
  quest_rec record;
  new_quest_id uuid;
  asset_link_rec record;
  new_asset_id uuid;
  content_rec record;
  result json;
BEGIN
  SELECT * INTO source_project_rec FROM public.project WHERE id = source_project_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Source project % not found', source_project_id; END IF;

  INSERT INTO public.project (name, description, source_language_id, target_language_id, active)
  VALUES (
    new_project_name,
    COALESCE(new_project_description, source_project_rec.description),
    COALESCE(source_language_id, source_project_rec.source_language_id),
    COALESCE(target_language_id, source_project_rec.target_language_id),
    TRUE
  )
  RETURNING id INTO new_project_id;

  IF owner_user_id IS NOT NULL THEN
    INSERT INTO public.profile_project_link (profile_id, project_id, membership, active)
    VALUES (owner_user_id, new_project_id, 'owner', TRUE);
  END IF;

  FOR quest_rec IN
    SELECT * FROM public.quest
    WHERE project_id = source_project_id AND (active IS NULL OR active = TRUE)
    ORDER BY created_at
  LOOP
    INSERT INTO public.quest (name, description, project_id, active)
    VALUES (quest_rec.name, quest_rec.description, new_project_id, quest_rec.active)
    RETURNING id INTO new_quest_id;

    FOR asset_link_rec IN
      SELECT qal.*, a.*
      FROM public.quest_asset_link qal
      JOIN public.asset a ON a.id = qal.asset_id
      WHERE qal.quest_id = quest_rec.id AND qal.active = TRUE AND a.active = TRUE
    LOOP
      INSERT INTO public.asset (name, source_language_id, images, active)
      VALUES (asset_link_rec.name, asset_link_rec.source_language_id, asset_link_rec.images, asset_link_rec.active)
      RETURNING id INTO new_asset_id;

      FOR content_rec IN
        SELECT * FROM public.asset_content_link
        WHERE asset_id = asset_link_rec.asset_id AND active = TRUE
      LOOP
        INSERT INTO public.asset_content_link (id, asset_id, text, audio_id, active)
        VALUES (gen_random_uuid(), new_asset_id, content_rec.text, content_rec.audio_id, content_rec.active);
      END LOOP;

      INSERT INTO public.quest_asset_link (quest_id, asset_id, active)
      VALUES (new_quest_id, new_asset_id, asset_link_rec.active);
    END LOOP;
  END LOOP;

  result := json_build_object('success', TRUE, 'projectId', new_project_id, 'message', 'Project cloned successfully with deep duplication');
  RETURN result;
END;
$$;

-- tighten privileges
REVOKE ALL ON FUNCTION public.deep_clone_project(
  uuid, text, text, uuid, uuid, uuid
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.deep_clone_project(
  uuid, text, text, uuid, uuid, uuid
) TO authenticated;
