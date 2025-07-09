-- Update download_quest_closure function to also add profile to quest closure record
-- This ensures the quest closure record itself gets synced to the user's local database

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
    
    -- Update quest_asset_link
    UPDATE quest_asset_link 
    SET download_profiles = CASE 
        WHEN download_profiles @> ARRAY[profile_id_param] THEN download_profiles
        ELSE array_append(COALESCE(download_profiles, '{}'), profile_id_param)
    END
    WHERE id = ANY(ARRAY(SELECT (jsonb_array_elements_text(closure_record.quest_asset_link_ids))::UUID));
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
    
    -- Update quest_tag_link  
    UPDATE quest_tag_link 
    SET download_profiles = CASE 
        WHEN download_profiles @> ARRAY[profile_id_param] THEN download_profiles
        ELSE array_append(COALESCE(download_profiles, '{}'), profile_id_param)
    END
    WHERE id = ANY(ARRAY(SELECT (jsonb_array_elements_text(closure_record.quest_tag_link_ids))::UUID));
    GET DIAGNOSTICS quest_tag_links_updated = ROW_COUNT;
    RAISE NOTICE '[download_quest_closure] Updated quest_tag_links: % rows', quest_tag_links_updated;
    
    -- Update asset_tag_link
    UPDATE asset_tag_link 
    SET download_profiles = CASE 
        WHEN download_profiles @> ARRAY[profile_id_param] THEN download_profiles
        ELSE array_append(COALESCE(download_profiles, '{}'), profile_id_param)
    END
    WHERE id = ANY(ARRAY(SELECT (jsonb_array_elements_text(closure_record.asset_tag_link_ids))::UUID));
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
$function$
; 

-- Function to rebuild all project closures in bulk
CREATE OR REPLACE FUNCTION public.rebuild_all_project_closures()
 RETURNS TABLE(result_project_id uuid, result_total_quests integer, result_total_assets integer, result_total_translations integer, result_approved_translations integer, result_processing_time_ms bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    project_record RECORD;
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    processing_time_ms BIGINT;
    total_projects INTEGER := 0;
    processed_projects INTEGER := 0;
BEGIN
    start_time := NOW();
    
    -- Get total count for logging
    SELECT COUNT(*) INTO total_projects FROM project WHERE active = true;
    
    RAISE NOTICE '[rebuild_all_project_closures] Starting rebuild for % projects', total_projects;
    
    -- First ensure all projects have closure records
    INSERT INTO project_closure (project_id)
    SELECT p.id
    FROM project p
    WHERE p.active = true
    ON CONFLICT (project_id) DO NOTHING;
    
    -- Now rebuild each project closure by aggregating from quest closures
    FOR project_record IN 
        SELECT p.id as project_id
        FROM project p 
        WHERE p.active = true
        ORDER BY p.created_at
    LOOP
        processed_projects := processed_projects + 1;
        
        -- Log progress every 50 projects (fewer than quests, so smaller batch)
        IF processed_projects % 50 = 0 THEN
            RAISE NOTICE '[rebuild_all_project_closures] Processed % of % projects', processed_projects, total_projects;
        END IF;
        
        -- Completely rebuild this project's closure from quest closures
        UPDATE project_closure 
        SET 
            -- Aggregate quest IDs
            quest_ids = (
                SELECT COALESCE(jsonb_agg(DISTINCT qc.quest_id), '[]'::jsonb)
                FROM quest_closure qc
                JOIN quest q ON q.id = qc.quest_id
                WHERE qc.project_id = project_record.project_id AND q.active = true
            ),
            
            -- Aggregate all asset IDs from quest closures
            asset_ids = (
                SELECT COALESCE(jsonb_agg(DISTINCT asset_id), '[]'::jsonb)
                FROM (
                    SELECT jsonb_array_elements_text(qc.asset_ids)::uuid as asset_id
                    FROM quest_closure qc
                    JOIN quest q ON q.id = qc.quest_id
                    WHERE qc.project_id = project_record.project_id AND q.active = true
                ) aggregated_assets
            ),
            
            -- Aggregate all translation IDs from quest closures
            translation_ids = (
                SELECT COALESCE(jsonb_agg(DISTINCT translation_id), '[]'::jsonb)
                FROM (
                    SELECT jsonb_array_elements_text(qc.translation_ids)::uuid as translation_id
                    FROM quest_closure qc
                    JOIN quest q ON q.id = qc.quest_id
                    WHERE qc.project_id = project_record.project_id AND q.active = true
                ) aggregated_translations
            ),
            
            -- Aggregate all vote IDs from quest closures
            vote_ids = (
                SELECT COALESCE(jsonb_agg(DISTINCT vote_id), '[]'::jsonb)
                FROM (
                    SELECT jsonb_array_elements_text(qc.vote_ids)::uuid as vote_id
                    FROM quest_closure qc
                    JOIN quest q ON q.id = qc.quest_id
                    WHERE qc.project_id = project_record.project_id AND q.active = true
                ) aggregated_votes
            ),
            
            -- Aggregate all tag IDs from quest closures
            tag_ids = (
                SELECT COALESCE(jsonb_agg(DISTINCT tag_id), '[]'::jsonb)
                FROM (
                    SELECT jsonb_array_elements_text(qc.tag_ids)::uuid as tag_id
                    FROM quest_closure qc
                    JOIN quest q ON q.id = qc.quest_id
                    WHERE qc.project_id = project_record.project_id AND q.active = true
                ) aggregated_tags
            ),
            
            -- Aggregate all language IDs from quest closures
            language_ids = (
                SELECT COALESCE(jsonb_agg(DISTINCT language_id), '[]'::jsonb)
                FROM (
                    SELECT jsonb_array_elements_text(qc.language_ids)::uuid as language_id
                    FROM quest_closure qc
                    JOIN quest q ON q.id = qc.quest_id
                    WHERE qc.project_id = project_record.project_id AND q.active = true
                ) aggregated_languages
            ),
            
            -- Aggregate all quest_asset_link IDs from quest closures
            quest_asset_link_ids = (
                SELECT COALESCE(jsonb_agg(DISTINCT link_id), '[]'::jsonb)
                FROM (
                    SELECT jsonb_array_elements_text(qc.quest_asset_link_ids) as link_id
                    FROM quest_closure qc
                    JOIN quest q ON q.id = qc.quest_id
                    WHERE qc.project_id = project_record.project_id AND q.active = true
                ) aggregated_quest_asset_links
            ),
            
            -- Aggregate all asset_content_link IDs from quest closures
            asset_content_link_ids = (
                SELECT COALESCE(jsonb_agg(DISTINCT link_id), '[]'::jsonb)
                FROM (
                    SELECT jsonb_array_elements_text(qc.asset_content_link_ids)::uuid as link_id
                    FROM quest_closure qc
                    JOIN quest q ON q.id = qc.quest_id
                    WHERE qc.project_id = project_record.project_id AND q.active = true
                ) aggregated_asset_content_links
            ),
            
            -- Aggregate all quest_tag_link IDs from quest closures
            quest_tag_link_ids = (
                SELECT COALESCE(jsonb_agg(DISTINCT link_id), '[]'::jsonb)
                FROM (
                    SELECT jsonb_array_elements_text(qc.quest_tag_link_ids) as link_id
                    FROM quest_closure qc
                    JOIN quest q ON q.id = qc.quest_id
                    WHERE qc.project_id = project_record.project_id AND q.active = true
                ) aggregated_quest_tag_links
            ),
            
            -- Aggregate all asset_tag_link IDs from quest closures
            asset_tag_link_ids = (
                SELECT COALESCE(jsonb_agg(DISTINCT link_id), '[]'::jsonb)
                FROM (
                    SELECT jsonb_array_elements_text(qc.asset_tag_link_ids) as link_id
                    FROM quest_closure qc
                    JOIN quest q ON q.id = qc.quest_id
                    WHERE qc.project_id = project_record.project_id AND q.active = true
                ) aggregated_asset_tag_links
            ),
            
            -- Aggregate counts
            total_quests = (
                SELECT COUNT(DISTINCT qc.quest_id)
                FROM quest_closure qc
                JOIN quest q ON q.id = qc.quest_id
                WHERE qc.project_id = project_record.project_id AND q.active = true
            ),
            
            total_assets = (
                SELECT COALESCE(SUM(qc.total_assets), 0)
                FROM quest_closure qc
                JOIN quest q ON q.id = qc.quest_id
                WHERE qc.project_id = project_record.project_id AND q.active = true
            ),
            
            total_translations = (
                SELECT COALESCE(SUM(qc.total_translations), 0)
                FROM quest_closure qc
                JOIN quest q ON q.id = qc.quest_id
                WHERE qc.project_id = project_record.project_id AND q.active = true
            ),
            
            approved_translations = (
                SELECT COALESCE(SUM(qc.approved_translations), 0)
                FROM quest_closure qc
                JOIN quest q ON q.id = qc.quest_id
                WHERE qc.project_id = project_record.project_id AND q.active = true
            ),
            
            last_updated = NOW()
        WHERE project_id = project_record.project_id;
        
    END LOOP;
    
    end_time := NOW();
    processing_time_ms := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    
    RAISE NOTICE '[rebuild_all_project_closures] Completed rebuild for % projects in % ms', processed_projects, processing_time_ms;
    
    -- Return summary of all rebuilt closures
    RETURN QUERY
    SELECT 
        pc.project_id,
        pc.total_quests,
        pc.total_assets,
        pc.total_translations,
        pc.approved_translations,
        processing_time_ms
    FROM project_closure pc
    JOIN project p ON p.id = pc.project_id
    WHERE p.active = true
    ORDER BY pc.last_updated DESC;
END;
$function$
;
