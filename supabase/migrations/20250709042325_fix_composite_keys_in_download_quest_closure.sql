-- Fix composite key issue in download_quest_closure function
-- quest_asset_link, quest_tag_link, and asset_tag_link use composite keys, not id columns

CREATE OR REPLACE FUNCTION public.download_quest_closure(quest_id_param uuid, profile_id_param uuid)
 RETURNS TABLE(table_name text, records_updated integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    closure_record quest_closure%ROWTYPE;
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
    
    -- Update quest itself (using UUID array operators)
    UPDATE quest 
    SET download_profiles = CASE 
        WHEN download_profiles @> ARRAY[profile_id_param] THEN download_profiles
        ELSE array_append(COALESCE(download_profiles, '{}'), profile_id_param)
    END
    WHERE id = quest_id_param;
    GET DIAGNOSTICS quests_updated = ROW_COUNT;
    RAISE NOTICE '[download_quest_closure] Updated quest: % rows', quests_updated;
    
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
    
    -- Update the quest closure record itself to include this profile
    UPDATE quest_closure 
    SET download_profiles = CASE 
        WHEN download_profiles @> ARRAY[profile_id_param] THEN download_profiles
        ELSE array_append(COALESCE(download_profiles, '{}'), profile_id_param)
    END
    WHERE quest_id = quest_id_param;
    GET DIAGNOSTICS quest_closures_updated = ROW_COUNT;
    RAISE NOTICE '[download_quest_closure] Updated quest_closure: % rows', quest_closures_updated;
    
    -- Logging
    RAISE NOTICE '[download_quest_closure] Completed for quest_id: %, profile_id: %', quest_id_param, profile_id_param;

    -- Return summary of what was updated
    RETURN QUERY
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
    SELECT 'quest_closure'::TEXT, quest_closures_updated;
END;
$function$;
