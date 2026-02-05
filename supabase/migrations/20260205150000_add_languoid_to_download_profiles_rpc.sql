-- ============================================================================
-- Migration: Add add_languoid_to_download_profiles RPC function
-- ============================================================================
--
-- PURPOSE:
-- Creates a new RPC function that adds the authenticated user to a languoid's
-- download_profiles array, along with all related tables (aliases, sources,
-- properties, regions).
--
-- This function is needed when a user creates a project with an existing
-- languoid that they don't already have synced to their device. The app-side
-- code cannot update the languoid locally if it doesn't exist locally yet,
-- so this RPC allows a direct server-side update.
--
-- AFFECTED TABLES:
-- - languoid
-- - languoid_alias
-- - languoid_source
-- - languoid_property
-- - languoid_region
-- - region
-- - region_alias
-- - region_source
-- - region_property
--
-- IDEMPOTENCY:
-- The function uses array containment checks (@>) to ensure the same user ID
-- is never added twice to any download_profiles array.
--
-- SECURITY:
-- Uses SECURITY DEFINER because the user may not have RLS access to update
-- these records yet (they're not in download_profiles, which is typically
-- what grants access). The function validates authentication via auth.uid().
--
-- ============================================================================

set search_path = public;

-- ============================================================================
-- Create the add_languoid_to_download_profiles RPC function
-- ============================================================================

create or replace function public.add_languoid_to_download_profiles(
  p_languoid_id uuid
)
returns table(
  table_name text,
  records_updated integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_languoid_updated integer := 0;
  v_aliases_updated integer := 0;
  v_sources_updated integer := 0;
  v_properties_updated integer := 0;
  v_languoid_regions_updated integer := 0;
  v_regions_updated integer := 0;
  v_region_aliases_updated integer := 0;
  v_region_sources_updated integer := 0;
  v_region_properties_updated integer := 0;
begin
  -- ============================================================================
  -- AUTHENTICATION CHECK
  -- ============================================================================
  v_user_id := auth.uid();
  
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  raise notice '[add_languoid_to_download_profiles] Starting for languoid_id: %, user_id: %', 
    p_languoid_id, v_user_id;

  -- ============================================================================
  -- 1. UPDATE LANGUOID
  -- ============================================================================
  -- Direct match on the languoid ID
  -- Pattern: Only append if user is not already in the array (idempotent)
  
  update public.languoid
  set 
    download_profiles = case 
      when download_profiles @> array[v_user_id] then download_profiles
      else array_append(coalesce(download_profiles, '{}'), v_user_id)
    end,
    last_updated = now()
  where id = p_languoid_id
    and (download_profiles is null or not download_profiles @> array[v_user_id]);
  
  get diagnostics v_languoid_updated = row_count;
  raise notice '[add_languoid_to_download_profiles] Updated languoid: % rows', v_languoid_updated;

  -- ============================================================================
  -- 2. UPDATE LANGUOID_ALIAS
  -- ============================================================================
  -- Relationship: languoid_alias.subject_languoid_id -> languoid.id
  -- This captures all aliases FOR this languoid (where this languoid is the subject)
  
  update public.languoid_alias
  set 
    download_profiles = case 
      when download_profiles @> array[v_user_id] then download_profiles
      else array_append(coalesce(download_profiles, '{}'), v_user_id)
    end,
    last_updated = now()
  where subject_languoid_id = p_languoid_id
    and (download_profiles is null or not download_profiles @> array[v_user_id]);
  
  get diagnostics v_aliases_updated = row_count;
  raise notice '[add_languoid_to_download_profiles] Updated languoid_alias: % rows', v_aliases_updated;

  -- ============================================================================
  -- 3. UPDATE LANGUOID_SOURCE
  -- ============================================================================
  -- Relationship: languoid_source.languoid_id -> languoid.id
  -- This captures external identifiers (ISO 639-3 codes, Glottolog IDs, etc.)
  
  update public.languoid_source
  set 
    download_profiles = case 
      when download_profiles @> array[v_user_id] then download_profiles
      else array_append(coalesce(download_profiles, '{}'), v_user_id)
    end,
    last_updated = now()
  where languoid_id = p_languoid_id
    and (download_profiles is null or not download_profiles @> array[v_user_id]);
  
  get diagnostics v_sources_updated = row_count;
  raise notice '[add_languoid_to_download_profiles] Updated languoid_source: % rows', v_sources_updated;

  -- ============================================================================
  -- 4. UPDATE LANGUOID_PROPERTY
  -- ============================================================================
  -- Relationship: languoid_property.languoid_id -> languoid.id
  -- This captures key-value properties for the languoid
  
  update public.languoid_property
  set 
    download_profiles = case 
      when download_profiles @> array[v_user_id] then download_profiles
      else array_append(coalesce(download_profiles, '{}'), v_user_id)
    end,
    last_updated = now()
  where languoid_id = p_languoid_id
    and (download_profiles is null or not download_profiles @> array[v_user_id]);
  
  get diagnostics v_properties_updated = row_count;
  raise notice '[add_languoid_to_download_profiles] Updated languoid_property: % rows', v_properties_updated;

  -- ============================================================================
  -- 5. UPDATE LANGUOID_REGION
  -- ============================================================================
  -- Relationship: languoid_region.languoid_id -> languoid.id
  -- This is the join table linking languoids to geographic regions
  
  update public.languoid_region
  set 
    download_profiles = case 
      when download_profiles @> array[v_user_id] then download_profiles
      else array_append(coalesce(download_profiles, '{}'), v_user_id)
    end,
    last_updated = now()
  where languoid_id = p_languoid_id
    and (download_profiles is null or not download_profiles @> array[v_user_id]);
  
  get diagnostics v_languoid_regions_updated = row_count;
  raise notice '[add_languoid_to_download_profiles] Updated languoid_region: % rows', v_languoid_regions_updated;

  -- ============================================================================
  -- 6. UPDATE REGION
  -- ============================================================================
  -- Relationship: region.id <- languoid_region.region_id (via the join table)
  -- This captures the geographic regions where this languoid is spoken
  
  update public.region r
  set 
    download_profiles = case 
      when r.download_profiles @> array[v_user_id] then r.download_profiles
      else array_append(coalesce(r.download_profiles, '{}'), v_user_id)
    end,
    last_updated = now()
  where r.id in (
    select lr.region_id
    from public.languoid_region lr
    where lr.languoid_id = p_languoid_id
  )
  and (r.download_profiles is null or not r.download_profiles @> array[v_user_id]);
  
  get diagnostics v_regions_updated = row_count;
  raise notice '[add_languoid_to_download_profiles] Updated region: % rows', v_regions_updated;

  -- ============================================================================
  -- 7. UPDATE REGION_ALIAS
  -- ============================================================================
  -- Relationship: region_alias.subject_region_id -> region.id
  --               where region is linked via languoid_region
  -- This captures alternative names for the regions
  
  update public.region_alias ra
  set 
    download_profiles = case 
      when ra.download_profiles @> array[v_user_id] then ra.download_profiles
      else array_append(coalesce(ra.download_profiles, '{}'), v_user_id)
    end,
    last_updated = now()
  where ra.subject_region_id in (
    select lr.region_id
    from public.languoid_region lr
    where lr.languoid_id = p_languoid_id
  )
  and (ra.download_profiles is null or not ra.download_profiles @> array[v_user_id]);
  
  get diagnostics v_region_aliases_updated = row_count;
  raise notice '[add_languoid_to_download_profiles] Updated region_alias: % rows', v_region_aliases_updated;

  -- ============================================================================
  -- 8. UPDATE REGION_SOURCE
  -- ============================================================================
  -- Relationship: region_source.region_id -> region.id
  --               where region is linked via languoid_region
  -- This captures external identifiers for the regions
  
  update public.region_source rs
  set 
    download_profiles = case 
      when rs.download_profiles @> array[v_user_id] then rs.download_profiles
      else array_append(coalesce(rs.download_profiles, '{}'), v_user_id)
    end,
    last_updated = now()
  where rs.region_id in (
    select lr.region_id
    from public.languoid_region lr
    where lr.languoid_id = p_languoid_id
  )
  and (rs.download_profiles is null or not rs.download_profiles @> array[v_user_id]);
  
  get diagnostics v_region_sources_updated = row_count;
  raise notice '[add_languoid_to_download_profiles] Updated region_source: % rows', v_region_sources_updated;

  -- ============================================================================
  -- 9. UPDATE REGION_PROPERTY
  -- ============================================================================
  -- Relationship: region_property.region_id -> region.id
  --               where region is linked via languoid_region
  -- This captures key-value properties for the regions
  
  update public.region_property rp
  set 
    download_profiles = case 
      when rp.download_profiles @> array[v_user_id] then rp.download_profiles
      else array_append(coalesce(rp.download_profiles, '{}'), v_user_id)
    end,
    last_updated = now()
  where rp.region_id in (
    select lr.region_id
    from public.languoid_region lr
    where lr.languoid_id = p_languoid_id
  )
  and (rp.download_profiles is null or not rp.download_profiles @> array[v_user_id]);
  
  get diagnostics v_region_properties_updated = row_count;
  raise notice '[add_languoid_to_download_profiles] Updated region_property: % rows', v_region_properties_updated;

  -- ============================================================================
  -- RETURN RESULTS
  -- ============================================================================
  raise notice '[add_languoid_to_download_profiles] Completed successfully';

  return query
  select 'languoid'::text, v_languoid_updated
  union all select 'languoid_alias', v_aliases_updated
  union all select 'languoid_source', v_sources_updated
  union all select 'languoid_property', v_properties_updated
  union all select 'languoid_region', v_languoid_regions_updated
  union all select 'region', v_regions_updated
  union all select 'region_alias', v_region_aliases_updated
  union all select 'region_source', v_region_sources_updated
  union all select 'region_property', v_region_properties_updated;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function public.add_languoid_to_download_profiles(uuid) to authenticated;

-- ============================================================================
-- DOCUMENTATION: Relationship Diagram
-- ============================================================================
--
-- The function updates the following tables based on these relationships:
--
--                           ┌─────────────────┐
--                           │    languoid     │ ← Direct match on p_languoid_id
--                           │      (1)        │
--                           └────────┬────────┘
--                                    │
--          ┌─────────────────────────┼─────────────────────────┐
--          │                         │                         │
--          ▼                         ▼                         ▼
-- ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
-- │ languoid_alias  │     │ languoid_source │     │languoid_property│
-- │       (2)       │     │       (3)       │     │       (4)       │
-- │                 │     │                 │     │                 │
-- │ subject_languoid│     │   languoid_id   │     │   languoid_id   │
-- │ _id = languoid  │     │   = languoid    │     │   = languoid    │
-- └─────────────────┘     └─────────────────┘     └─────────────────┘
--
--                           ┌─────────────────┐
--                           │ languoid_region │ ← Join table
--                           │       (5)       │
--                           │                 │
--                           │ languoid_id =   │
--                           │ p_languoid_id   │
--                           └────────┬────────┘
--                                    │
--                                    │ region_id
--                                    ▼
--                           ┌─────────────────┐
--                           │     region      │
--                           │       (6)       │
--                           └────────┬────────┘
--                                    │
--          ┌─────────────────────────┼─────────────────────────┐
--          │                         │                         │
--          ▼                         ▼                         ▼
-- ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
-- │  region_alias   │     │  region_source  │     │ region_property │
-- │       (7)       │     │       (8)       │     │       (9)       │
-- │                 │     │                 │     │                 │
-- │ subject_region  │     │    region_id    │     │    region_id    │
-- │ _id = region    │     │    = region     │     │    = region     │
-- └─────────────────┘     └─────────────────┘     └─────────────────┘
--
-- IDEMPOTENCY:
-- Each UPDATE uses this pattern to prevent duplicate entries:
--
--   where ... and (download_profiles is null or not download_profiles @> array[v_user_id])
--
-- The @> operator checks array containment. Combined with the CASE expression
-- in the SET clause, this ensures:
-- 1. Only rows that need updating are modified (WHERE filter)
-- 2. The array_append only happens if user is not already present (CASE)
--
-- ============================================================================
