-- ============================================================================
-- Migration: Add languoid tables to download closure functions
-- ============================================================================
--
-- PURPOSE:
-- Updates download_quest_closure and download_project_closure functions to
-- include languoid and related tables (languoid_source, languoid_alias,
-- languoid_property, languoid_region, region, region_alias, region_source,
-- region_property) in download_profiles updates.
--
-- AFFECTED FUNCTIONS:
-- - download_quest_closure
-- - download_project_closure
--
-- BACKGROUND:
-- Previously, these functions only updated the legacy "language" table.
-- With the migration to languoids (~30k records across multiple tables),
-- we now need to update languoid-related tables so they sync to the user's
-- device when they download a project or quest.
--
-- ============================================================================

set search_path = public;

-- ============================================================================
-- 1. Update download_quest_closure to include languoid tables
-- ============================================================================

create or replace function public.download_quest_closure(
  quest_id_param uuid,
  profile_id_param uuid
)
returns table(table_name text, records_updated integer)
language plpgsql
security definer
as $$
declare
    closure_record quest_closure%ROWTYPE;
    projects_updated integer := 0;
    assets_updated integer := 0;
    translations_updated integer := 0;
    votes_updated integer := 0;
    tags_updated integer := 0;
    languages_updated integer := 0;
    languages_from_pll_updated integer := 0;
    languages_from_acl_updated integer := 0;
    project_language_links_updated integer := 0;
    quest_asset_links_updated integer := 0;
    asset_content_links_updated integer := 0;
    quest_tag_links_updated integer := 0;
    asset_tag_links_updated integer := 0;
    quests_updated integer := 0;
    quest_closures_updated integer := 0;
    project_closures_updated integer := 0;
    -- New counters for languoid tables
    languoids_updated integer := 0;
    languoid_aliases_updated integer := 0;
    languoid_sources_updated integer := 0;
    languoid_properties_updated integer := 0;
    languoid_regions_updated integer := 0;
    regions_updated integer := 0;
    region_aliases_updated integer := 0;
    region_sources_updated integer := 0;
    region_properties_updated integer := 0;
begin
    -- Logging
    raise notice '[download_quest_closure] Starting for quest_id: %, profile_id: %', quest_id_param, profile_id_param;

    -- Get the complete closure record
    select * into closure_record 
    from quest_closure 
    where quest_id = quest_id_param;
    
    if closure_record.quest_id is null then
        raise exception 'Quest closure not found for quest_id: %', quest_id_param;
    end if;
    
    -- Update project (parent of the quest)
    update project 
    set download_profiles = case 
        when download_profiles @> array[profile_id_param] then download_profiles
        else array_append(coalesce(download_profiles, '{}'), profile_id_param)
    end
    where id = closure_record.project_id;
    get diagnostics projects_updated = row_count;
    raise notice '[download_quest_closure] Updated project: % rows', projects_updated;
    
    -- Update assets
    update asset 
    set download_profiles = case 
        when download_profiles @> array[profile_id_param] then download_profiles
        else array_append(coalesce(download_profiles, '{}'), profile_id_param)
    end
    where id = any(array(select (jsonb_array_elements_text(closure_record.asset_ids))::uuid));
    get diagnostics assets_updated = row_count;
    raise notice '[download_quest_closure] Updated assets: % rows', assets_updated;
    
    -- Update translations
    update translation 
    set download_profiles = case 
        when download_profiles @> array[profile_id_param] then download_profiles
        else array_append(coalesce(download_profiles, '{}'), profile_id_param)
    end
    where id = any(array(select (jsonb_array_elements_text(closure_record.translation_ids))::uuid));
    get diagnostics translations_updated = row_count;
    raise notice '[download_quest_closure] Updated translations: % rows', translations_updated;
    
    -- Update votes
    update vote 
    set download_profiles = case 
        when download_profiles @> array[profile_id_param] then download_profiles
        else array_append(coalesce(download_profiles, '{}'), profile_id_param)
    end
    where id = any(array(select (jsonb_array_elements_text(closure_record.vote_ids))::uuid));
    get diagnostics votes_updated = row_count;
    raise notice '[download_quest_closure] Updated votes: % rows', votes_updated;
    
    -- Update tags
    update tag 
    set download_profiles = case 
        when download_profiles @> array[profile_id_param] then download_profiles
        else array_append(coalesce(download_profiles, '{}'), profile_id_param)
    end
    where id = any(array(select (jsonb_array_elements_text(closure_record.tag_ids))::uuid));
    get diagnostics tags_updated = row_count;
    raise notice '[download_quest_closure] Updated tags: % rows', tags_updated;
    
    -- Update languages (legacy)
    update language 
    set download_profiles = case 
        when download_profiles @> array[profile_id_param] then download_profiles
        else array_append(coalesce(download_profiles, '{}'), profile_id_param)
    end
    where id = any(array(select (jsonb_array_elements_text(closure_record.language_ids))::uuid));
    get diagnostics languages_updated = row_count;
    raise notice '[download_quest_closure] Updated languages: % rows', languages_updated;

    -- Update project_language_link for the project being downloaded
    update project_language_link 
    set download_profiles = case 
        when download_profiles @> array[profile_id_param] then download_profiles
        else array_append(coalesce(download_profiles, '{}'), profile_id_param)
    end
    where project_id = closure_record.project_id
      and active = true;
    get diagnostics project_language_links_updated = row_count;
    raise notice '[download_quest_closure] Updated project_language_link: % rows', project_language_links_updated;
    
    -- Ensure languages referenced by project_language_link are downloaded (legacy)
    update language l
    set download_profiles = case 
        when l.download_profiles @> array[profile_id_param] then l.download_profiles
        else array_append(coalesce(l.download_profiles, '{}'), profile_id_param)
    end
    where l.id in (
      select pll.language_id
      from project_language_link pll
      where pll.project_id = closure_record.project_id
        and pll.active = true
        and pll.language_id is not null
    );
    get diagnostics languages_from_pll_updated = row_count;
    raise notice '[download_quest_closure] Updated languages from project_language_link: % rows', languages_from_pll_updated;

    -- ============================================================================
    -- NEW: Update languoid tables for languoids referenced by project_language_link
    -- ============================================================================
    
    -- Update languoid records
    update languoid lo
    set download_profiles = case 
        when lo.download_profiles @> array[profile_id_param] then lo.download_profiles
        else array_append(coalesce(lo.download_profiles, '{}'), profile_id_param)
    end
    where lo.id in (
      select pll.languoid_id
      from project_language_link pll
      where pll.project_id = closure_record.project_id
        and pll.active = true
        and pll.languoid_id is not null
    );
    get diagnostics languoids_updated = row_count;
    raise notice '[download_quest_closure] Updated languoids from project_language_link: % rows', languoids_updated;
    
    -- Update languoid_alias records for the languoids
    update languoid_alias la
    set download_profiles = case 
        when la.download_profiles @> array[profile_id_param] then la.download_profiles
        else array_append(coalesce(la.download_profiles, '{}'), profile_id_param)
    end
    where la.subject_languoid_id in (
      select pll.languoid_id
      from project_language_link pll
      where pll.project_id = closure_record.project_id
        and pll.active = true
        and pll.languoid_id is not null
    );
    get diagnostics languoid_aliases_updated = row_count;
    raise notice '[download_quest_closure] Updated languoid_alias: % rows', languoid_aliases_updated;
    
    -- Update languoid_source records for the languoids
    update languoid_source ls
    set download_profiles = case 
        when ls.download_profiles @> array[profile_id_param] then ls.download_profiles
        else array_append(coalesce(ls.download_profiles, '{}'), profile_id_param)
    end
    where ls.languoid_id in (
      select pll.languoid_id
      from project_language_link pll
      where pll.project_id = closure_record.project_id
        and pll.active = true
        and pll.languoid_id is not null
    );
    get diagnostics languoid_sources_updated = row_count;
    raise notice '[download_quest_closure] Updated languoid_source: % rows', languoid_sources_updated;
    
    -- Update languoid_property records for the languoids
    update languoid_property lp
    set download_profiles = case 
        when lp.download_profiles @> array[profile_id_param] then lp.download_profiles
        else array_append(coalesce(lp.download_profiles, '{}'), profile_id_param)
    end
    where lp.languoid_id in (
      select pll.languoid_id
      from project_language_link pll
      where pll.project_id = closure_record.project_id
        and pll.active = true
        and pll.languoid_id is not null
    );
    get diagnostics languoid_properties_updated = row_count;
    raise notice '[download_quest_closure] Updated languoid_property: % rows', languoid_properties_updated;
    
    -- Update languoid_region records for the languoids
    update languoid_region lr
    set download_profiles = case 
        when lr.download_profiles @> array[profile_id_param] then lr.download_profiles
        else array_append(coalesce(lr.download_profiles, '{}'), profile_id_param)
    end
    where lr.languoid_id in (
      select pll.languoid_id
      from project_language_link pll
      where pll.project_id = closure_record.project_id
        and pll.active = true
        and pll.languoid_id is not null
    );
    get diagnostics languoid_regions_updated = row_count;
    raise notice '[download_quest_closure] Updated languoid_region: % rows', languoid_regions_updated;
    
    -- Update region records linked to the languoids
    update region r
    set download_profiles = case 
        when r.download_profiles @> array[profile_id_param] then r.download_profiles
        else array_append(coalesce(r.download_profiles, '{}'), profile_id_param)
    end
    where r.id in (
      select lr.region_id
      from languoid_region lr
      where lr.languoid_id in (
        select pll.languoid_id
        from project_language_link pll
        where pll.project_id = closure_record.project_id
          and pll.active = true
          and pll.languoid_id is not null
      )
    );
    get diagnostics regions_updated = row_count;
    raise notice '[download_quest_closure] Updated region: % rows', regions_updated;
    
    -- Update region_alias records for the regions
    update region_alias ra
    set download_profiles = case 
        when ra.download_profiles @> array[profile_id_param] then ra.download_profiles
        else array_append(coalesce(ra.download_profiles, '{}'), profile_id_param)
    end
    where ra.subject_region_id in (
      select lr.region_id
      from languoid_region lr
      where lr.languoid_id in (
        select pll.languoid_id
        from project_language_link pll
        where pll.project_id = closure_record.project_id
          and pll.active = true
          and pll.languoid_id is not null
      )
    );
    get diagnostics region_aliases_updated = row_count;
    raise notice '[download_quest_closure] Updated region_alias: % rows', region_aliases_updated;
    
    -- Update region_source records for the regions
    update region_source rs
    set download_profiles = case 
        when rs.download_profiles @> array[profile_id_param] then rs.download_profiles
        else array_append(coalesce(rs.download_profiles, '{}'), profile_id_param)
    end
    where rs.region_id in (
      select lr.region_id
      from languoid_region lr
      where lr.languoid_id in (
        select pll.languoid_id
        from project_language_link pll
        where pll.project_id = closure_record.project_id
          and pll.active = true
          and pll.languoid_id is not null
      )
    );
    get diagnostics region_sources_updated = row_count;
    raise notice '[download_quest_closure] Updated region_source: % rows', region_sources_updated;
    
    -- Update region_property records for the regions
    update region_property rp
    set download_profiles = case 
        when rp.download_profiles @> array[profile_id_param] then rp.download_profiles
        else array_append(coalesce(rp.download_profiles, '{}'), profile_id_param)
    end
    where rp.region_id in (
      select lr.region_id
      from languoid_region lr
      where lr.languoid_id in (
        select pll.languoid_id
        from project_language_link pll
        where pll.project_id = closure_record.project_id
          and pll.active = true
          and pll.languoid_id is not null
      )
    );
    get diagnostics region_properties_updated = row_count;
    raise notice '[download_quest_closure] Updated region_property: % rows', region_properties_updated;
    
    -- ============================================================================
    -- Also update languoids referenced by asset_content_link
    -- ============================================================================
    
    -- Update languoid records from asset_content_link
    update languoid lo
    set download_profiles = case 
        when lo.download_profiles @> array[profile_id_param] then lo.download_profiles
        else array_append(coalesce(lo.download_profiles, '{}'), profile_id_param)
    end
    where lo.id in (
      select distinct acl.languoid_id
      from asset_content_link acl
      where acl.id = any(array(select (jsonb_array_elements_text(closure_record.asset_content_link_ids))::uuid))
        and acl.languoid_id is not null
        and acl.active = true
    );
    -- Note: This adds to the existing count
    
    -- Update languoid_source for languoids from asset_content_link
    update languoid_source ls
    set download_profiles = case 
        when ls.download_profiles @> array[profile_id_param] then ls.download_profiles
        else array_append(coalesce(ls.download_profiles, '{}'), profile_id_param)
    end
    where ls.languoid_id in (
      select distinct acl.languoid_id
      from asset_content_link acl
      where acl.id = any(array(select (jsonb_array_elements_text(closure_record.asset_content_link_ids))::uuid))
        and acl.languoid_id is not null
        and acl.active = true
    );
    
    -- ============================================================================
    -- Continue with original updates
    -- ============================================================================
    
    -- Ensure languages referenced by asset_content_link.source_language_id are downloaded
    update language l
    set download_profiles = case 
        when l.download_profiles @> array[profile_id_param] then l.download_profiles
        else array_append(coalesce(l.download_profiles, '{}'), profile_id_param)
    end
    where l.id in (
      select distinct acl.source_language_id
      from asset_content_link acl
      where acl.id = any(array(select (jsonb_array_elements_text(closure_record.asset_content_link_ids))::uuid))
        and acl.source_language_id is not null
        and acl.active = true
    );
    get diagnostics languages_from_acl_updated = row_count;
    raise notice '[download_quest_closure] Updated languages from asset_content_link: % rows', languages_from_acl_updated;
    
    -- Update quest_asset_link (using composite key quest_id + asset_id)
    update quest_asset_link 
    set download_profiles = case 
        when download_profiles @> array[profile_id_param] then download_profiles
        else array_append(coalesce(download_profiles, '{}'), profile_id_param)
    end
    where quest_id = quest_id_param 
    and asset_id = any(array(select (jsonb_array_elements_text(closure_record.asset_ids))::uuid));
    get diagnostics quest_asset_links_updated = row_count;
    raise notice '[download_quest_closure] Updated quest_asset_links: % rows', quest_asset_links_updated;
    
    -- Update asset_content_link (this has an id column)
    update asset_content_link 
    set download_profiles = case 
        when download_profiles @> array[profile_id_param] then download_profiles
        else array_append(coalesce(download_profiles, '{}'), profile_id_param)
    end
    where id = any(array(select (jsonb_array_elements_text(closure_record.asset_content_link_ids))::uuid));
    get diagnostics asset_content_links_updated = row_count;
    raise notice '[download_quest_closure] Updated asset_content_links: % rows', asset_content_links_updated;
    
    -- Update quest_tag_link (using composite key quest_id + tag_id)
    update quest_tag_link 
    set download_profiles = case 
        when download_profiles @> array[profile_id_param] then download_profiles
        else array_append(coalesce(download_profiles, '{}'), profile_id_param)
    end
    where quest_id = quest_id_param
    and tag_id = any(array(select (jsonb_array_elements_text(closure_record.tag_ids))::uuid));
    get diagnostics quest_tag_links_updated = row_count;
    raise notice '[download_quest_closure] Updated quest_tag_links: % rows', quest_tag_links_updated;
    
    -- Update asset_tag_link (using composite key asset_id + tag_id)
    update asset_tag_link 
    set download_profiles = case 
        when download_profiles @> array[profile_id_param] then download_profiles
        else array_append(coalesce(download_profiles, '{}'), profile_id_param)
    end
    where asset_id = any(array(select (jsonb_array_elements_text(closure_record.asset_ids))::uuid))
    and tag_id = any(array(select (jsonb_array_elements_text(closure_record.tag_ids))::uuid));
    get diagnostics asset_tag_links_updated = row_count;
    raise notice '[download_quest_closure] Updated asset_tag_links: % rows', asset_tag_links_updated;
    
    -- Update quest itself (using uuid array operators)
    update quest 
    set download_profiles = case 
        when download_profiles @> array[profile_id_param] then download_profiles
        else array_append(coalesce(download_profiles, '{}'), profile_id_param)
    end
    where id = quest_id_param;
    get diagnostics quests_updated = row_count;
    raise notice '[download_quest_closure] Updated quest: % rows', quests_updated;
    
    -- Update the quest closure record itself to include this profile
    update quest_closure 
    set download_profiles = case 
        when download_profiles @> array[profile_id_param] then download_profiles
        else array_append(coalesce(download_profiles, '{}'), profile_id_param)
    end
    where quest_id = quest_id_param;
    get diagnostics quest_closures_updated = row_count;
    raise notice '[download_quest_closure] Updated quest_closure: % rows', quest_closures_updated;
    
    -- Also update the project_closure record to include this profile
    update project_closure 
    set download_profiles = case 
        when download_profiles @> array[profile_id_param] then download_profiles
        else array_append(coalesce(download_profiles, '{}'), profile_id_param)
    end
    where project_id = closure_record.project_id;
    get diagnostics project_closures_updated = row_count;
    raise notice '[download_quest_closure] Updated project_closure: % rows', project_closures_updated;
    
    -- Logging
    raise notice '[download_quest_closure] Completed for quest_id: %, profile_id: %. Updated project, % quest_closures total, and project_closure', quest_id_param, profile_id_param, quest_closures_updated;

    -- Return summary of what was updated
    return query
    select 'project'::text, projects_updated
    union all
    select 'quest'::text, quests_updated
    union all
    select 'asset'::text, assets_updated
    union all
    select 'translation'::text, translations_updated
    union all
    select 'vote'::text, votes_updated
    union all
    select 'tag'::text, tags_updated
    union all
    select 'language'::text, languages_updated
    union all
    select 'language_from_pll'::text, languages_from_pll_updated
    union all
    select 'language_from_acl'::text, languages_from_acl_updated
    union all
    select 'project_language_link'::text, project_language_links_updated
    union all
    select 'quest_asset_link'::text, quest_asset_links_updated
    union all
    select 'asset_content_link'::text, asset_content_links_updated
    union all
    select 'quest_tag_link'::text, quest_tag_links_updated
    union all
    select 'asset_tag_link'::text, asset_tag_links_updated
    union all
    select 'quest_closure'::text, quest_closures_updated
    union all
    select 'project_closure'::text, project_closures_updated
    union all
    -- New languoid-related tables
    select 'languoid'::text, languoids_updated
    union all
    select 'languoid_alias'::text, languoid_aliases_updated
    union all
    select 'languoid_source'::text, languoid_sources_updated
    union all
    select 'languoid_property'::text, languoid_properties_updated
    union all
    select 'languoid_region'::text, languoid_regions_updated
    union all
    select 'region'::text, regions_updated
    union all
    select 'region_alias'::text, region_aliases_updated
    union all
    select 'region_source'::text, region_sources_updated
    union all
    select 'region_property'::text, region_properties_updated;
end;
$$;


-- ============================================================================
-- 2. Update download_project_closure to include languoid tables
-- ============================================================================

create or replace function public.download_project_closure(project_id_param uuid, profile_id_param uuid)
returns table(table_name text, records_updated integer)
language plpgsql
security definer
as $$
declare
    closure_record project_closure%ROWTYPE;
    projects_updated integer := 0;
    quests_updated integer := 0;
    assets_updated integer := 0;
    translations_updated integer := 0;
    votes_updated integer := 0;
    tags_updated integer := 0;
    languages_updated integer := 0;
    quest_asset_links_updated integer := 0;
    asset_content_links_updated integer := 0;
    quest_tag_links_updated integer := 0;
    asset_tag_links_updated integer := 0;
    project_closures_updated integer := 0;
    project_language_links_updated integer := 0;
    -- New counters for languoid tables
    languoids_updated integer := 0;
    languoid_aliases_updated integer := 0;
    languoid_sources_updated integer := 0;
    languoid_properties_updated integer := 0;
    languoid_regions_updated integer := 0;
    regions_updated integer := 0;
    region_aliases_updated integer := 0;
    region_sources_updated integer := 0;
    region_properties_updated integer := 0;
begin
    -- Logging
    raise notice '[download_project_closure] Starting for project_id: %, profile_id: %', project_id_param, profile_id_param;

    -- Get the complete closure record
    select * into closure_record 
    from project_closure 
    where project_id = project_id_param;
    
    if closure_record.project_id is null then
        raise exception 'Project closure not found for project_id: %', project_id_param;
    end if;
    
    -- Update project itself
    update project 
    set download_profiles = case 
        when download_profiles @> array[profile_id_param] then download_profiles
        else array_append(coalesce(download_profiles, '{}'), profile_id_param)
    end
    where id = project_id_param;
    get diagnostics projects_updated = row_count;
    raise notice '[download_project_closure] Updated project: % rows', projects_updated;
    
    -- Update all quests
    update quest 
    set download_profiles = case 
        when download_profiles @> array[profile_id_param] then download_profiles
        else array_append(coalesce(download_profiles, '{}'), profile_id_param)
    end
    where id = any(array(select (jsonb_array_elements_text(closure_record.quest_ids))::uuid));
    get diagnostics quests_updated = row_count;
    raise notice '[download_project_closure] Updated quests: % rows', quests_updated;
    
    -- Update assets
    update asset 
    set download_profiles = case 
        when download_profiles @> array[profile_id_param] then download_profiles
        else array_append(coalesce(download_profiles, '{}'), profile_id_param)
    end
    where id = any(array(select (jsonb_array_elements_text(closure_record.asset_ids))::uuid));
    get diagnostics assets_updated = row_count;
    raise notice '[download_project_closure] Updated assets: % rows', assets_updated;
    
    -- Update translations
    update translation 
    set download_profiles = case 
        when download_profiles @> array[profile_id_param] then download_profiles
        else array_append(coalesce(download_profiles, '{}'), profile_id_param)
    end
    where id = any(array(select (jsonb_array_elements_text(closure_record.translation_ids))::uuid));
    get diagnostics translations_updated = row_count;
    raise notice '[download_project_closure] Updated translations: % rows', translations_updated;
    
    -- Update votes
    update vote 
    set download_profiles = case 
        when download_profiles @> array[profile_id_param] then download_profiles
        else array_append(coalesce(download_profiles, '{}'), profile_id_param)
    end
    where id = any(array(select (jsonb_array_elements_text(closure_record.vote_ids))::uuid));
    get diagnostics votes_updated = row_count;
    raise notice '[download_project_closure] Updated votes: % rows', votes_updated;
    
    -- Update tags
    update tag 
    set download_profiles = case 
        when download_profiles @> array[profile_id_param] then download_profiles
        else array_append(coalesce(download_profiles, '{}'), profile_id_param)
    end
    where id = any(array(select (jsonb_array_elements_text(closure_record.tag_ids))::uuid));
    get diagnostics tags_updated = row_count;
    raise notice '[download_project_closure] Updated tags: % rows', tags_updated;
    
    -- Update languages (legacy)
    update language 
    set download_profiles = case 
        when download_profiles @> array[profile_id_param] then download_profiles
        else array_append(coalesce(download_profiles, '{}'), profile_id_param)
    end
    where id = any(array(select (jsonb_array_elements_text(closure_record.language_ids))::uuid));
    get diagnostics languages_updated = row_count;
    raise notice '[download_project_closure] Updated languages: % rows', languages_updated;
    
    -- Update project_language_link for the project
    update project_language_link
    set download_profiles = case 
        when download_profiles @> array[profile_id_param] then download_profiles
        else array_append(coalesce(download_profiles, '{}'), profile_id_param)
    end
    where project_id = project_id_param
      and active = true;
    get diagnostics project_language_links_updated = row_count;
    raise notice '[download_project_closure] Updated project_language_link: % rows', project_language_links_updated;
    
    -- ============================================================================
    -- NEW: Update languoid tables for languoids referenced by project_language_link
    -- ============================================================================
    
    -- Update languoid records
    update languoid lo
    set download_profiles = case 
        when lo.download_profiles @> array[profile_id_param] then lo.download_profiles
        else array_append(coalesce(lo.download_profiles, '{}'), profile_id_param)
    end
    where lo.id in (
      select pll.languoid_id
      from project_language_link pll
      where pll.project_id = project_id_param
        and pll.active = true
        and pll.languoid_id is not null
    );
    get diagnostics languoids_updated = row_count;
    raise notice '[download_project_closure] Updated languoids from project_language_link: % rows', languoids_updated;
    
    -- Update languoid_alias records for the languoids
    update languoid_alias la
    set download_profiles = case 
        when la.download_profiles @> array[profile_id_param] then la.download_profiles
        else array_append(coalesce(la.download_profiles, '{}'), profile_id_param)
    end
    where la.subject_languoid_id in (
      select pll.languoid_id
      from project_language_link pll
      where pll.project_id = project_id_param
        and pll.active = true
        and pll.languoid_id is not null
    );
    get diagnostics languoid_aliases_updated = row_count;
    raise notice '[download_project_closure] Updated languoid_alias: % rows', languoid_aliases_updated;
    
    -- Update languoid_source records for the languoids
    update languoid_source ls
    set download_profiles = case 
        when ls.download_profiles @> array[profile_id_param] then ls.download_profiles
        else array_append(coalesce(ls.download_profiles, '{}'), profile_id_param)
    end
    where ls.languoid_id in (
      select pll.languoid_id
      from project_language_link pll
      where pll.project_id = project_id_param
        and pll.active = true
        and pll.languoid_id is not null
    );
    get diagnostics languoid_sources_updated = row_count;
    raise notice '[download_project_closure] Updated languoid_source: % rows', languoid_sources_updated;
    
    -- Update languoid_property records for the languoids
    update languoid_property lp
    set download_profiles = case 
        when lp.download_profiles @> array[profile_id_param] then lp.download_profiles
        else array_append(coalesce(lp.download_profiles, '{}'), profile_id_param)
    end
    where lp.languoid_id in (
      select pll.languoid_id
      from project_language_link pll
      where pll.project_id = project_id_param
        and pll.active = true
        and pll.languoid_id is not null
    );
    get diagnostics languoid_properties_updated = row_count;
    raise notice '[download_project_closure] Updated languoid_property: % rows', languoid_properties_updated;
    
    -- Update languoid_region records for the languoids
    update languoid_region lr
    set download_profiles = case 
        when lr.download_profiles @> array[profile_id_param] then lr.download_profiles
        else array_append(coalesce(lr.download_profiles, '{}'), profile_id_param)
    end
    where lr.languoid_id in (
      select pll.languoid_id
      from project_language_link pll
      where pll.project_id = project_id_param
        and pll.active = true
        and pll.languoid_id is not null
    );
    get diagnostics languoid_regions_updated = row_count;
    raise notice '[download_project_closure] Updated languoid_region: % rows', languoid_regions_updated;
    
    -- Update region records linked to the languoids
    update region r
    set download_profiles = case 
        when r.download_profiles @> array[profile_id_param] then r.download_profiles
        else array_append(coalesce(r.download_profiles, '{}'), profile_id_param)
    end
    where r.id in (
      select lr.region_id
      from languoid_region lr
      where lr.languoid_id in (
        select pll.languoid_id
        from project_language_link pll
        where pll.project_id = project_id_param
          and pll.active = true
          and pll.languoid_id is not null
      )
    );
    get diagnostics regions_updated = row_count;
    raise notice '[download_project_closure] Updated region: % rows', regions_updated;
    
    -- Update region_alias records for the regions
    update region_alias ra
    set download_profiles = case 
        when ra.download_profiles @> array[profile_id_param] then ra.download_profiles
        else array_append(coalesce(ra.download_profiles, '{}'), profile_id_param)
    end
    where ra.subject_region_id in (
      select lr.region_id
      from languoid_region lr
      where lr.languoid_id in (
        select pll.languoid_id
        from project_language_link pll
        where pll.project_id = project_id_param
          and pll.active = true
          and pll.languoid_id is not null
      )
    );
    get diagnostics region_aliases_updated = row_count;
    raise notice '[download_project_closure] Updated region_alias: % rows', region_aliases_updated;
    
    -- Update region_source records for the regions
    update region_source rs
    set download_profiles = case 
        when rs.download_profiles @> array[profile_id_param] then rs.download_profiles
        else array_append(coalesce(rs.download_profiles, '{}'), profile_id_param)
    end
    where rs.region_id in (
      select lr.region_id
      from languoid_region lr
      where lr.languoid_id in (
        select pll.languoid_id
        from project_language_link pll
        where pll.project_id = project_id_param
          and pll.active = true
          and pll.languoid_id is not null
      )
    );
    get diagnostics region_sources_updated = row_count;
    raise notice '[download_project_closure] Updated region_source: % rows', region_sources_updated;
    
    -- Update region_property records for the regions
    update region_property rp
    set download_profiles = case 
        when rp.download_profiles @> array[profile_id_param] then rp.download_profiles
        else array_append(coalesce(rp.download_profiles, '{}'), profile_id_param)
    end
    where rp.region_id in (
      select lr.region_id
      from languoid_region lr
      where lr.languoid_id in (
        select pll.languoid_id
        from project_language_link pll
        where pll.project_id = project_id_param
          and pll.active = true
          and pll.languoid_id is not null
      )
    );
    get diagnostics region_properties_updated = row_count;
    raise notice '[download_project_closure] Updated region_property: % rows', region_properties_updated;
    
    -- ============================================================================
    -- Continue with original updates
    -- ============================================================================
    
    -- Update quest_asset_link (these use composite keys stored as strings)
    update quest_asset_link 
    set download_profiles = case 
        when download_profiles @> array[profile_id_param] then download_profiles
        else array_append(coalesce(download_profiles, '{}'), profile_id_param)
    end
    where (quest_id || '-' || asset_id) = any(array(select jsonb_array_elements_text(closure_record.quest_asset_link_ids)));
    get diagnostics quest_asset_links_updated = row_count;
    raise notice '[download_project_closure] Updated quest_asset_links: % rows', quest_asset_links_updated;
    
    -- Update asset_content_link
    update asset_content_link 
    set download_profiles = case 
        when download_profiles @> array[profile_id_param] then download_profiles
        else array_append(coalesce(download_profiles, '{}'), profile_id_param)
    end
    where id = any(array(select (jsonb_array_elements_text(closure_record.asset_content_link_ids))::uuid));
    get diagnostics asset_content_links_updated = row_count;
    raise notice '[download_project_closure] Updated asset_content_links: % rows', asset_content_links_updated;
    
    -- Update quest_tag_link (these use composite keys stored as strings)
    update quest_tag_link 
    set download_profiles = case 
        when download_profiles @> array[profile_id_param] then download_profiles
        else array_append(coalesce(download_profiles, '{}'), profile_id_param)
    end
    where (quest_id || '-' || tag_id) = any(array(select jsonb_array_elements_text(closure_record.quest_tag_link_ids)));
    get diagnostics quest_tag_links_updated = row_count;
    raise notice '[download_project_closure] Updated quest_tag_links: % rows', quest_tag_links_updated;
    
    -- Update asset_tag_link (these use composite keys stored as strings)
    update asset_tag_link 
    set download_profiles = case 
        when download_profiles @> array[profile_id_param] then download_profiles
        else array_append(coalesce(download_profiles, '{}'), profile_id_param)
    end
    where (asset_id || '-' || tag_id) = any(array(select jsonb_array_elements_text(closure_record.asset_tag_link_ids)));
    get diagnostics asset_tag_links_updated = row_count;
    raise notice '[download_project_closure] Updated asset_tag_links: % rows', asset_tag_links_updated;
    
    -- Update the project closure record itself to include this profile
    update project_closure 
    set download_profiles = case 
        when download_profiles @> array[profile_id_param] then download_profiles
        else array_append(coalesce(download_profiles, '{}'), profile_id_param)
    end
    where project_id = project_id_param;
    get diagnostics project_closures_updated = row_count;
    raise notice '[download_project_closure] Updated project_closure: % rows', project_closures_updated;

    -- Logging
    raise notice '[download_project_closure] Completed for project_id: %, profile_id: %', project_id_param, profile_id_param;

    -- Return summary of what was updated
    return query
    select 'project'::text, projects_updated
    union all
    select 'quest'::text, quests_updated
    union all
    select 'asset'::text, assets_updated
    union all
    select 'translation'::text, translations_updated
    union all
    select 'vote'::text, votes_updated
    union all
    select 'tag'::text, tags_updated
    union all
    select 'language'::text, languages_updated
    union all
    select 'project_language_link'::text, project_language_links_updated
    union all
    select 'quest_asset_link'::text, quest_asset_links_updated
    union all
    select 'asset_content_link'::text, asset_content_links_updated
    union all
    select 'quest_tag_link'::text, quest_tag_links_updated
    union all
    select 'asset_tag_link'::text, asset_tag_links_updated
    union all
    select 'project_closure'::text, project_closures_updated
    union all
    -- New languoid-related tables
    select 'languoid'::text, languoids_updated
    union all
    select 'languoid_alias'::text, languoid_aliases_updated
    union all
    select 'languoid_source'::text, languoid_sources_updated
    union all
    select 'languoid_property'::text, languoid_properties_updated
    union all
    select 'languoid_region'::text, languoid_regions_updated
    union all
    select 'region'::text, regions_updated
    union all
    select 'region_alias'::text, region_aliases_updated
    union all
    select 'region_source'::text, region_sources_updated
    union all
    select 'region_property'::text, region_properties_updated;
end;
$$;


-- ============================================================================
-- 3. BACKFILL: Populate download_profiles for existing languoid data
-- ============================================================================
-- This ensures users who have already downloaded projects/quests will have
-- the associated languoid tables synced to their devices.

do $$
declare
    languoids_backfilled integer := 0;
    aliases_backfilled integer := 0;
    sources_backfilled integer := 0;
    properties_backfilled integer := 0;
    languoid_regions_backfilled integer := 0;
    regions_backfilled integer := 0;
    region_aliases_backfilled integer := 0;
    region_sources_backfilled integer := 0;
    region_properties_backfilled integer := 0;
begin
    raise notice '[backfill] Starting languoid download_profiles backfill...';

    -- Backfill languoid from project_language_link
    -- For each languoid linked to a project, add all users who have that project downloaded
    with project_users as (
        select distinct pll.languoid_id, unnest(p.download_profiles) as profile_id
        from project_language_link pll
        join project p on p.id = pll.project_id
        where pll.languoid_id is not null
          and pll.active = true
          and p.download_profiles is not null
          and array_length(p.download_profiles, 1) > 0
    )
    update languoid lo
    set download_profiles = (
        select array_agg(distinct elem)
        from (
            select unnest(coalesce(lo.download_profiles, '{}')) as elem
            union
            select pu.profile_id
            from project_users pu
            where pu.languoid_id = lo.id
        ) combined
    )
    where lo.id in (select distinct languoid_id from project_users);
    get diagnostics languoids_backfilled = row_count;
    raise notice '[backfill] Updated languoid: % rows', languoids_backfilled;

    -- Backfill languoid_alias
    with languoid_profiles as (
        select id, download_profiles from languoid where download_profiles is not null and array_length(download_profiles, 1) > 0
    )
    update languoid_alias la
    set download_profiles = lp.download_profiles
    from languoid_profiles lp
    where la.subject_languoid_id = lp.id
      and (la.download_profiles is null or la.download_profiles <> lp.download_profiles);
    get diagnostics aliases_backfilled = row_count;
    raise notice '[backfill] Updated languoid_alias: % rows', aliases_backfilled;

    -- Backfill languoid_source
    with languoid_profiles as (
        select id, download_profiles from languoid where download_profiles is not null and array_length(download_profiles, 1) > 0
    )
    update languoid_source ls
    set download_profiles = lp.download_profiles
    from languoid_profiles lp
    where ls.languoid_id = lp.id
      and (ls.download_profiles is null or ls.download_profiles <> lp.download_profiles);
    get diagnostics sources_backfilled = row_count;
    raise notice '[backfill] Updated languoid_source: % rows', sources_backfilled;

    -- Backfill languoid_property
    with languoid_profiles as (
        select id, download_profiles from languoid where download_profiles is not null and array_length(download_profiles, 1) > 0
    )
    update languoid_property lp_tbl
    set download_profiles = lp.download_profiles
    from languoid_profiles lp
    where lp_tbl.languoid_id = lp.id
      and (lp_tbl.download_profiles is null or lp_tbl.download_profiles <> lp.download_profiles);
    get diagnostics properties_backfilled = row_count;
    raise notice '[backfill] Updated languoid_property: % rows', properties_backfilled;

    -- Backfill languoid_region
    with languoid_profiles as (
        select id, download_profiles from languoid where download_profiles is not null and array_length(download_profiles, 1) > 0
    )
    update languoid_region lr
    set download_profiles = lp.download_profiles
    from languoid_profiles lp
    where lr.languoid_id = lp.id
      and (lr.download_profiles is null or lr.download_profiles <> lp.download_profiles);
    get diagnostics languoid_regions_backfilled = row_count;
    raise notice '[backfill] Updated languoid_region: % rows', languoid_regions_backfilled;

    -- Backfill region - aggregate profiles from all languoids linked to each region
    with region_profiles as (
        select lr.region_id, array_agg(distinct elem) as profiles
        from languoid_region lr
        cross join lateral unnest(lr.download_profiles) as elem
        where lr.download_profiles is not null and array_length(lr.download_profiles, 1) > 0
        group by lr.region_id
    )
    update region r
    set download_profiles = rp.profiles
    from region_profiles rp
    where r.id = rp.region_id
      and (r.download_profiles is null or r.download_profiles <> rp.profiles);
    get diagnostics regions_backfilled = row_count;
    raise notice '[backfill] Updated region: % rows', regions_backfilled;

    -- Backfill region_alias
    with region_profiles as (
        select id, download_profiles from region where download_profiles is not null and array_length(download_profiles, 1) > 0
    )
    update region_alias ra
    set download_profiles = rp.download_profiles
    from region_profiles rp
    where ra.subject_region_id = rp.id
      and (ra.download_profiles is null or ra.download_profiles <> rp.download_profiles);
    get diagnostics region_aliases_backfilled = row_count;
    raise notice '[backfill] Updated region_alias: % rows', region_aliases_backfilled;

    -- Backfill region_source
    with region_profiles as (
        select id, download_profiles from region where download_profiles is not null and array_length(download_profiles, 1) > 0
    )
    update region_source rs
    set download_profiles = rp.download_profiles
    from region_profiles rp
    where rs.region_id = rp.id
      and (rs.download_profiles is null or rs.download_profiles <> rp.download_profiles);
    get diagnostics region_sources_backfilled = row_count;
    raise notice '[backfill] Updated region_source: % rows', region_sources_backfilled;

    -- Backfill region_property
    with region_profiles as (
        select id, download_profiles from region where download_profiles is not null and array_length(download_profiles, 1) > 0
    )
    update region_property rp_tbl
    set download_profiles = rp.download_profiles
    from region_profiles rp
    where rp_tbl.region_id = rp.id
      and (rp_tbl.download_profiles is null or rp_tbl.download_profiles <> rp.download_profiles);
    get diagnostics region_properties_backfilled = row_count;
    raise notice '[backfill] Updated region_property: % rows', region_properties_backfilled;

    raise notice '[backfill] Completed. Summary: languoid=%, alias=%, source=%, property=%, languoid_region=%, region=%, region_alias=%, region_source=%, region_property=%',
        languoids_backfilled, aliases_backfilled, sources_backfilled, properties_backfilled,
        languoid_regions_backfilled, regions_backfilled, region_aliases_backfilled, region_sources_backfilled, region_properties_backfilled;
end;
$$;
