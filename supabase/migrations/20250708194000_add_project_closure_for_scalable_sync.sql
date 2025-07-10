-- Create project_closure table for efficient project downloads
-- This aggregates quest closure data for all quests in a project

create table "public"."project_closure" (
    "project_id" uuid not null,
    "asset_ids" jsonb default '[]'::jsonb,
    "translation_ids" jsonb default '[]'::jsonb,
    "vote_ids" jsonb default '[]'::jsonb,
    "tag_ids" jsonb default '[]'::jsonb,
    "language_ids" jsonb default '[]'::jsonb,
    "quest_ids" jsonb default '[]'::jsonb,
    "quest_asset_link_ids" jsonb default '[]'::jsonb,
    "asset_content_link_ids" jsonb default '[]'::jsonb,
    "quest_tag_link_ids" jsonb default '[]'::jsonb,
    "asset_tag_link_ids" jsonb default '[]'::jsonb,
    "total_quests" integer not null default 0,
    "total_assets" integer not null default 0,
    "total_translations" integer not null default 0,
    "approved_translations" integer not null default 0,
    "download_profiles" uuid[] default '{}',
    "last_updated" timestamp with time zone not null default now()
);

-- Create indexes
CREATE INDEX project_closure_last_updated_idx ON public.project_closure USING btree (last_updated);
CREATE UNIQUE INDEX project_closure_pkey ON public.project_closure USING btree (project_id);

-- Add constraints
alter table "public"."project_closure" add constraint "project_closure_pkey" PRIMARY KEY using index "project_closure_pkey";
alter table "public"."project_closure" add constraint "project_closure_project_id_fkey" FOREIGN KEY (project_id) REFERENCES project(id) not valid;
alter table "public"."project_closure" validate constraint "project_closure_project_id_fkey";

-- Add download_profiles field to existing quest_closure table
ALTER TABLE "public"."quest_closure" ADD COLUMN "download_profiles" uuid[] default '{}';

-- Grant permissions
grant delete on table "public"."project_closure" to "anon";
grant insert on table "public"."project_closure" to "anon";
grant references on table "public"."project_closure" to "anon";
grant select on table "public"."project_closure" to "anon";
grant trigger on table "public"."project_closure" to "anon";
grant truncate on table "public"."project_closure" to "anon";
grant update on table "public"."project_closure" to "anon";
grant delete on table "public"."project_closure" to "authenticated";
grant insert on table "public"."project_closure" to "authenticated";
grant references on table "public"."project_closure" to "authenticated";
grant select on table "public"."project_closure" to "authenticated";
grant trigger on table "public"."project_closure" to "authenticated";
grant truncate on table "public"."project_closure" to "authenticated";
grant update on table "public"."project_closure" to "authenticated";
grant delete on table "public"."project_closure" to "service_role";
grant insert on table "public"."project_closure" to "service_role";
grant references on table "public"."project_closure" to "service_role";
grant select on table "public"."project_closure" to "service_role";
grant trigger on table "public"."project_closure" to "service_role";
grant truncate on table "public"."project_closure" to "service_role";
grant update on table "public"."project_closure" to "service_role";

set check_function_bodies = off;

-- Function to initialize project closure when a project is created
CREATE OR REPLACE FUNCTION public.init_project_closure()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    -- Logging
    RAISE NOTICE '[init_project_closure] Initializing project_closure for project_id: %', NEW.id;

    INSERT INTO project_closure (project_id)
    VALUES (NEW.id)
    ON CONFLICT (project_id) DO NOTHING;
    
    RETURN NEW;
END;
$function$
;

-- Function to update project closure when quest closures change
CREATE OR REPLACE FUNCTION public.update_project_closure_on_quest_closure()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    -- Logging
    RAISE NOTICE '[update_project_closure_on_quest_closure] Updating project_closure for project_id: %, quest_id: %', NEW.project_id, NEW.quest_id;

    -- Ensure project_closure record exists
    INSERT INTO project_closure (project_id)
    VALUES (NEW.project_id)
    ON CONFLICT (project_id) DO NOTHING;

    -- Aggregate all quest closure data for this project
    UPDATE project_closure 
    SET 
        -- Aggregate quest IDs
        quest_ids = (
            SELECT COALESCE(jsonb_agg(DISTINCT qc.quest_id), '[]'::jsonb)
            FROM quest_closure qc
            JOIN quest q ON q.id = qc.quest_id
            WHERE qc.project_id = NEW.project_id AND q.active = true
        ),
        
        -- Aggregate all asset IDs from quest closures
        asset_ids = (
            SELECT COALESCE(jsonb_agg(DISTINCT asset_id), '[]'::jsonb)
            FROM (
                SELECT jsonb_array_elements_text(qc.asset_ids)::uuid as asset_id
                FROM quest_closure qc
                JOIN quest q ON q.id = qc.quest_id
                WHERE qc.project_id = NEW.project_id AND q.active = true
            ) aggregated_assets
        ),
        
        -- Aggregate all translation IDs from quest closures
        translation_ids = (
            SELECT COALESCE(jsonb_agg(DISTINCT translation_id), '[]'::jsonb)
            FROM (
                SELECT jsonb_array_elements_text(qc.translation_ids)::uuid as translation_id
                FROM quest_closure qc
                JOIN quest q ON q.id = qc.quest_id
                WHERE qc.project_id = NEW.project_id AND q.active = true
            ) aggregated_translations
        ),
        
        -- Aggregate all vote IDs from quest closures
        vote_ids = (
            SELECT COALESCE(jsonb_agg(DISTINCT vote_id), '[]'::jsonb)
            FROM (
                SELECT jsonb_array_elements_text(qc.vote_ids)::uuid as vote_id
                FROM quest_closure qc
                JOIN quest q ON q.id = qc.quest_id
                WHERE qc.project_id = NEW.project_id AND q.active = true
            ) aggregated_votes
        ),
        
        -- Aggregate all tag IDs from quest closures
        tag_ids = (
            SELECT COALESCE(jsonb_agg(DISTINCT tag_id), '[]'::jsonb)
            FROM (
                SELECT jsonb_array_elements_text(qc.tag_ids)::uuid as tag_id
                FROM quest_closure qc
                JOIN quest q ON q.id = qc.quest_id
                WHERE qc.project_id = NEW.project_id AND q.active = true
            ) aggregated_tags
        ),
        
        -- Aggregate all language IDs from quest closures
        language_ids = (
            SELECT COALESCE(jsonb_agg(DISTINCT language_id), '[]'::jsonb)
            FROM (
                SELECT jsonb_array_elements_text(qc.language_ids)::uuid as language_id
                FROM quest_closure qc
                JOIN quest q ON q.id = qc.quest_id
                WHERE qc.project_id = NEW.project_id AND q.active = true
            ) aggregated_languages
        ),
        
        -- Aggregate all quest_asset_link IDs from quest closures
        quest_asset_link_ids = (
            SELECT COALESCE(jsonb_agg(DISTINCT link_id), '[]'::jsonb)
            FROM (
                SELECT jsonb_array_elements_text(qc.quest_asset_link_ids) as link_id
                FROM quest_closure qc
                JOIN quest q ON q.id = qc.quest_id
                WHERE qc.project_id = NEW.project_id AND q.active = true
            ) aggregated_quest_asset_links
        ),
        
        -- Aggregate all asset_content_link IDs from quest closures
        asset_content_link_ids = (
            SELECT COALESCE(jsonb_agg(DISTINCT link_id), '[]'::jsonb)
            FROM (
                SELECT jsonb_array_elements_text(qc.asset_content_link_ids)::uuid as link_id
                FROM quest_closure qc
                JOIN quest q ON q.id = qc.quest_id
                WHERE qc.project_id = NEW.project_id AND q.active = true
            ) aggregated_asset_content_links
        ),
        
        -- Aggregate all quest_tag_link IDs from quest closures
        quest_tag_link_ids = (
            SELECT COALESCE(jsonb_agg(DISTINCT link_id), '[]'::jsonb)
            FROM (
                SELECT jsonb_array_elements_text(qc.quest_tag_link_ids) as link_id
                FROM quest_closure qc
                JOIN quest q ON q.id = qc.quest_id
                WHERE qc.project_id = NEW.project_id AND q.active = true
            ) aggregated_quest_tag_links
        ),
        
        -- Aggregate all asset_tag_link IDs from quest closures
        asset_tag_link_ids = (
            SELECT COALESCE(jsonb_agg(DISTINCT link_id), '[]'::jsonb)
            FROM (
                SELECT jsonb_array_elements_text(qc.asset_tag_link_ids) as link_id
                FROM quest_closure qc
                JOIN quest q ON q.id = qc.quest_id
                WHERE qc.project_id = NEW.project_id AND q.active = true
            ) aggregated_asset_tag_links
        ),
        
        -- Aggregate counts
        total_quests = (
            SELECT COUNT(DISTINCT qc.quest_id)
            FROM quest_closure qc
            JOIN quest q ON q.id = qc.quest_id
            WHERE qc.project_id = NEW.project_id AND q.active = true
        ),
        
        total_assets = (
            SELECT COALESCE(SUM(qc.total_assets), 0)
            FROM quest_closure qc
            JOIN quest q ON q.id = qc.quest_id
            WHERE qc.project_id = NEW.project_id AND q.active = true
        ),
        
        total_translations = (
            SELECT COALESCE(SUM(qc.total_translations), 0)
            FROM quest_closure qc
            JOIN quest q ON q.id = qc.quest_id
            WHERE qc.project_id = NEW.project_id AND q.active = true
        ),
        
        approved_translations = (
            SELECT COALESCE(SUM(qc.approved_translations), 0)
            FROM quest_closure qc
            JOIN quest q ON q.id = qc.quest_id
            WHERE qc.project_id = NEW.project_id AND q.active = true
        ),
        
        last_updated = NOW()
    WHERE project_id = NEW.project_id;

    -- Logging
    RAISE NOTICE '[update_project_closure_on_quest_closure] Updated project_closure for project_id: %', NEW.project_id;
    
    RETURN NEW;
END;
$function$
;

-- Function to download a complete project using the project closure
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
    SELECT 'project_closure'::TEXT, project_closures_updated;
END;
$function$
;

-- Function to create missing project closures
CREATE OR REPLACE FUNCTION public.create_missing_project_closures()
 RETURNS TABLE(project_id uuid, created boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RAISE NOTICE '[create_missing_project_closures] Starting creation of missing project_closure records';

    -- Create missing project_closure records for all projects that don't have them
    INSERT INTO project_closure (project_id)
    SELECT p.id
    FROM project p
    LEFT JOIN project_closure pc ON pc.project_id = p.id
    WHERE pc.project_id IS NULL
    ON CONFLICT (project_id) DO NOTHING;

    -- Return what was created
    RETURN QUERY
    SELECT p.id, (pc.project_id IS NOT NULL) as created
    FROM project p
    LEFT JOIN project_closure pc ON pc.project_id = p.id
    WHERE pc.last_updated >= NOW() - INTERVAL '1 minute'; -- Recently created

    RAISE NOTICE '[create_missing_project_closures] Completed creation of missing project_closure records';
END;
$function$
;

-- Function to rebuild a single project closure
CREATE OR REPLACE FUNCTION public.rebuild_single_project_closure(project_id_param uuid)
 RETURNS TABLE(result_project_id uuid, result_total_quests integer, result_total_assets integer, result_total_translations integer, result_approved_translations integer, result_processing_time_ms bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    processing_time_ms BIGINT;
BEGIN
    start_time := NOW();
    
    RAISE NOTICE '[rebuild_single_project_closure] Starting rebuild for project_id: %', project_id_param;
    
    -- Ensure project_closure record exists
    INSERT INTO project_closure (project_id)
    VALUES (project_id_param)
    ON CONFLICT (project_id) DO NOTHING;
    
    -- Trigger the update function which will rebuild everything
    UPDATE project_closure 
    SET last_updated = NOW()
    WHERE project_id = project_id_param;
    
    -- Call our update function to rebuild the closure
    UPDATE project_closure pc
    SET 
        quest_ids = (
            SELECT COALESCE(jsonb_agg(DISTINCT qc.quest_id), '[]'::jsonb)
            FROM quest_closure qc
            JOIN quest q ON q.id = qc.quest_id
            WHERE qc.project_id = project_id_param AND q.active = true
        ),
        asset_ids = (
            SELECT COALESCE(jsonb_agg(DISTINCT asset_id), '[]'::jsonb)
            FROM (
                SELECT jsonb_array_elements_text(qc.asset_ids)::uuid as asset_id
                FROM quest_closure qc
                JOIN quest q ON q.id = qc.quest_id
                WHERE qc.project_id = project_id_param AND q.active = true
            ) aggregated_assets
        ),
        translation_ids = (
            SELECT COALESCE(jsonb_agg(DISTINCT translation_id), '[]'::jsonb)
            FROM (
                SELECT jsonb_array_elements_text(qc.translation_ids)::uuid as translation_id
                FROM quest_closure qc
                JOIN quest q ON q.id = qc.quest_id
                WHERE qc.project_id = project_id_param AND q.active = true
            ) aggregated_translations
        ),
        vote_ids = (
            SELECT COALESCE(jsonb_agg(DISTINCT vote_id), '[]'::jsonb)
            FROM (
                SELECT jsonb_array_elements_text(qc.vote_ids)::uuid as vote_id
                FROM quest_closure qc
                JOIN quest q ON q.id = qc.quest_id
                WHERE qc.project_id = project_id_param AND q.active = true
            ) aggregated_votes
        ),
        tag_ids = (
            SELECT COALESCE(jsonb_agg(DISTINCT tag_id), '[]'::jsonb)
            FROM (
                SELECT jsonb_array_elements_text(qc.tag_ids)::uuid as tag_id
                FROM quest_closure qc
                JOIN quest q ON q.id = qc.quest_id
                WHERE qc.project_id = project_id_param AND q.active = true
            ) aggregated_tags
        ),
        language_ids = (
            SELECT COALESCE(jsonb_agg(DISTINCT language_id), '[]'::jsonb)
            FROM (
                SELECT jsonb_array_elements_text(qc.language_ids)::uuid as language_id
                FROM quest_closure qc
                JOIN quest q ON q.id = qc.quest_id
                WHERE qc.project_id = project_id_param AND q.active = true
            ) aggregated_languages
        ),
        quest_asset_link_ids = (
            SELECT COALESCE(jsonb_agg(DISTINCT link_id), '[]'::jsonb)
            FROM (
                SELECT jsonb_array_elements_text(qc.quest_asset_link_ids) as link_id
                FROM quest_closure qc
                JOIN quest q ON q.id = qc.quest_id
                WHERE qc.project_id = project_id_param AND q.active = true
            ) aggregated_quest_asset_links
        ),
        asset_content_link_ids = (
            SELECT COALESCE(jsonb_agg(DISTINCT link_id), '[]'::jsonb)
            FROM (
                SELECT jsonb_array_elements_text(qc.asset_content_link_ids)::uuid as link_id
                FROM quest_closure qc
                JOIN quest q ON q.id = qc.quest_id
                WHERE qc.project_id = project_id_param AND q.active = true
            ) aggregated_asset_content_links
        ),
        quest_tag_link_ids = (
            SELECT COALESCE(jsonb_agg(DISTINCT link_id), '[]'::jsonb)
            FROM (
                SELECT jsonb_array_elements_text(qc.quest_tag_link_ids) as link_id
                FROM quest_closure qc
                JOIN quest q ON q.id = qc.quest_id
                WHERE qc.project_id = project_id_param AND q.active = true
            ) aggregated_quest_tag_links
        ),
        asset_tag_link_ids = (
            SELECT COALESCE(jsonb_agg(DISTINCT link_id), '[]'::jsonb)
            FROM (
                SELECT jsonb_array_elements_text(qc.asset_tag_link_ids) as link_id
                FROM quest_closure qc
                JOIN quest q ON q.id = qc.quest_id
                WHERE qc.project_id = project_id_param AND q.active = true
            ) aggregated_asset_tag_links
        ),
        total_quests = (
            SELECT COUNT(DISTINCT qc.quest_id)
            FROM quest_closure qc
            JOIN quest q ON q.id = qc.quest_id
            WHERE qc.project_id = project_id_param AND q.active = true
        ),
        total_assets = (
            SELECT COALESCE(SUM(qc.total_assets), 0)
            FROM quest_closure qc
            JOIN quest q ON q.id = qc.quest_id
            WHERE qc.project_id = project_id_param AND q.active = true
        ),
        total_translations = (
            SELECT COALESCE(SUM(qc.total_translations), 0)
            FROM quest_closure qc
            JOIN quest q ON q.id = qc.quest_id
            WHERE qc.project_id = project_id_param AND q.active = true
        ),
        approved_translations = (
            SELECT COALESCE(SUM(qc.approved_translations), 0)
            FROM quest_closure qc
            JOIN quest q ON q.id = qc.quest_id
            WHERE qc.project_id = project_id_param AND q.active = true
        ),
        last_updated = NOW()
    WHERE pc.project_id = project_id_param;
    
    end_time := NOW();
    processing_time_ms := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    
    RAISE NOTICE '[rebuild_single_project_closure] Completed rebuild for project_id: % in % ms', project_id_param, processing_time_ms;
    
    -- Return the rebuilt closure info
    RETURN QUERY
    SELECT 
        pc.project_id,
        pc.total_quests,
        pc.total_assets,
        pc.total_translations,
        pc.approved_translations,
        processing_time_ms
    FROM project_closure pc
    WHERE pc.project_id = project_id_param;
END;
$function$
;

-- Create triggers
CREATE TRIGGER init_project_closure_trigger AFTER INSERT ON public.project FOR EACH ROW EXECUTE FUNCTION init_project_closure();
-- Recreate trigger to only fire on content changes, not download_profiles changes
-- The quest_closure table doesn't have download_profiles, so we fire on last_updated changes
-- which indicate actual content changes (not just download operations)
CREATE TRIGGER update_project_closure_on_quest_closure_trigger 
AFTER INSERT OR UPDATE OF quest_id, project_id, asset_ids, translation_ids, vote_ids, tag_ids, language_ids, quest_asset_link_ids, asset_content_link_ids, quest_tag_link_ids, asset_tag_link_ids, total_assets, total_translations, approved_translations
ON public.quest_closure 
FOR EACH ROW 
EXECUTE FUNCTION update_project_closure_on_quest_closure(); 