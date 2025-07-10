-- Sync download profiles across project_closure and quest_closure tables
-- When downloading a quest, also add user to project, project_closure and all sibling quest_closure records
-- When downloading a project, also add user to all quest_closure records

-- Enhanced download_quest_closure function that also updates project, project_closure and sibling quest_closure records
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
    
    -- Update quest_asset_link (using composite key quest_id + asset_id)
    UPDATE quest_asset_link 
    SET download_profiles = CASE 
        WHEN download_profiles @> ARRAY[profile_id_param] THEN download_profiles
        ELSE array_append(COALESCE(download_profiles, '{}'), profile_id_param)
    END
    WHERE quest_id = quest_id_param 
    AND asset_id = ANY(ARRAY(SELECT (jsonb_array_elements_text(closure_record.asset_ids))::UUID));
    GET DIAGNOSTICS quest_asset_links_updated = ROW_COUNT;
    RAISE NOTICE '[download_quest_closure] Updated quest_asset_links: % rows', quest_asset_links_updated;
    
    -- Update asset_content_link (this has an id column)
    UPDATE asset_content_link 
    SET download_profiles = CASE 
        WHEN download_profiles @> ARRAY[profile_id_param] THEN download_profiles
        ELSE array_append(COALESCE(download_profiles, '{}'), profile_id_param)
    END
    WHERE id = ANY(ARRAY(SELECT (jsonb_array_elements_text(closure_record.asset_content_link_ids))::UUID));
    GET DIAGNOSTICS asset_content_links_updated = ROW_COUNT;
    RAISE NOTICE '[download_quest_closure] Updated asset_content_links: % rows', asset_content_links_updated;
    
    -- Update quest_tag_link (using composite key quest_id + tag_id)
    UPDATE quest_tag_link 
    SET download_profiles = CASE 
        WHEN download_profiles @> ARRAY[profile_id_param] THEN download_profiles
        ELSE array_append(COALESCE(download_profiles, '{}'), profile_id_param)
    END
    WHERE quest_id = quest_id_param
    AND tag_id = ANY(ARRAY(SELECT (jsonb_array_elements_text(closure_record.tag_ids))::UUID));
    GET DIAGNOSTICS quest_tag_links_updated = ROW_COUNT;
    RAISE NOTICE '[download_quest_closure] Updated quest_tag_links: % rows', quest_tag_links_updated;
    
    -- Update asset_tag_link (using composite key asset_id + tag_id)
    UPDATE asset_tag_link 
    SET download_profiles = CASE 
        WHEN download_profiles @> ARRAY[profile_id_param] THEN download_profiles
        ELSE array_append(COALESCE(download_profiles, '{}'), profile_id_param)
    END
    WHERE asset_id = ANY(ARRAY(SELECT (jsonb_array_elements_text(closure_record.asset_ids))::UUID))
    AND tag_id = ANY(ARRAY(SELECT (jsonb_array_elements_text(closure_record.tag_ids))::UUID));
    GET DIAGNOSTICS asset_tag_links_updated = ROW_COUNT;
    RAISE NOTICE '[download_quest_closure] Updated asset_tag_links: % rows', asset_tag_links_updated;
    
    -- Update quest itself (using UUID array operators)
    UPDATE quest 
    SET download_profiles = CASE 
        WHEN download_profiles @> ARRAY[profile_id_param] THEN download_profiles
        ELSE array_append(COALESCE(download_profiles, '{}'), profile_id_param)
    END
    WHERE id = quest_id_param;
    GET DIAGNOSTICS quests_updated = ROW_COUNT;
    RAISE NOTICE '[download_quest_closure] Updated quest: % rows', quests_updated;
    
    -- Update the quest closure record itself to include this profile
    UPDATE quest_closure 
    SET download_profiles = CASE 
        WHEN download_profiles @> ARRAY[profile_id_param] THEN download_profiles
        ELSE array_append(COALESCE(download_profiles, '{}'), profile_id_param)
    END
    WHERE quest_id = quest_id_param;
    GET DIAGNOSTICS quest_closures_updated = ROW_COUNT;
    RAISE NOTICE '[download_quest_closure] Updated quest_closure: % rows', quest_closures_updated;
    
    -- NEW: Also update all sibling quest_closure records for other quests in the same project
    UPDATE quest_closure 
    SET download_profiles = CASE 
        WHEN download_profiles @> ARRAY[profile_id_param] THEN download_profiles
        ELSE array_append(COALESCE(download_profiles, '{}'), profile_id_param)
    END
    WHERE project_id = closure_record.project_id 
    AND quest_id != quest_id_param;
    GET DIAGNOSTICS sibling_quest_closures_updated = ROW_COUNT;
    RAISE NOTICE '[download_quest_closure] Updated sibling quest_closures: % rows', sibling_quest_closures_updated;
    
    -- Add sibling updates to total count
    quest_closures_updated := quest_closures_updated + sibling_quest_closures_updated;
    
    -- NEW: Also update the project_closure record to include this profile
    UPDATE project_closure 
    SET download_profiles = CASE 
        WHEN download_profiles @> ARRAY[profile_id_param] THEN download_profiles
        ELSE array_append(COALESCE(download_profiles, '{}'), profile_id_param)
    END
    WHERE project_id = closure_record.project_id;
    GET DIAGNOSTICS project_closures_updated = ROW_COUNT;
    RAISE NOTICE '[download_quest_closure] Updated project_closure: % rows', project_closures_updated;
    
    -- Logging
    RAISE NOTICE '[download_quest_closure] Completed for quest_id: %, profile_id: %. Updated project, % quest_closures total (including siblings), and project_closure', quest_id_param, profile_id_param, quest_closures_updated;

    -- Return summary of what was updated
    RETURN QUERY
    SELECT 'project'::TEXT, projects_updated
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
    SELECT 'quest_closure'::TEXT, quest_closures_updated
    UNION ALL
    SELECT 'project_closure'::TEXT, project_closures_updated;
END;
$function$;

-- Enhanced download_project_closure function that also updates all quest_closure records
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
