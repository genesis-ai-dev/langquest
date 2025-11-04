CREATE OR REPLACE FUNCTION public.rebuild_all_quest_closures()
 RETURNS TABLE(result_quest_id uuid, result_project_id uuid, result_total_assets integer, result_total_translations integer, result_approved_translations integer, result_processing_time_ms bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    quest_record RECORD;
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    processing_time_ms BIGINT;
    total_quests INTEGER := 0;
    processed_quests INTEGER := 0;
BEGIN
    start_time := NOW();
    
    -- Get total count for logging
    SELECT COUNT(*) INTO total_quests FROM quest WHERE active = true;
    
    RAISE NOTICE '[rebuild_all_quest_closures] Starting rebuild for % quests', total_quests;
    
    -- First ensure all quests have closure records
    INSERT INTO quest_closure (quest_id, project_id)
    SELECT q.id, q.project_id
    FROM quest q
    WHERE q.active = true
    ON CONFLICT (quest_id) DO NOTHING;
    
    -- Now rebuild each quest closure completely
    FOR quest_record IN 
        SELECT q.id as quest_id, q.project_id 
        FROM quest q 
        WHERE q.active = true
        ORDER BY q.created_at
    LOOP
        processed_quests := processed_quests + 1;
        
        -- Log progress every 100 quests
        IF processed_quests % 100 = 0 THEN
            RAISE NOTICE '[rebuild_all_quest_closures] Processed % of % quests', processed_quests, total_quests;
        END IF;
        
        -- Completely rebuild this quest's closure
        UPDATE quest_closure 
        SET 
            -- Asset IDs from active quest_asset_links
            asset_ids = (
                SELECT COALESCE(jsonb_agg(DISTINCT qal.asset_id), '[]'::jsonb)
                FROM quest_asset_link qal
                JOIN asset a ON a.id = qal.asset_id
                WHERE qal.quest_id = quest_record.quest_id 
                AND qal.active = true AND a.active = true
            ),
            
            -- Translation IDs from assets linked to this quest
            translation_ids = (
                SELECT COALESCE(jsonb_agg(DISTINCT t.id), '[]'::jsonb)
                FROM translation t
                JOIN quest_asset_link qal ON qal.asset_id = t.asset_id
                WHERE qal.quest_id = quest_record.quest_id 
                AND qal.active = true AND t.active = true
            ),
            
            -- Vote IDs from translations of assets linked to this quest
            vote_ids = (
                SELECT COALESCE(jsonb_agg(DISTINCT v.id), '[]'::jsonb)
                FROM vote v
                JOIN translation t ON t.id = v.translation_id
                JOIN quest_asset_link qal ON qal.asset_id = t.asset_id
                WHERE qal.quest_id = quest_record.quest_id 
                AND qal.active = true AND t.active = true AND v.active = true
            ),
            
            -- Tag IDs from quest tags and asset tags
            tag_ids = (
                SELECT COALESCE(jsonb_agg(DISTINCT tag_id), '[]'::jsonb)
                FROM (
                    -- Tags directly on quest
                    SELECT qtl.tag_id
                    FROM quest_tag_link qtl
                    JOIN tag tg ON tg.id = qtl.tag_id
                    WHERE qtl.quest_id = quest_record.quest_id 
                    AND qtl.active = true AND tg.active = true
                    
                    UNION
                    
                    -- Tags on assets in this quest
                    SELECT atl.tag_id
                    FROM asset_tag_link atl
                    JOIN quest_asset_link qal ON qal.asset_id = atl.asset_id
                    JOIN tag tg ON tg.id = atl.tag_id
                    WHERE qal.quest_id = quest_record.quest_id 
                    AND qal.active = true AND atl.active = true AND tg.active = true
                ) all_tags
            ),
            
            -- Language IDs from various sources
            language_ids = (
                SELECT COALESCE(jsonb_agg(DISTINCT lang_id), '[]'::jsonb)
                FROM (
                    -- Source languages from assets
                    SELECT a.source_language_id as lang_id
                    FROM asset a
                    JOIN quest_asset_link qal ON qal.asset_id = a.id
                    WHERE qal.quest_id = quest_record.quest_id 
                    AND qal.active = true AND a.active = true
                    
                    UNION
                    
                    -- Target languages from translations  
                    SELECT t.target_language_id as lang_id
                    FROM translation t
                    JOIN quest_asset_link qal ON qal.asset_id = t.asset_id
                    WHERE qal.quest_id = quest_record.quest_id 
                    AND qal.active = true AND t.active = true
                    
                    UNION
                    
                    -- Project source/target languages
                    SELECT p.source_language_id as lang_id
                    FROM project p
                    JOIN quest q ON q.project_id = p.id
                    WHERE q.id = quest_record.quest_id
                    
                    UNION
                    
                    SELECT p.target_language_id as lang_id  
                    FROM project p
                    JOIN quest q ON q.project_id = p.id
                    WHERE q.id = quest_record.quest_id
                ) unique_languages
            ),
            
            -- Quest asset link IDs (using composite key)
            quest_asset_link_ids = (
                SELECT COALESCE(jsonb_agg(DISTINCT (qal.quest_id || '-' || qal.asset_id)), '[]'::jsonb)
                FROM quest_asset_link qal
                WHERE qal.quest_id = quest_record.quest_id AND qal.active = true
            ),
            
            -- Asset content link IDs
            asset_content_link_ids = (
                SELECT COALESCE(jsonb_agg(DISTINCT acl.id), '[]'::jsonb)
                FROM asset_content_link acl
                JOIN quest_asset_link qal ON qal.asset_id = acl.asset_id
                WHERE qal.quest_id = quest_record.quest_id 
                AND qal.active = true AND acl.active = true
            ),
            
            -- Quest tag link IDs (using composite key)
            quest_tag_link_ids = (
                SELECT COALESCE(jsonb_agg(DISTINCT (qtl.quest_id || '-' || qtl.tag_id)), '[]'::jsonb)
                FROM quest_tag_link qtl
                WHERE qtl.quest_id = quest_record.quest_id AND qtl.active = true
            ),
            
            -- Asset tag link IDs (using composite key)
            asset_tag_link_ids = (
                SELECT COALESCE(jsonb_agg(DISTINCT (atl.asset_id || '-' || atl.tag_id)), '[]'::jsonb)
                FROM asset_tag_link atl
                JOIN quest_asset_link qal ON qal.asset_id = atl.asset_id
                WHERE qal.quest_id = quest_record.quest_id 
                AND qal.active = true AND atl.active = true
            ),
            
            -- Aggregate counts
            total_assets = (
                SELECT COUNT(DISTINCT qal.asset_id)
                FROM quest_asset_link qal
                JOIN asset a ON a.id = qal.asset_id
                WHERE qal.quest_id = quest_record.quest_id 
                AND qal.active = true AND a.active = true
            ),
            
            total_translations = (
                SELECT COUNT(DISTINCT t.id)
                FROM translation t
                JOIN quest_asset_link qal ON qal.asset_id = t.asset_id
                WHERE qal.quest_id = quest_record.quest_id 
                AND qal.active = true AND t.active = true
            ),
            
            approved_translations = (
                SELECT COUNT(DISTINCT t.id)
                FROM translation t
                JOIN quest_asset_link qal ON qal.asset_id = t.asset_id
                JOIN vote v ON v.translation_id = t.id AND v.polarity = 'up' AND v.active = true
                WHERE qal.quest_id = quest_record.quest_id 
                AND qal.active = true AND t.active = true
            ),
            
            last_updated = NOW()
        WHERE quest_id = quest_record.quest_id;
        
    END LOOP;
    
    end_time := NOW();
    processing_time_ms := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    
    RAISE NOTICE '[rebuild_all_quest_closures] Completed rebuild for % quests in % ms', processed_quests, processing_time_ms;
    
    -- Return summary of all rebuilt closures
    RETURN QUERY
    SELECT 
        qc.quest_id,
        qc.project_id,
        qc.total_assets,
        qc.total_translations,
        qc.approved_translations,
        processing_time_ms
    FROM quest_closure qc
    JOIN quest q ON q.id = qc.quest_id
    WHERE q.active = true
    ORDER BY qc.last_updated DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rebuild_single_quest_closure(quest_id_param uuid)
 RETURNS TABLE(result_quest_id uuid, result_project_id uuid, result_total_assets integer, result_total_translations integer, result_approved_translations integer, result_processing_time_ms bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    processing_time_ms BIGINT;
    quest_project_id UUID;
BEGIN
    start_time := NOW();
    
    -- Get the project_id for this quest
    SELECT q.project_id INTO quest_project_id 
    FROM quest q 
    WHERE q.id = quest_id_param AND q.active = true;
    
    IF quest_project_id IS NULL THEN
        RAISE EXCEPTION 'Quest not found or not active: %', quest_id_param;
    END IF;
    
    RAISE NOTICE '[rebuild_single_quest_closure] Starting rebuild for quest_id: %', quest_id_param;
    
    -- Ensure quest_closure record exists
    INSERT INTO quest_closure (quest_id, project_id)
    VALUES (quest_id_param, quest_project_id)
    ON CONFLICT (quest_id) DO NOTHING;
    
    -- Rebuild this quest's closure completely (same logic as the bulk function)
    UPDATE quest_closure 
    SET 
        -- Asset IDs from active quest_asset_links
        asset_ids = (
            SELECT COALESCE(jsonb_agg(DISTINCT qal.asset_id), '[]'::jsonb)
            FROM quest_asset_link qal
            JOIN asset a ON a.id = qal.asset_id
            WHERE qal.quest_id = quest_id_param 
            AND qal.active = true AND a.active = true
        ),
        
        -- Translation IDs from assets linked to this quest
        translation_ids = (
            SELECT COALESCE(jsonb_agg(DISTINCT t.id), '[]'::jsonb)
            FROM translation t
            JOIN quest_asset_link qal ON qal.asset_id = t.asset_id
            WHERE qal.quest_id = quest_id_param 
            AND qal.active = true AND t.active = true
        ),
        
        -- Vote IDs from translations of assets linked to this quest
        vote_ids = (
            SELECT COALESCE(jsonb_agg(DISTINCT v.id), '[]'::jsonb)
            FROM vote v
            JOIN translation t ON t.id = v.translation_id
            JOIN quest_asset_link qal ON qal.asset_id = t.asset_id
            WHERE qal.quest_id = quest_id_param 
            AND qal.active = true AND t.active = true AND v.active = true
        ),
        
        -- Tag IDs from quest tags and asset tags
        tag_ids = (
            SELECT COALESCE(jsonb_agg(DISTINCT tag_id), '[]'::jsonb)
            FROM (
                -- Tags directly on quest
                SELECT qtl.tag_id
                FROM quest_tag_link qtl
                JOIN tag tg ON tg.id = qtl.tag_id
                WHERE qtl.quest_id = quest_id_param 
                AND qtl.active = true AND tg.active = true
                
                UNION
                
                -- Tags on assets in this quest
                SELECT atl.tag_id
                FROM asset_tag_link atl
                JOIN quest_asset_link qal ON qal.asset_id = atl.asset_id
                JOIN tag tg ON tg.id = atl.tag_id
                WHERE qal.quest_id = quest_id_param 
                AND qal.active = true AND atl.active = true AND tg.active = true
            ) all_tags
        ),
        
        -- Language IDs from various sources
        language_ids = (
            SELECT COALESCE(jsonb_agg(DISTINCT lang_id), '[]'::jsonb)
            FROM (
                -- Source languages from assets
                SELECT a.source_language_id as lang_id
                FROM asset a
                JOIN quest_asset_link qal ON qal.asset_id = a.id
                WHERE qal.quest_id = quest_id_param 
                AND qal.active = true AND a.active = true
                
                UNION
                
                -- Target languages from translations  
                SELECT t.target_language_id as lang_id
                FROM translation t
                JOIN quest_asset_link qal ON qal.asset_id = t.asset_id
                WHERE qal.quest_id = quest_id_param 
                AND qal.active = true AND t.active = true
                
                UNION
                
                -- Project source/target languages
                SELECT p.source_language_id as lang_id
                FROM project p
                JOIN quest q ON q.project_id = p.id
                WHERE q.id = quest_id_param
                
                UNION
                
                SELECT p.target_language_id as lang_id  
                FROM project p
                JOIN quest q ON q.project_id = p.id
                WHERE q.id = quest_id_param
            ) unique_languages
        ),
        
        -- Quest asset link IDs (using composite key)
        quest_asset_link_ids = (
            SELECT COALESCE(jsonb_agg(DISTINCT (qal.quest_id || '-' || qal.asset_id)), '[]'::jsonb)
            FROM quest_asset_link qal
            WHERE qal.quest_id = quest_id_param AND qal.active = true
        ),
        
        -- Asset content link IDs
        asset_content_link_ids = (
            SELECT COALESCE(jsonb_agg(DISTINCT acl.id), '[]'::jsonb)
            FROM asset_content_link acl
            JOIN quest_asset_link qal ON qal.asset_id = acl.asset_id
            WHERE qal.quest_id = quest_id_param 
            AND qal.active = true AND acl.active = true
        ),
        
        -- Quest tag link IDs (using composite key)
        quest_tag_link_ids = (
            SELECT COALESCE(jsonb_agg(DISTINCT (qtl.quest_id || '-' || qtl.tag_id)), '[]'::jsonb)
            FROM quest_tag_link qtl
            WHERE qtl.quest_id = quest_id_param AND qtl.active = true
        ),
        
        -- Asset tag link IDs (using composite key)
        asset_tag_link_ids = (
            SELECT COALESCE(jsonb_agg(DISTINCT (atl.asset_id || '-' || atl.tag_id)), '[]'::jsonb)
            FROM asset_tag_link atl
            JOIN quest_asset_link qal ON qal.asset_id = atl.asset_id
            WHERE qal.quest_id = quest_id_param 
            AND qal.active = true AND atl.active = true
        ),
        
        -- Aggregate counts
        total_assets = (
            SELECT COUNT(DISTINCT qal.asset_id)
            FROM quest_asset_link qal
            JOIN asset a ON a.id = qal.asset_id
            WHERE qal.quest_id = quest_id_param 
            AND qal.active = true AND a.active = true
        ),
        
        total_translations = (
            SELECT COUNT(DISTINCT t.id)
            FROM translation t
            JOIN quest_asset_link qal ON qal.asset_id = t.asset_id
            WHERE qal.quest_id = quest_id_param 
            AND qal.active = true AND t.active = true
        ),
        
        approved_translations = (
            SELECT COUNT(DISTINCT t.id)
            FROM translation t
            JOIN quest_asset_link qal ON qal.asset_id = t.asset_id
            JOIN vote v ON v.translation_id = t.id AND v.polarity = 'up' AND v.active = true
            WHERE qal.quest_id = quest_id_param 
            AND qal.active = true AND t.active = true
        ),
        
        last_updated = NOW()
    WHERE quest_id = quest_id_param;
    
    end_time := NOW();
    processing_time_ms := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    
    RAISE NOTICE '[rebuild_single_quest_closure] Completed rebuild for quest_id: % in % ms', quest_id_param, processing_time_ms;
    
    -- Return the rebuilt closure info
    RETURN QUERY
    SELECT 
        qc.quest_id,
        qc.project_id,
        qc.total_assets,
        qc.total_translations,
        qc.approved_translations,
        processing_time_ms
    FROM quest_closure qc
    WHERE qc.quest_id = quest_id_param;
END;
$function$
;
