create table "public"."quest_aggregates" (
    "quest_id" uuid not null,
    "project_id" uuid not null,
    "total_assets" integer not null default 0,
    "total_translations" integer not null default 0,
    "approved_translations" integer not null default 0,
    "last_updated" timestamp with time zone not null default now()
);


create table "public"."quest_closure" (
    "quest_id" uuid not null,
    "project_id" uuid not null,
    "asset_ids" jsonb default '[]'::jsonb,
    "translation_ids" jsonb default '[]'::jsonb,
    "vote_ids" jsonb default '[]'::jsonb,
    "tag_ids" jsonb default '[]'::jsonb,
    "language_ids" jsonb default '[]'::jsonb,
    "quest_asset_link_ids" jsonb default '[]'::jsonb,
    "asset_content_link_ids" jsonb default '[]'::jsonb,
    "quest_tag_link_ids" jsonb default '[]'::jsonb,
    "asset_tag_link_ids" jsonb default '[]'::jsonb,
    "total_assets" integer not null default 0,
    "total_translations" integer not null default 0,
    "approved_translations" integer not null default 0,
    "last_updated" timestamp with time zone not null default now()
);


CREATE INDEX quest_aggregates_last_updated_idx ON public.quest_aggregates USING btree (last_updated);

CREATE UNIQUE INDEX quest_aggregates_pkey ON public.quest_aggregates USING btree (quest_id);

CREATE INDEX quest_aggregates_project_id_idx ON public.quest_aggregates USING btree (project_id);

CREATE INDEX quest_closure_last_updated_idx ON public.quest_closure USING btree (last_updated);

CREATE UNIQUE INDEX quest_closure_pkey ON public.quest_closure USING btree (quest_id);

CREATE INDEX quest_closure_project_id_idx ON public.quest_closure USING btree (project_id);

alter table "public"."quest_aggregates" add constraint "quest_aggregates_pkey" PRIMARY KEY using index "quest_aggregates_pkey";

alter table "public"."quest_closure" add constraint "quest_closure_pkey" PRIMARY KEY using index "quest_closure_pkey";

alter table "public"."quest_aggregates" add constraint "quest_aggregates_project_id_fkey" FOREIGN KEY (project_id) REFERENCES project(id) not valid;

alter table "public"."quest_aggregates" validate constraint "quest_aggregates_project_id_fkey";

alter table "public"."quest_aggregates" add constraint "quest_aggregates_quest_id_fkey" FOREIGN KEY (quest_id) REFERENCES quest(id) not valid;

alter table "public"."quest_aggregates" validate constraint "quest_aggregates_quest_id_fkey";

alter table "public"."quest_closure" add constraint "quest_closure_project_id_fkey" FOREIGN KEY (project_id) REFERENCES project(id) not valid;

alter table "public"."quest_closure" validate constraint "quest_closure_project_id_fkey";

alter table "public"."quest_closure" add constraint "quest_closure_quest_id_fkey" FOREIGN KEY (quest_id) REFERENCES quest(id) not valid;

alter table "public"."quest_closure" validate constraint "quest_closure_quest_id_fkey";

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

CREATE OR REPLACE FUNCTION public.init_quest_closure()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    -- Logging
    RAISE NOTICE '[init_quest_closure] Initializing quest_closure for quest_id: %, project_id: %', NEW.id, NEW.project_id;

    INSERT INTO quest_closure (quest_id, project_id)
    VALUES (NEW.id, NEW.project_id);
    
    RETURN NEW;
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

CREATE OR REPLACE FUNCTION public.update_quest_closure_on_translation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    affected_quest_ids UUID[];
BEGIN
    IF NEW.active = true THEN
        -- Logging
        RAISE NOTICE '[update_quest_closure_on_translation] Updating quest_closure for translation_id: %, asset_id: %', NEW.id, NEW.asset_id;

        -- Get all quest IDs that could be affected
        SELECT ARRAY(
            SELECT qal.quest_id 
            FROM quest_asset_link qal 
            WHERE qal.asset_id = NEW.asset_id AND qal.active = true
        ) INTO affected_quest_ids;

        -- Ensure quest_closure records exist for all affected quests
        INSERT INTO quest_closure (quest_id, project_id)
        SELECT q.id, q.project_id
        FROM quest q
        WHERE q.id = ANY(affected_quest_ids)
        ON CONFLICT (quest_id) DO NOTHING;

        -- Log if we created any missing closures
        IF FOUND THEN
            RAISE NOTICE '[update_quest_closure_on_translation] Created missing quest_closure records for affected quests';
        END IF;

        UPDATE quest_closure 
        SET 
            translation_ids = CASE 
                WHEN translation_ids ? NEW.id::text THEN translation_ids
                ELSE translation_ids || jsonb_build_array(NEW.id)
            END,
            -- Refresh language IDs (target languages may have changed)
            language_ids = (
                SELECT COALESCE(jsonb_agg(DISTINCT lang_id), '[]'::jsonb)
                FROM (
                    -- Source languages from assets
                    SELECT a.source_language_id as lang_id
                    FROM asset a
                    JOIN quest_asset_link qal ON qal.asset_id = a.id
                    WHERE qal.quest_id = quest_closure.quest_id AND qal.active = true AND a.active = true
                    
                    UNION
                    
                    -- Target languages from translations  
                    SELECT t.target_language_id as lang_id
                    FROM translation t
                    JOIN quest_asset_link qal ON qal.asset_id = t.asset_id
                    WHERE qal.quest_id = quest_closure.quest_id AND qal.active = true AND t.active = true
                    
                    UNION
                    
                    -- Project source/target languages
                    SELECT p.source_language_id as lang_id
                    FROM project p
                    JOIN quest q ON q.project_id = p.id
                    WHERE q.id = quest_closure.quest_id
                    
                    UNION
                    
                    SELECT p.target_language_id as lang_id  
                    FROM project p
                    JOIN quest q ON q.project_id = p.id
                    WHERE q.id = quest_closure.quest_id
                ) unique_languages
            ),
            -- Recompute translation counts
            total_translations = (
                SELECT COUNT(DISTINCT t.id)
                FROM translation t
                JOIN quest_asset_link qal ON qal.asset_id = t.asset_id
                WHERE qal.quest_id = quest_closure.quest_id 
                AND qal.active = true AND t.active = true
            ),
            approved_translations = (
                SELECT COUNT(DISTINCT t.id)
                FROM translation t
                JOIN quest_asset_link qal ON qal.asset_id = t.asset_id
                JOIN vote v ON v.translation_id = t.id AND v.polarity = 'up' AND v.active = true
                WHERE qal.quest_id = quest_closure.quest_id 
                AND qal.active = true AND t.active = true
            ),
            last_updated = NOW()
        WHERE quest_id = ANY(affected_quest_ids);

        -- Logging
        RAISE NOTICE '[update_quest_closure_on_translation] Updated translation_ids, language_ids, total_translations, approved_translations for % quests', array_length(affected_quest_ids, 1);
    END IF;
    
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_quest_closure_on_vote()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    affected_quest_ids UUID[];
BEGIN
    IF NEW.active = true THEN
        -- Logging
        RAISE NOTICE '[update_quest_closure_on_vote] Updating quest_closure for vote_id: %, translation_id: %', NEW.id, NEW.translation_id;

        -- Get all quest IDs that could be affected
        SELECT ARRAY(
            SELECT qal.quest_id 
            FROM quest_asset_link qal 
            JOIN translation t ON t.asset_id = qal.asset_id
            WHERE t.id = NEW.translation_id AND qal.active = true AND t.active = true
        ) INTO affected_quest_ids;

        -- Ensure quest_closure records exist for all affected quests
        INSERT INTO quest_closure (quest_id, project_id)
        SELECT q.id, q.project_id
        FROM quest q
        WHERE q.id = ANY(affected_quest_ids)
        ON CONFLICT (quest_id) DO NOTHING;

        -- Log if we created any missing closures
        IF FOUND THEN
            RAISE NOTICE '[update_quest_closure_on_vote] Created missing quest_closure records for affected quests';
        END IF;

        UPDATE quest_closure 
        SET 
            vote_ids = CASE 
                WHEN vote_ids ? NEW.id::text THEN vote_ids
                ELSE vote_ids || jsonb_build_array(NEW.id)
            END,
            -- Recompute approved translations count
            approved_translations = (
                SELECT COUNT(DISTINCT t.id)
                FROM translation t
                JOIN quest_asset_link qal ON qal.asset_id = t.asset_id
                JOIN vote v ON v.translation_id = t.id AND v.polarity = 'up' AND v.active = true
                WHERE qal.quest_id = quest_closure.quest_id 
                AND qal.active = true AND t.active = true
            ),
            last_updated = NOW()
        WHERE quest_id = ANY(affected_quest_ids);

        -- Logging
        RAISE NOTICE '[update_quest_closure_on_vote] Updated vote_ids, approved_translations for % quests', array_length(affected_quest_ids, 1);
    END IF;
    
    RETURN NEW;
END;
$function$
;

grant delete on table "public"."quest_aggregates" to "anon";

grant insert on table "public"."quest_aggregates" to "anon";

grant references on table "public"."quest_aggregates" to "anon";

grant select on table "public"."quest_aggregates" to "anon";

grant trigger on table "public"."quest_aggregates" to "anon";

grant truncate on table "public"."quest_aggregates" to "anon";

grant update on table "public"."quest_aggregates" to "anon";

grant delete on table "public"."quest_aggregates" to "authenticated";

grant insert on table "public"."quest_aggregates" to "authenticated";

grant references on table "public"."quest_aggregates" to "authenticated";

grant select on table "public"."quest_aggregates" to "authenticated";

grant trigger on table "public"."quest_aggregates" to "authenticated";

grant truncate on table "public"."quest_aggregates" to "authenticated";

grant update on table "public"."quest_aggregates" to "authenticated";

grant delete on table "public"."quest_aggregates" to "service_role";

grant insert on table "public"."quest_aggregates" to "service_role";

grant references on table "public"."quest_aggregates" to "service_role";

grant select on table "public"."quest_aggregates" to "service_role";

grant trigger on table "public"."quest_aggregates" to "service_role";

grant truncate on table "public"."quest_aggregates" to "service_role";

grant update on table "public"."quest_aggregates" to "service_role";

grant delete on table "public"."quest_closure" to "anon";

grant insert on table "public"."quest_closure" to "anon";

grant references on table "public"."quest_closure" to "anon";

grant select on table "public"."quest_closure" to "anon";

grant trigger on table "public"."quest_closure" to "anon";

grant truncate on table "public"."quest_closure" to "anon";

grant update on table "public"."quest_closure" to "anon";

grant delete on table "public"."quest_closure" to "authenticated";

grant insert on table "public"."quest_closure" to "authenticated";

grant references on table "public"."quest_closure" to "authenticated";

grant select on table "public"."quest_closure" to "authenticated";

grant trigger on table "public"."quest_closure" to "authenticated";

grant truncate on table "public"."quest_closure" to "authenticated";

grant update on table "public"."quest_closure" to "authenticated";

grant delete on table "public"."quest_closure" to "service_role";

grant insert on table "public"."quest_closure" to "service_role";

grant references on table "public"."quest_closure" to "service_role";

grant select on table "public"."quest_closure" to "service_role";

grant trigger on table "public"."quest_closure" to "service_role";

grant truncate on table "public"."quest_closure" to "service_role";

grant update on table "public"."quest_closure" to "service_role";

CREATE TRIGGER init_quest_closure_trigger AFTER INSERT ON public.quest FOR EACH ROW EXECUTE FUNCTION init_quest_closure();

CREATE TRIGGER update_quest_closure_on_asset_link_trigger AFTER INSERT OR UPDATE ON public.quest_asset_link FOR EACH ROW EXECUTE FUNCTION update_quest_closure_on_asset_link();

CREATE TRIGGER update_quest_closure_on_translation_trigger AFTER INSERT OR UPDATE ON public.translation FOR EACH ROW EXECUTE FUNCTION update_quest_closure_on_translation();

CREATE TRIGGER update_quest_closure_on_vote_trigger AFTER INSERT OR UPDATE ON public.vote FOR EACH ROW EXECUTE FUNCTION update_quest_closure_on_vote();


