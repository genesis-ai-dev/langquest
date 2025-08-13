-- Migration: Deep Clone Project Function
-- Following database best practices for atomic transactions
-- Based on expert recommendations for single-transaction approach

-- Simple deep clone function - everything in ONE atomic transaction
CREATE OR REPLACE FUNCTION deep_clone_project(
  source_project_id UUID,
  new_project_name TEXT,
  new_project_description TEXT DEFAULT NULL,
  source_language_id UUID DEFAULT NULL,
  target_language_id UUID DEFAULT NULL,
  owner_user_id UUID DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  new_project_id UUID;
  source_project_rec RECORD;
  quest_rec RECORD;
  new_quest_id UUID;
  asset_link_rec RECORD;
  new_asset_id UUID;
  content_rec RECORD;
  result JSON;
BEGIN
  -- Get source project
  SELECT * INTO source_project_rec
  FROM project
  WHERE id = source_project_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source project % not found', source_project_id;
  END IF;
  
  -- Step 1: Create new project (atomic)
  INSERT INTO project (
    name,
    description,
    source_language_id,
    target_language_id,
    active
  ) VALUES (
    new_project_name,
    COALESCE(new_project_description, source_project_rec.description),
    COALESCE(source_language_id, source_project_rec.source_language_id),
    COALESCE(target_language_id, source_project_rec.target_language_id),
    true
  ) RETURNING id INTO new_project_id;
  
  -- Step 2: Create ownership (atomic)
  IF owner_user_id IS NOT NULL THEN
    INSERT INTO profile_project_link (
      profile_id,
      project_id,
      membership,
      active
    ) VALUES (
      owner_user_id,
      new_project_id,
      'owner',
      true
    );
  END IF;
  
  -- Step 3: Clone all quests and their assets (atomic loop)
  FOR quest_rec IN 
    SELECT * FROM quest 
    WHERE project_id = source_project_id 
    AND (active IS NULL OR active = true)
    ORDER BY created_at
  LOOP
    -- Create new quest
    INSERT INTO quest (
      name,
      description,
      project_id,
      active
    ) VALUES (
      quest_rec.name,
      quest_rec.description,
      new_project_id,
      quest_rec.active
    ) RETURNING id INTO new_quest_id;
    
    -- Clone all assets linked to this quest
    FOR asset_link_rec IN
      SELECT qal.*, a.*
      FROM quest_asset_link qal
      JOIN asset a ON a.id = qal.asset_id
      WHERE qal.quest_id = quest_rec.id
      AND qal.active = true
      AND a.active = true
    LOOP
      -- Create new asset (deep clone)
      INSERT INTO asset (
        name,
        source_language_id,
        images,
        active
      ) VALUES (
        asset_link_rec.name,
        asset_link_rec.source_language_id,
        asset_link_rec.images,
        asset_link_rec.active
      ) RETURNING id INTO new_asset_id;
      
      -- Clone asset content (share audio files as requested)
      FOR content_rec IN
        SELECT * FROM asset_content_link
        WHERE asset_id = asset_link_rec.asset_id
        AND active = true
      LOOP
        INSERT INTO asset_content_link (
          id,
          asset_id,
          text,
          audio_id,  -- Share audio files (same audio_id)
          active
        ) VALUES (
          gen_random_uuid(),
          new_asset_id,
          content_rec.text,
          content_rec.audio_id,  -- Keep same audio_id for sharing
          content_rec.active
        );
      END LOOP;
      
      -- Link new asset to new quest
      INSERT INTO quest_asset_link (
        quest_id,
        asset_id,
        active
      ) VALUES (
        new_quest_id,
        new_asset_id,
        asset_link_rec.active
      );
    END LOOP;
  END LOOP;
  
  -- Return success result
  result := json_build_object(
    'success', true,
    'projectId', new_project_id,
    'message', 'Project cloned successfully with deep duplication'
  );
  
  RETURN result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Any error rolls back the entire transaction automatically
    -- Re-raise with context
    RAISE EXCEPTION 'Deep clone failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql
-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION deep_clone_project TO authenticated