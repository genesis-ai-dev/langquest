-- Migration: Add download_profiles support to profile_project_link
-- Purpose:
-- - Add download_profiles column to profile_project_link table
-- - Create trigger to copy download_profiles from project when new profile_project_link is inserted
-- - Update download closure functions to include profile_project_link updates
-- - This ensures profile_project_link records are synced during download process, similar to votes

-- Add download_profiles column to profile_project_link
ALTER TABLE public.profile_project_link 
ADD COLUMN IF NOT EXISTS download_profiles uuid[] DEFAULT NULL;

-- Create GIN index for efficient querying
CREATE INDEX IF NOT EXISTS idx_profile_project_link_download_profiles 
ON public.profile_project_link USING GIN (download_profiles);

-- Function to copy download_profiles from project to profile_project_link
CREATE OR REPLACE FUNCTION copy_project_download_profiles_to_profile_project_link() 
RETURNS TRIGGER AS $$
BEGIN
    -- Copy download_profiles from the linked project to the new profile_project_link
    -- profile_project_link -> project (direct relationship via project_id)
    SELECT p.download_profiles 
    INTO NEW.download_profiles
    FROM public.project p
    WHERE p.id = NEW.project_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_copy_project_download_profiles_to_profile_project_link 
ON public.profile_project_link;

-- Create trigger that fires on INSERT to profile_project_link table
CREATE TRIGGER trigger_copy_project_download_profiles_to_profile_project_link 
BEFORE INSERT ON public.profile_project_link 
FOR EACH ROW
EXECUTE FUNCTION copy_project_download_profiles_to_profile_project_link();

-- Function to propagate new member's profile_id to project and all existing profile_project_link records
-- This ensures when a new member joins, their profile_id is added to download_profiles
-- so they can be synced and other members can see their profile
-- Also handles UPDATE when someone accepts an invite (active changes from false to true)
CREATE OR REPLACE FUNCTION propagate_new_member_download_profiles() 
RETURNS TRIGGER AS $$
DECLARE
    new_member_id uuid;
    project_id_val uuid;
    should_propagate boolean := false;
BEGIN
    -- Determine if we should propagate based on trigger operation
    IF TG_OP = 'INSERT' THEN
        -- On INSERT: propagate if membership is active
        should_propagate := (NEW.membership IS NOT NULL AND NEW.active = true);
    ELSIF TG_OP = 'UPDATE' THEN
        -- On UPDATE: propagate if membership became active (was inactive, now active)
        -- This handles cases where someone accepts an invite and active gets set to true
        should_propagate := (
            NEW.membership IS NOT NULL 
            AND NEW.active = true
            AND (
                OLD.active = false
                OR (OLD.membership IS NOT NULL AND OLD.active = false)
            )
        );
    END IF;
    
    -- Only process if this is an active membership that should be propagated
    IF should_propagate THEN
        new_member_id := NEW.profile_id;
        project_id_val := NEW.project_id;
        
        -- Add new member's profile_id to the project's download_profiles
        UPDATE public.project 
        SET download_profiles = CASE 
            WHEN download_profiles @> ARRAY[new_member_id] THEN download_profiles
            ELSE array_append(COALESCE(download_profiles, '{}'), new_member_id)
        END
        WHERE id = project_id_val;
        
        -- Add new member's profile_id to all existing profile_project_link records for this project
        -- This ensures other members can see the new member's profile
        UPDATE public.profile_project_link 
        SET download_profiles = CASE 
            WHEN download_profiles @> ARRAY[new_member_id] THEN download_profiles
            ELSE array_append(COALESCE(download_profiles, '{}'), new_member_id)
        END
        WHERE project_id = project_id_val
          AND profile_id != new_member_id  -- Don't update the record we just inserted/updated
          AND membership IS NOT NULL
          AND active = true;
        
        -- Also update the new/updated record itself to include its own profile_id
        -- (in case the project had no download_profiles initially)
        UPDATE public.profile_project_link 
        SET download_profiles = CASE 
            WHEN download_profiles @> ARRAY[new_member_id] THEN download_profiles
            ELSE array_append(COALESCE(download_profiles, '{}'), new_member_id)
        END
        WHERE profile_id = new_member_id AND project_id = project_id_val;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to remove member's profile_id from download_profiles when they leave
-- This fires on DELETE or when membership becomes inactive/null
CREATE OR REPLACE FUNCTION remove_member_download_profiles() 
RETURNS TRIGGER AS $$
DECLARE
    leaving_member_id uuid;
    project_id_val uuid;
BEGIN
    -- Determine which record we're working with (OLD for DELETE/UPDATE, NEW for UPDATE)
    IF TG_OP = 'DELETE' THEN
        leaving_member_id := OLD.profile_id;
        project_id_val := OLD.project_id;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Only remove if membership became inactive or null
        IF (OLD.membership IS NOT NULL AND OLD.active = true) 
           AND (NEW.membership IS NULL OR NEW.active = false) THEN
            leaving_member_id := OLD.profile_id;
            project_id_val := OLD.project_id;
        ELSE
            -- No change in membership status, nothing to do
            RETURN NEW;
        END IF;
    ELSE
        RETURN COALESCE(NEW, OLD);
    END IF;
    
    -- Remove leaving member's profile_id from the project's download_profiles
    UPDATE public.project 
    SET download_profiles = array_remove(COALESCE(download_profiles, '{}'), leaving_member_id)
    WHERE id = project_id_val;
    
    -- Remove leaving member's profile_id from all profile_project_link records for this project
    UPDATE public.profile_project_link 
    SET download_profiles = array_remove(COALESCE(download_profiles, '{}'), leaving_member_id)
    WHERE project_id = project_id_val
      AND download_profiles @> ARRAY[leaving_member_id];
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger that fires AFTER INSERT OR UPDATE to propagate new member's profile_id
-- UPDATE is needed for cases where someone accepts an invite and active/membership gets set
CREATE TRIGGER trigger_propagate_new_member_download_profiles 
AFTER INSERT OR UPDATE ON public.profile_project_link 
FOR EACH ROW
EXECUTE FUNCTION propagate_new_member_download_profiles();

-- Create trigger that fires AFTER DELETE or UPDATE to remove member's profile_id
CREATE TRIGGER trigger_remove_member_download_profiles 
AFTER DELETE OR UPDATE ON public.profile_project_link 
FOR EACH ROW
EXECUTE FUNCTION remove_member_download_profiles();

-- Backfill existing profile_project_link records with download_profiles from their projects
UPDATE public.profile_project_link ppl
SET download_profiles = p.download_profiles
FROM public.project p
WHERE ppl.project_id = p.id
  AND (ppl.download_profiles IS NULL OR ppl.download_profiles != p.download_profiles);

-- Update download_quest_closure function to include profile_project_link
CREATE OR REPLACE FUNCTION public.download_quest_closure(quest_id_param uuid, profile_id_param uuid)
 RETURNS TABLE(table_name text, records_updated integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    closure_record quest_closure%ROWTYPE;
    projects_updated INTEGER := 0;
    assets_updated INTEGER := 0;
    translations_updated INTEGER := 0;
    votes_updated INTEGER := 0;
    tags_updated INTEGER := 0;
    languages_updated INTEGER := 0;
    quest_asset_links_updated INTEGER := 0;
    asset_content_links_updated INTEGER := 0;
    quest_tag_links_updated INTEGER := 0;
    asset_tag_links_updated INTEGER := 0;
    quests_updated INTEGER := 0;
    quest_closures_updated INTEGER := 0;
    project_closures_updated INTEGER := 0;
    sibling_quest_closures_updated INTEGER := 0;
    profile_project_links_updated INTEGER := 0;
    project_language_links_updated INTEGER := 0;
BEGIN
    -- Logging
    RAISE NOTICE '[download_quest_closure] Starting for quest_id: %, profile_id: %', quest_id_param, profile_id_param;

    -- Get the complete closure record
    SELECT * INTO closure_record 
    FROM quest_closure 
    WHERE quest_id = quest_id_param;
    
    IF closure_record.quest_id IS NULL THEN
        RAISE EXCEPTION 'Quest closure not found for quest_id: %', quest_id_param;
    END IF;
    
    -- Update project (parent of the quest)
    UPDATE project 
    SET download_profiles = CASE 
        WHEN download_profiles @> ARRAY[profile_id_param] THEN download_profiles
        ELSE array_append(COALESCE(download_profiles, '{}'), profile_id_param)
    END
    WHERE id = closure_record.project_id;
    GET DIAGNOSTICS projects_updated = ROW_COUNT;
    RAISE NOTICE '[download_quest_closure] Updated project: % rows', projects_updated;
    
    -- Update profile_project_link for the project
    UPDATE profile_project_link 
    SET download_profiles = CASE 
        WHEN download_profiles @> ARRAY[profile_id_param] THEN download_profiles
        ELSE array_append(COALESCE(download_profiles, '{}'), profile_id_param)
    END
    WHERE project_id = closure_record.project_id
      AND membership IS NOT NULL
      AND active = true;
    GET DIAGNOSTICS profile_project_links_updated = ROW_COUNT;
    RAISE NOTICE '[download_quest_closure] Updated profile_project_link: % rows', profile_project_links_updated;
    
    -- Update assets
    UPDATE asset 
    SET download_profiles = CASE 
        WHEN download_profiles @> ARRAY[profile_id_param] THEN download_profiles
        ELSE array_append(COALESCE(download_profiles, '{}'), profile_id_param)
    END
    WHERE id = ANY(ARRAY(SELECT (jsonb_array_elements_text(closure_record.asset_ids))::UUID));
    GET DIAGNOSTICS assets_updated = ROW_COUNT;
    RAISE NOTICE '[download_quest_closure] Updated assets: % rows', assets_updated;
    
    -- Update translations
    UPDATE translation 
    SET download_profiles = CASE 
        WHEN download_profiles @> ARRAY[profile_id_param] THEN download_profiles
        ELSE array_append(COALESCE(download_profiles, '{}'), profile_id_param)
    END
    WHERE id = ANY(ARRAY(SELECT (jsonb_array_elements_text(closure_record.translation_ids))::UUID));
    GET DIAGNOSTICS translations_updated = ROW_COUNT;
    RAISE NOTICE '[download_quest_closure] Updated translations: % rows', translations_updated;
    
    -- Update votes
    UPDATE vote 
    SET download_profiles = CASE 
        WHEN download_profiles @> ARRAY[profile_id_param] THEN download_profiles
        ELSE array_append(COALESCE(download_profiles, '{}'), profile_id_param)
    END
    WHERE id = ANY(ARRAY(SELECT (jsonb_array_elements_text(closure_record.vote_ids))::UUID));
    GET DIAGNOSTICS votes_updated = ROW_COUNT;
    RAISE NOTICE '[download_quest_closure] Updated votes: % rows', votes_updated;
    
    -- Update tags
    UPDATE tag 
    SET download_profiles = CASE 
        WHEN download_profiles @> ARRAY[profile_id_param] THEN download_profiles
        ELSE array_append(COALESCE(download_profiles, '{}'), profile_id_param)
    END
    WHERE id = ANY(ARRAY(SELECT (jsonb_array_elements_text(closure_record.tag_ids))::UUID));
    GET DIAGNOSTICS tags_updated = ROW_COUNT;
    RAISE NOTICE '[download_quest_closure] Updated tags: % rows', tags_updated;
    
    -- Update languages
    UPDATE language 
    SET download_profiles = CASE 
        WHEN download_profiles @> ARRAY[profile_id_param] THEN download_profiles
        ELSE array_append(COALESCE(download_profiles, '{}'), profile_id_param)
    END
    WHERE id = ANY(ARRAY(SELECT (jsonb_array_elements_text(closure_record.language_ids))::UUID));
    GET DIAGNOSTICS languages_updated = ROW_COUNT;
    RAISE NOTICE '[download_quest_closure] Updated languages: % rows', languages_updated;

    -- Update project_language_link for the project being downloaded
    UPDATE project_language_link 
    SET download_profiles = CASE 
        WHEN download_profiles @> ARRAY[profile_id_param] THEN download_profiles
        ELSE array_append(COALESCE(download_profiles, '{}'), profile_id_param)
    END
    WHERE project_id = closure_record.project_id
      AND active = true;
    GET DIAGNOSTICS project_language_links_updated = ROW_COUNT;
    RAISE NOTICE '[download_quest_closure] Updated project_language_link: % rows', project_language_links_updated;
    
    -- Update quest_asset_link (using composite key quest_id + asset_id)
    UPDATE quest_asset_link 
    SET download_profiles = CASE 
        WHEN download_profiles @> ARRAY[profile_id_param] THEN download_profiles
        ELSE array_append(COALESCE(download_profiles, '{}'), profile_id_param)
    END
    WHERE (quest_id || '-' || asset_id) = ANY(ARRAY(SELECT jsonb_array_elements_text(closure_record.quest_asset_link_ids)));
    GET DIAGNOSTICS quest_asset_links_updated = ROW_COUNT;
    RAISE NOTICE '[download_quest_closure] Updated quest_asset_links: % rows', quest_asset_links_updated;
    
    -- Update asset_content_link
    UPDATE asset_content_link 
    SET download_profiles = CASE 
        WHEN download_profiles @> ARRAY[profile_id_param] THEN download_profiles
        ELSE array_append(COALESCE(download_profiles, '{}'), profile_id_param)
    END
    WHERE id = ANY(ARRAY(SELECT (jsonb_array_elements_text(closure_record.asset_content_link_ids))::UUID));
    GET DIAGNOSTICS asset_content_links_updated = ROW_COUNT;
    RAISE NOTICE '[download_quest_closure] Updated asset_content_links: % rows', asset_content_links_updated;
    
    -- Update quest_tag_link (these use composite keys stored as strings)
    UPDATE quest_tag_link 
    SET download_profiles = CASE 
        WHEN download_profiles @> ARRAY[profile_id_param] THEN download_profiles
        ELSE array_append(COALESCE(download_profiles, '{}'), profile_id_param)
    END
    WHERE (quest_id || '-' || tag_id) = ANY(ARRAY(SELECT jsonb_array_elements_text(closure_record.quest_tag_link_ids)));
    GET DIAGNOSTICS quest_tag_links_updated = ROW_COUNT;
    RAISE NOTICE '[download_quest_closure] Updated quest_tag_links: % rows', quest_tag_links_updated;
    
    -- Update asset_tag_link (these use composite keys stored as strings)
    UPDATE asset_tag_link 
    SET download_profiles = CASE 
        WHEN download_profiles @> ARRAY[profile_id_param] THEN download_profiles
        ELSE array_append(COALESCE(download_profiles, '{}'), profile_id_param)
    END
    WHERE (asset_id || '-' || tag_id) = ANY(ARRAY(SELECT jsonb_array_elements_text(closure_record.asset_tag_link_ids)));
    GET DIAGNOSTICS asset_tag_links_updated = ROW_COUNT;
    RAISE NOTICE '[download_quest_closure] Updated asset_tag_links: % rows', asset_tag_links_updated;
    
    -- Update the project closure record itself to include this profile
    UPDATE project_closure 
    SET download_profiles = CASE 
        WHEN download_profiles @> ARRAY[profile_id_param] THEN download_profiles
        ELSE array_append(COALESCE(download_profiles, '{}'), profile_id_param)
    END
    WHERE project_id = closure_record.project_id;
    GET DIAGNOSTICS project_closures_updated = ROW_COUNT;
    RAISE NOTICE '[download_quest_closure] Updated project_closure: % rows', project_closures_updated;

    -- NEW: Also update all quest_closure records for quests in this project
    UPDATE quest_closure 
    SET download_profiles = CASE 
        WHEN download_profiles @> ARRAY[profile_id_param] THEN download_profiles
        ELSE array_append(COALESCE(download_profiles, '{}'), profile_id_param)
    END
    WHERE project_id = closure_record.project_id;
    GET DIAGNOSTICS quest_closures_updated = ROW_COUNT;
    RAISE NOTICE '[download_quest_closure] Updated quest_closures: % rows', quest_closures_updated;

    -- Logging
    RAISE NOTICE '[download_quest_closure] Completed for quest_id: %, profile_id: %', quest_id_param, profile_id_param;

    -- Return summary of what was updated
    RETURN QUERY
    SELECT 'project'::TEXT, projects_updated
    UNION ALL
    SELECT 'profile_project_link'::TEXT, profile_project_links_updated
    UNION ALL
    SELECT 'quest'::TEXT, quests_updated
    UNION ALL
    SELECT 'asset'::TEXT, assets_updated
    UNION ALL
    SELECT 'translation'::TEXT, translations_updated
    UNION ALL
    SELECT 'vote'::TEXT, votes_updated
    UNION ALL
    SELECT 'tag'::TEXT, tags_updated
    UNION ALL
    SELECT 'language'::TEXT, languages_updated
    UNION ALL
    SELECT 'project_language_link'::TEXT, project_language_links_updated
    UNION ALL
    SELECT 'quest_asset_link'::TEXT, quest_asset_links_updated
    UNION ALL
    SELECT 'asset_content_link'::TEXT, asset_content_links_updated
    UNION ALL
    SELECT 'quest_tag_link'::TEXT, quest_tag_links_updated
    UNION ALL
    SELECT 'asset_tag_link'::TEXT, asset_tag_links_updated
    UNION ALL
    SELECT 'quest_closure'::TEXT, quest_closures_updated
    UNION ALL
    SELECT 'project_closure'::TEXT, project_closures_updated;
END;
$function$;

-- Update download_project_closure function to include profile_project_link
CREATE OR REPLACE FUNCTION public.download_project_closure(project_id_param uuid, profile_id_param uuid)
 RETURNS TABLE(table_name text, records_updated integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    closure_record project_closure%ROWTYPE;
    projects_updated INTEGER := 0;
    quests_updated INTEGER := 0;
    assets_updated INTEGER := 0;
    translations_updated INTEGER := 0;
    votes_updated INTEGER := 0;
    tags_updated INTEGER := 0;
    languages_updated INTEGER := 0;
    quest_asset_links_updated INTEGER := 0;
    asset_content_links_updated INTEGER := 0;
    quest_tag_links_updated INTEGER := 0;
    asset_tag_links_updated INTEGER := 0;
    project_closures_updated INTEGER := 0;
    quest_closures_updated INTEGER := 0;
    profile_project_links_updated INTEGER := 0;
BEGIN
    -- Logging
    RAISE NOTICE '[download_project_closure] Starting for project_id: %, profile_id: %', project_id_param, profile_id_param;

    -- Get the complete closure record
    SELECT * INTO closure_record 
    FROM project_closure 
    WHERE project_id = project_id_param;
    
    IF closure_record.project_id IS NULL THEN
        RAISE EXCEPTION 'Project closure not found for project_id: %', project_id_param;
    END IF;
    
    -- Update project itself
    UPDATE project 
    SET download_profiles = CASE 
        WHEN download_profiles @> ARRAY[profile_id_param] THEN download_profiles
        ELSE array_append(COALESCE(download_profiles, '{}'), profile_id_param)
    END
    WHERE id = project_id_param;
    GET DIAGNOSTICS projects_updated = ROW_COUNT;
    RAISE NOTICE '[download_project_closure] Updated project: % rows', projects_updated;
    
    -- Update profile_project_link for the project
    UPDATE profile_project_link 
    SET download_profiles = CASE 
        WHEN download_profiles @> ARRAY[profile_id_param] THEN download_profiles
        ELSE array_append(COALESCE(download_profiles, '{}'), profile_id_param)
    END
    WHERE project_id = project_id_param
      AND membership IS NOT NULL
      AND active = true;
    GET DIAGNOSTICS profile_project_links_updated = ROW_COUNT;
    RAISE NOTICE '[download_project_closure] Updated profile_project_link: % rows', profile_project_links_updated;
    
    -- Update all quests
    UPDATE quest 
    SET download_profiles = CASE 
        WHEN download_profiles @> ARRAY[profile_id_param] THEN download_profiles
        ELSE array_append(COALESCE(download_profiles, '{}'), profile_id_param)
    END
    WHERE id = ANY(ARRAY(SELECT (jsonb_array_elements_text(closure_record.quest_ids))::UUID));
    GET DIAGNOSTICS quests_updated = ROW_COUNT;
    RAISE NOTICE '[download_project_closure] Updated quests: % rows', quests_updated;
    
    -- Update assets
    UPDATE asset 
    SET download_profiles = CASE 
        WHEN download_profiles @> ARRAY[profile_id_param] THEN download_profiles
        ELSE array_append(COALESCE(download_profiles, '{}'), profile_id_param)
    END
    WHERE id = ANY(ARRAY(SELECT (jsonb_array_elements_text(closure_record.asset_ids))::UUID));
    GET DIAGNOSTICS assets_updated = ROW_COUNT;
    RAISE NOTICE '[download_project_closure] Updated assets: % rows', assets_updated;
    
    -- Update translations
    UPDATE translation 
    SET download_profiles = CASE 
        WHEN download_profiles @> ARRAY[profile_id_param] THEN download_profiles
        ELSE array_append(COALESCE(download_profiles, '{}'), profile_id_param)
    END
    WHERE id = ANY(ARRAY(SELECT (jsonb_array_elements_text(closure_record.translation_ids))::UUID));
    GET DIAGNOSTICS translations_updated = ROW_COUNT;
    RAISE NOTICE '[download_project_closure] Updated translations: % rows', translations_updated;
    
    -- Update votes
    UPDATE vote 
    SET download_profiles = CASE 
        WHEN download_profiles @> ARRAY[profile_id_param] THEN download_profiles
        ELSE array_append(COALESCE(download_profiles, '{}'), profile_id_param)
    END
    WHERE id = ANY(ARRAY(SELECT (jsonb_array_elements_text(closure_record.vote_ids))::UUID));
    GET DIAGNOSTICS votes_updated = ROW_COUNT;
    RAISE NOTICE '[download_project_closure] Updated votes: % rows', votes_updated;
    
    -- Update tags
    UPDATE tag 
    SET download_profiles = CASE 
        WHEN download_profiles @> ARRAY[profile_id_param] THEN download_profiles
        ELSE array_append(COALESCE(download_profiles, '{}'), profile_id_param)
    END
    WHERE id = ANY(ARRAY(SELECT (jsonb_array_elements_text(closure_record.tag_ids))::UUID));
    GET DIAGNOSTICS tags_updated = ROW_COUNT;
    RAISE NOTICE '[download_project_closure] Updated tags: % rows', tags_updated;
    
    -- Update languages
    UPDATE language 
    SET download_profiles = CASE 
        WHEN download_profiles @> ARRAY[profile_id_param] THEN download_profiles
        ELSE array_append(COALESCE(download_profiles, '{}'), profile_id_param)
    END
    WHERE id = ANY(ARRAY(SELECT (jsonb_array_elements_text(closure_record.language_ids))::UUID));
    GET DIAGNOSTICS languages_updated = ROW_COUNT;
    RAISE NOTICE '[download_project_closure] Updated languages: % rows', languages_updated;
    
    -- Update quest_asset_link (these use composite keys stored as strings)
    UPDATE quest_asset_link 
    SET download_profiles = CASE 
        WHEN download_profiles @> ARRAY[profile_id_param] THEN download_profiles
        ELSE array_append(COALESCE(download_profiles, '{}'), profile_id_param)
    END
    WHERE (quest_id || '-' || asset_id) = ANY(ARRAY(SELECT jsonb_array_elements_text(closure_record.quest_asset_link_ids)));
    GET DIAGNOSTICS quest_asset_links_updated = ROW_COUNT;
    RAISE NOTICE '[download_project_closure] Updated quest_asset_links: % rows', quest_asset_links_updated;
    
    -- Update asset_content_link
    UPDATE asset_content_link 
    SET download_profiles = CASE 
        WHEN download_profiles @> ARRAY[profile_id_param] THEN download_profiles
        ELSE array_append(COALESCE(download_profiles, '{}'), profile_id_param)
    END
    WHERE id = ANY(ARRAY(SELECT (jsonb_array_elements_text(closure_record.asset_content_link_ids))::UUID));
    GET DIAGNOSTICS asset_content_links_updated = ROW_COUNT;
    RAISE NOTICE '[download_project_closure] Updated asset_content_links: % rows', asset_content_links_updated;
    
    -- Update quest_tag_link (these use composite keys stored as strings)
    UPDATE quest_tag_link 
    SET download_profiles = CASE 
        WHEN download_profiles @> ARRAY[profile_id_param] THEN download_profiles
        ELSE array_append(COALESCE(download_profiles, '{}'), profile_id_param)
    END
    WHERE (quest_id || '-' || tag_id) = ANY(ARRAY(SELECT jsonb_array_elements_text(closure_record.quest_tag_link_ids)));
    GET DIAGNOSTICS quest_tag_links_updated = ROW_COUNT;
    RAISE NOTICE '[download_project_closure] Updated quest_tag_links: % rows', quest_tag_links_updated;
    
    -- Update asset_tag_link (these use composite keys stored as strings)
    UPDATE asset_tag_link 
    SET download_profiles = CASE 
        WHEN download_profiles @> ARRAY[profile_id_param] THEN download_profiles
        ELSE array_append(COALESCE(download_profiles, '{}'), profile_id_param)
    END
    WHERE (asset_id || '-' || tag_id) = ANY(ARRAY(SELECT jsonb_array_elements_text(closure_record.asset_tag_link_ids)));
    GET DIAGNOSTICS asset_tag_links_updated = ROW_COUNT;
    RAISE NOTICE '[download_project_closure] Updated asset_tag_links: % rows', asset_tag_links_updated;
    
    -- Update the project closure record itself to include this profile
    UPDATE project_closure 
    SET download_profiles = CASE 
        WHEN download_profiles @> ARRAY[profile_id_param] THEN download_profiles
        ELSE array_append(COALESCE(download_profiles, '{}'), profile_id_param)
    END
    WHERE project_id = project_id_param;
    GET DIAGNOSTICS project_closures_updated = ROW_COUNT;
    RAISE NOTICE '[download_project_closure] Updated project_closure: % rows', project_closures_updated;

    -- NEW: Also update all quest_closure records for quests in this project
    UPDATE quest_closure 
    SET download_profiles = CASE 
        WHEN download_profiles @> ARRAY[profile_id_param] THEN download_profiles
        ELSE array_append(COALESCE(download_profiles, '{}'), profile_id_param)
    END
    WHERE project_id = project_id_param;
    GET DIAGNOSTICS quest_closures_updated = ROW_COUNT;
    RAISE NOTICE '[download_project_closure] Updated quest_closures: % rows', quest_closures_updated;

    -- Logging
    RAISE NOTICE '[download_project_closure] Completed for project_id: %, profile_id: %', project_id_param, profile_id_param;

    -- Return summary of what was updated
    RETURN QUERY
    SELECT 'project'::TEXT, projects_updated
    UNION ALL
    SELECT 'profile_project_link'::TEXT, profile_project_links_updated
    UNION ALL
    SELECT 'quest'::TEXT, quests_updated
    UNION ALL
    SELECT 'asset'::TEXT, assets_updated
    UNION ALL
    SELECT 'translation'::TEXT, translations_updated
    UNION ALL
    SELECT 'vote'::TEXT, votes_updated
    UNION ALL
    SELECT 'tag'::TEXT, tags_updated
    UNION ALL
    SELECT 'language'::TEXT, languages_updated
    UNION ALL
    SELECT 'quest_asset_link'::TEXT, quest_asset_links_updated
    UNION ALL
    SELECT 'asset_content_link'::TEXT, asset_content_links_updated
    UNION ALL
    SELECT 'quest_tag_link'::TEXT, quest_tag_links_updated
    UNION ALL
    SELECT 'asset_tag_link'::TEXT, asset_tag_links_updated
    UNION ALL
    SELECT 'project_closure'::TEXT, project_closures_updated
    UNION ALL
    SELECT 'quest_closure'::TEXT, quest_closures_updated;
END;
$function$;
