-- ============================================================================
-- Migration: Add trigger to propagate download_profiles to languoid tables
-- ============================================================================
--
-- PURPOSE:
-- When a project_language_link is inserted with a languoid_id, automatically
-- add the user(s) from the link's download_profiles to the languoid and all
-- related tables (languoid_alias, languoid_source, languoid_property,
-- languoid_region, region, region_alias, region_source, region_property).
--
-- WHY THIS IS NEEDED:
-- - Old app versions don't have any mechanism to update languoid download_profiles
-- - Without this trigger, users who create projects with existing languoids
--   won't have the languoid data synced to their devices
-- - The backfill migration only handles existing data at migration time
-- - This trigger ensures ALL future project_language_link inserts are handled
--
-- WHY TRIGGER-ONLY (NO APP-SIDE RPC):
-- The trigger fires when project_language_link is inserted (via PowerSync sync).
-- This handles all cases uniformly:
-- - Old app users: trigger fires when insert syncs
-- - New app users: trigger fires when insert syncs
-- - Offline users: trigger fires when they come online and sync
-- No need for separate app-side RPC call - the trigger guarantees correctness.
--
-- ============================================================================

set search_path = public;

-- ============================================================================
-- Drop the add_languoid_to_download_profiles RPC (no longer needed)
-- ============================================================================
-- The trigger below handles all cases. The RPC was created in a previous
-- migration but is now superseded by this trigger-based approach.

drop function if exists public.add_languoid_to_download_profiles(uuid);

-- ============================================================================
-- Trigger function: propagate download_profiles to languoid tables
-- ============================================================================

create or replace function public.propagate_pll_to_languoid_download_profiles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
begin
  -- Only process if languoid_id is set
  if new.languoid_id is null then
    return new;
  end if;

  -- Only process if download_profiles has at least one entry
  if new.download_profiles is null or array_length(new.download_profiles, 1) is null then
    return new;
  end if;

  -- Process each profile in the download_profiles array
  -- (Usually just one user, but handle multiple for completeness)
  foreach v_profile_id in array new.download_profiles
  loop
    raise notice '[propagate_pll_to_languoid] Processing languoid_id=%, profile_id=%', 
      new.languoid_id, v_profile_id;

    -- ========================================================================
    -- 1. UPDATE LANGUOID
    -- ========================================================================
    update public.languoid
    set 
      download_profiles = case 
        when download_profiles @> array[v_profile_id] then download_profiles
        else array_append(coalesce(download_profiles, '{}'), v_profile_id)
      end,
      last_updated = now()
    where id = new.languoid_id
      and (download_profiles is null or not download_profiles @> array[v_profile_id]);

    -- ========================================================================
    -- 2. UPDATE LANGUOID_ALIAS
    -- ========================================================================
    update public.languoid_alias
    set 
      download_profiles = case 
        when download_profiles @> array[v_profile_id] then download_profiles
        else array_append(coalesce(download_profiles, '{}'), v_profile_id)
      end,
      last_updated = now()
    where subject_languoid_id = new.languoid_id
      and (download_profiles is null or not download_profiles @> array[v_profile_id]);

    -- ========================================================================
    -- 3. UPDATE LANGUOID_SOURCE
    -- ========================================================================
    update public.languoid_source
    set 
      download_profiles = case 
        when download_profiles @> array[v_profile_id] then download_profiles
        else array_append(coalesce(download_profiles, '{}'), v_profile_id)
      end,
      last_updated = now()
    where languoid_id = new.languoid_id
      and (download_profiles is null or not download_profiles @> array[v_profile_id]);

    -- ========================================================================
    -- 4. UPDATE LANGUOID_PROPERTY
    -- ========================================================================
    update public.languoid_property
    set 
      download_profiles = case 
        when download_profiles @> array[v_profile_id] then download_profiles
        else array_append(coalesce(download_profiles, '{}'), v_profile_id)
      end,
      last_updated = now()
    where languoid_id = new.languoid_id
      and (download_profiles is null or not download_profiles @> array[v_profile_id]);

    -- ========================================================================
    -- 5. UPDATE LANGUOID_REGION
    -- ========================================================================
    update public.languoid_region
    set 
      download_profiles = case 
        when download_profiles @> array[v_profile_id] then download_profiles
        else array_append(coalesce(download_profiles, '{}'), v_profile_id)
      end,
      last_updated = now()
    where languoid_id = new.languoid_id
      and (download_profiles is null or not download_profiles @> array[v_profile_id]);

    -- ========================================================================
    -- 6. UPDATE REGION (via languoid_region join)
    -- ========================================================================
    update public.region r
    set 
      download_profiles = case 
        when r.download_profiles @> array[v_profile_id] then r.download_profiles
        else array_append(coalesce(r.download_profiles, '{}'), v_profile_id)
      end,
      last_updated = now()
    where r.id in (
      select lr.region_id
      from public.languoid_region lr
      where lr.languoid_id = new.languoid_id
    )
    and (r.download_profiles is null or not r.download_profiles @> array[v_profile_id]);

    -- ========================================================================
    -- 7. UPDATE REGION_ALIAS (via languoid_region -> region)
    -- ========================================================================
    update public.region_alias ra
    set 
      download_profiles = case 
        when ra.download_profiles @> array[v_profile_id] then ra.download_profiles
        else array_append(coalesce(ra.download_profiles, '{}'), v_profile_id)
      end,
      last_updated = now()
    where ra.subject_region_id in (
      select lr.region_id
      from public.languoid_region lr
      where lr.languoid_id = new.languoid_id
    )
    and (ra.download_profiles is null or not ra.download_profiles @> array[v_profile_id]);

    -- ========================================================================
    -- 8. UPDATE REGION_SOURCE (via languoid_region -> region)
    -- ========================================================================
    update public.region_source rs
    set 
      download_profiles = case 
        when rs.download_profiles @> array[v_profile_id] then rs.download_profiles
        else array_append(coalesce(rs.download_profiles, '{}'), v_profile_id)
      end,
      last_updated = now()
    where rs.region_id in (
      select lr.region_id
      from public.languoid_region lr
      where lr.languoid_id = new.languoid_id
    )
    and (rs.download_profiles is null or not rs.download_profiles @> array[v_profile_id]);

    -- ========================================================================
    -- 9. UPDATE REGION_PROPERTY (via languoid_region -> region)
    -- ========================================================================
    update public.region_property rp
    set 
      download_profiles = case 
        when rp.download_profiles @> array[v_profile_id] then rp.download_profiles
        else array_append(coalesce(rp.download_profiles, '{}'), v_profile_id)
      end,
      last_updated = now()
    where rp.region_id in (
      select lr.region_id
      from public.languoid_region lr
      where lr.languoid_id = new.languoid_id
    )
    and (rp.download_profiles is null or not rp.download_profiles @> array[v_profile_id]);

  end loop;

  return new;
end;
$$;

-- ============================================================================
-- Create the trigger on project_language_link INSERT
-- ============================================================================
-- Drop first for idempotency
drop trigger if exists propagate_pll_to_languoid_download_profiles_trigger 
  on public.project_language_link;

create trigger propagate_pll_to_languoid_download_profiles_trigger
after insert on public.project_language_link
for each row
execute function public.propagate_pll_to_languoid_download_profiles();

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================
--
-- TRIGGER FLOW:
--
-- 1. User creates project with existing languoid (old or new app)
-- 2. App inserts project_language_link with:
--    - project_id
--    - languoid_id  
--    - download_profiles: [user_id]
-- 3. Trigger fires AFTER INSERT
-- 4. For each user in download_profiles:
--    - Add to languoid.download_profiles
--    - Add to languoid_alias.download_profiles (where subject_languoid_id matches)
--    - Add to languoid_source.download_profiles (where languoid_id matches)
--    - Add to languoid_property.download_profiles (where languoid_id matches)
--    - Add to languoid_region.download_profiles (where languoid_id matches)
--    - Add to region.download_profiles (via languoid_region join)
--    - Add to region_alias.download_profiles (via languoid_region -> region)
--    - Add to region_source.download_profiles (via languoid_region -> region)
--    - Add to region_property.download_profiles (via languoid_region -> region)
--
-- IDEMPOTENCY:
-- Each UPDATE uses the pattern:
--   WHERE ... AND (download_profiles IS NULL OR NOT download_profiles @> ARRAY[v_profile_id])
-- Combined with CASE expression, this ensures:
-- - No duplicate entries in any download_profiles array
-- - Safe to have both trigger and RPC (either can run first)
--
-- WHY AFTER INSERT (not BEFORE):
-- - We need the row to be committed before updating other tables
-- - AFTER INSERT ensures the project_language_link exists
-- - Returning NEW from AFTER INSERT is just convention (return value ignored)
--
-- ============================================================================
