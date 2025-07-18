revoke delete on table "public"."quest_aggregates" from "anon";

revoke insert on table "public"."quest_aggregates" from "anon";

revoke references on table "public"."quest_aggregates" from "anon";

revoke select on table "public"."quest_aggregates" from "anon";

revoke trigger on table "public"."quest_aggregates" from "anon";

revoke truncate on table "public"."quest_aggregates" from "anon";

revoke update on table "public"."quest_aggregates" from "anon";

revoke delete on table "public"."quest_aggregates" from "authenticated";

revoke insert on table "public"."quest_aggregates" from "authenticated";

revoke references on table "public"."quest_aggregates" from "authenticated";

revoke select on table "public"."quest_aggregates" from "authenticated";

revoke trigger on table "public"."quest_aggregates" from "authenticated";

revoke truncate on table "public"."quest_aggregates" from "authenticated";

revoke update on table "public"."quest_aggregates" from "authenticated";

revoke delete on table "public"."quest_aggregates" from "service_role";

revoke insert on table "public"."quest_aggregates" from "service_role";

revoke references on table "public"."quest_aggregates" from "service_role";

revoke select on table "public"."quest_aggregates" from "service_role";

revoke trigger on table "public"."quest_aggregates" from "service_role";

revoke truncate on table "public"."quest_aggregates" from "service_role";

revoke update on table "public"."quest_aggregates" from "service_role";

alter table "public"."quest_aggregates" drop constraint "quest_aggregates_project_id_fkey";

alter table "public"."quest_aggregates" drop constraint "quest_aggregates_quest_id_fkey";

drop function if exists "public"."create_missing_quest_closures"();

alter table "public"."quest_aggregates" drop constraint "quest_aggregates_pkey";

drop index if exists "public"."quest_aggregates_last_updated_idx";

drop index if exists "public"."quest_aggregates_pkey";

drop index if exists "public"."quest_aggregates_project_id_idx";

drop table "public"."quest_aggregates";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.create_missing_quest_closures()
 RETURNS TABLE(quest_id uuid, project_id uuid, created boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RAISE NOTICE '[create_missing_quest_closures] Starting creation of missing quest_closure records';

    -- Create missing quest_closure records for all quests that don't have them
    INSERT INTO quest_closure (quest_id, project_id)
    SELECT q.id, q.project_id
    FROM quest q
    LEFT JOIN quest_closure qc ON qc.quest_id = q.id
    WHERE qc.quest_id IS NULL
    ON CONFLICT (quest_id) DO NOTHING;

    -- Return what was created
    RETURN QUERY
    SELECT q.id, q.project_id, (qc.quest_id IS NOT NULL) as created
    FROM quest q
    LEFT JOIN quest_closure qc ON qc.quest_id = q.id
    WHERE qc.last_updated >= NOW() - INTERVAL '1 minute'; -- Recently created

    RAISE NOTICE '[create_missing_quest_closures] Completed creation of missing quest_closure records';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.download_quest_closure(quest_id_param uuid, profile_id_param uuid)
 RETURNS TABLE(table_name text, records_updated integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    closure_record quest_closure%ROWTYPE;
    profile_id_text TEXT := profile_id_param::text;
    assets_updated INTEGER := 0;
    translations_updated INTEGER := 0;
    votes_updated INTEGER := 0;
    tags_updated INTEGER := 0;
    languages_updated INTEGER := 0; -- NEW
    quest_asset_links_updated INTEGER := 0;
    asset_content_links_updated INTEGER := 0;
    quest_tag_links_updated INTEGER := 0;
    asset_tag_links_updated INTEGER := 0;
    quests_updated INTEGER := 0;
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
    
    -- Update quest itself
    UPDATE quest 
    SET download_profiles = CASE 
        WHEN download_profiles ? profile_id_text THEN download_profiles
        ELSE COALESCE(download_profiles, '[]'::jsonb) || jsonb_build_array(profile_id_text)
    END
    WHERE id = quest_id_param;
    GET DIAGNOSTICS quests_updated = ROW_COUNT;
    RAISE NOTICE '[download_quest_closure] Updated quest: % rows', quests_updated;
    
    -- Update assets
    UPDATE asset 
    SET download_profiles = CASE 
        WHEN download_profiles ? profile_id_text THEN download_profiles
        ELSE COALESCE(download_profiles, '[]'::jsonb) || jsonb_build_array(profile_id_text)
    END
    WHERE id = ANY(ARRAY(SELECT (jsonb_array_elements_text(closure_record.asset_ids))::UUID));
    GET DIAGNOSTICS assets_updated = ROW_COUNT;
    RAISE NOTICE '[download_quest_closure] Updated assets: % rows', assets_updated;
    
    -- Update translations
    UPDATE translation 
    SET download_profiles = CASE 
        WHEN download_profiles ? profile_id_text THEN download_profiles
        ELSE COALESCE(download_profiles, '[]'::jsonb) || jsonb_build_array(profile_id_text)
    END
    WHERE id = ANY(ARRAY(SELECT (jsonb_array_elements_text(closure_record.translation_ids))::UUID));
    GET DIAGNOSTICS translations_updated = ROW_COUNT;
    RAISE NOTICE '[download_quest_closure] Updated translations: % rows', translations_updated;
    
    -- Update votes
    UPDATE vote 
    SET download_profiles = CASE 
        WHEN download_profiles ? profile_id_text THEN download_profiles
        ELSE COALESCE(download_profiles, '[]'::jsonb) || jsonb_build_array(profile_id_text)
    END
    WHERE id = ANY(ARRAY(SELECT (jsonb_array_elements_text(closure_record.vote_ids))::UUID));
    GET DIAGNOSTICS votes_updated = ROW_COUNT;
    RAISE NOTICE '[download_quest_closure] Updated votes: % rows', votes_updated;
    
    -- Update tags
    UPDATE tag 
    SET download_profiles = CASE 
        WHEN download_profiles ? profile_id_text THEN download_profiles
        ELSE COALESCE(download_profiles, '[]'::jsonb) || jsonb_build_array(profile_id_text)
    END
    WHERE id = ANY(ARRAY(SELECT (jsonb_array_elements_text(closure_record.tag_ids))::UUID));
    GET DIAGNOSTICS tags_updated = ROW_COUNT;
    RAISE NOTICE '[download_quest_closure] Updated tags: % rows', tags_updated;
    
    -- Update languages (NEW)
    UPDATE language 
    SET download_profiles = CASE 
        WHEN download_profiles ? profile_id_text THEN download_profiles
        ELSE COALESCE(download_profiles, '[]'::jsonb) || jsonb_build_array(profile_id_text)
    END
    WHERE id = ANY(ARRAY(SELECT (jsonb_array_elements_text(closure_record.language_ids))::UUID));
    GET DIAGNOSTICS languages_updated = ROW_COUNT;
    RAISE NOTICE '[download_quest_closure] Updated languages: % rows', languages_updated;
    
    -- Update quest_asset_link
    UPDATE quest_asset_link 
    SET download_profiles = CASE 
        WHEN download_profiles ? profile_id_text THEN download_profiles
        ELSE COALESCE(download_profiles, '[]'::jsonb) || jsonb_build_array(profile_id_text)
    END
    WHERE id = ANY(ARRAY(SELECT (jsonb_array_elements_text(closure_record.quest_asset_link_ids))::UUID));
    GET DIAGNOSTICS quest_asset_links_updated = ROW_COUNT;
    RAISE NOTICE '[download_quest_closure] Updated quest_asset_links: % rows', quest_asset_links_updated;
    
    -- Update asset_content_link
    UPDATE asset_content_link 
    SET download_profiles = CASE 
        WHEN download_profiles ? profile_id_text THEN download_profiles
        ELSE COALESCE(download_profiles, '[]'::jsonb) || jsonb_build_array(profile_id_text)
    END
    WHERE id = ANY(ARRAY(SELECT (jsonb_array_elements_text(closure_record.asset_content_link_ids))::UUID));
    GET DIAGNOSTICS asset_content_links_updated = ROW_COUNT;
    RAISE NOTICE '[download_quest_closure] Updated asset_content_links: % rows', asset_content_links_updated;
    
    -- Update quest_tag_link  
    UPDATE quest_tag_link 
    SET download_profiles = CASE 
        WHEN download_profiles ? profile_id_text THEN download_profiles
        ELSE COALESCE(download_profiles, '[]'::jsonb) || jsonb_build_array(profile_id_text)
    END
    WHERE id = ANY(ARRAY(SELECT (jsonb_array_elements_text(closure_record.quest_tag_link_ids))::UUID));
    GET DIAGNOSTICS quest_tag_links_updated = ROW_COUNT;
    RAISE NOTICE '[download_quest_closure] Updated quest_tag_links: % rows', quest_tag_links_updated;
    
    -- Update asset_tag_link
    UPDATE asset_tag_link 
    SET download_profiles = CASE 
        WHEN download_profiles ? profile_id_text THEN download_profiles
        ELSE COALESCE(download_profiles, '[]'::jsonb) || jsonb_build_array(profile_id_text)
    END
    WHERE id = ANY(ARRAY(SELECT (jsonb_array_elements_text(closure_record.asset_tag_link_ids))::UUID));
    GET DIAGNOSTICS asset_tag_links_updated = ROW_COUNT;
    RAISE NOTICE '[download_quest_closure] Updated asset_tag_links: % rows', asset_tag_links_updated;
    
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
    SELECT 'language'::TEXT, languages_updated  -- NEW
    UNION ALL
    SELECT 'quest_asset_link'::TEXT, quest_asset_links_updated
    UNION ALL
    SELECT 'asset_content_link'::TEXT, asset_content_links_updated
    UNION ALL
    SELECT 'quest_tag_link'::TEXT, quest_tag_links_updated
    UNION ALL
    SELECT 'asset_tag_link'::TEXT, asset_tag_links_updated;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_quest_closure_on_asset_link()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    IF NEW.active = true THEN
        -- Logging
        RAISE NOTICE '[update_quest_closure_on_asset_link] Updating quest_closure for quest_id: %, asset_id: %, link_id: %', NEW.quest_id, NEW.asset_id, NEW.id;

        -- Ensure quest_closure record exists for this quest
        INSERT INTO quest_closure (quest_id, project_id)
        SELECT q.id, q.project_id
        FROM quest q
        WHERE q.id = NEW.quest_id
        ON CONFLICT (quest_id) DO NOTHING;

        -- Log if we created a missing closure
        IF FOUND THEN
            RAISE NOTICE '[update_quest_closure_on_asset_link] Created missing quest_closure record for quest_id: %', NEW.quest_id;
        END IF;

        -- Add to arrays and recompute aggregates
        UPDATE quest_closure 
        SET 
            asset_ids = CASE 
                WHEN asset_ids ? NEW.asset_id::text THEN asset_ids
                ELSE asset_ids || jsonb_build_array(NEW.asset_id)
            END,
            quest_asset_link_ids = CASE 
                WHEN quest_asset_link_ids ? NEW.id::text THEN quest_asset_link_ids
                ELSE quest_asset_link_ids || jsonb_build_array(NEW.id)
            END,
            -- Collect all unique language IDs from assets and translations
            language_ids = (
                SELECT COALESCE(jsonb_agg(DISTINCT lang_id), '[]'::jsonb)
                FROM (
                    -- Source languages from assets
                    SELECT a.source_language_id as lang_id
                    FROM asset a
                    JOIN quest_asset_link qal ON qal.asset_id = a.id
                    WHERE qal.quest_id = NEW.quest_id AND qal.active = true AND a.active = true
                    
                    UNION
                    
                    -- Target languages from translations  
                    SELECT t.target_language_id as lang_id
                    FROM translation t
                    JOIN quest_asset_link qal ON qal.asset_id = t.asset_id
                    WHERE qal.quest_id = NEW.quest_id AND qal.active = true AND t.active = true
                    
                    UNION
                    
                    -- Project source/target languages
                    SELECT p.source_language_id as lang_id
                    FROM project p
                    JOIN quest q ON q.project_id = p.id
                    WHERE q.id = NEW.quest_id
                    
                    UNION
                    
                    SELECT p.target_language_id as lang_id  
                    FROM project p
                    JOIN quest q ON q.project_id = p.id
                    WHERE q.id = NEW.quest_id
                ) unique_languages
            ),
            total_assets = (
                SELECT COUNT(*)
                FROM quest_asset_link 
                WHERE quest_id = NEW.quest_id AND active = true
            ),
            last_updated = NOW()
        WHERE quest_id = NEW.quest_id;
        
        -- Logging
        RAISE NOTICE '[update_quest_closure_on_asset_link] Updated asset_ids, quest_asset_link_ids, language_ids, total_assets for quest_id: %', NEW.quest_id;

        -- Update related link arrays (asset_content_link, asset_tag_link)
        UPDATE quest_closure 
        SET 
            asset_content_link_ids = (
                SELECT COALESCE(jsonb_agg(acl.id), '[]'::jsonb)
                FROM asset_content_link acl
                JOIN quest_asset_link qal ON qal.asset_id = acl.asset_id
                WHERE qal.quest_id = NEW.quest_id AND qal.active = true AND acl.active = true
            ),
            asset_tag_link_ids = (
                SELECT COALESCE(jsonb_agg(atl.id), '[]'::jsonb)
                FROM asset_tag_link atl
                JOIN quest_asset_link qal ON qal.asset_id = atl.asset_id
                WHERE qal.quest_id = NEW.quest_id AND qal.active = true AND atl.active = true
            ),
            last_updated = NOW()
        WHERE quest_id = NEW.quest_id;

        -- Logging
        RAISE NOTICE '[update_quest_closure_on_asset_link] Updated asset_content_link_ids, asset_tag_link_ids for quest_id: %', NEW.quest_id;
    END IF;
    
    RETURN NEW;
END;
$function$
;


