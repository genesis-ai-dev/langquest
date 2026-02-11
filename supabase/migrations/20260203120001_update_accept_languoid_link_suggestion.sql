-- ============================================================================
-- Migration: Update accept_languoid_link_suggestion to add user to target languoid's download_profiles
-- ============================================================================
--
-- PURPOSE:
-- When a user accepts a languoid link suggestion, the target languoid they're
-- switching to needs to have the user's profile_id in its download_profiles.
-- This ensures the languoid and its related records sync to the user's device.
--
-- AFFECTED FUNCTIONS:
-- - accept_languoid_link_suggestion
--
-- BACKGROUND:
-- Previously, when accepting a suggestion, the function only:
-- 1. Updated project_language_link to point to the new languoid
-- 2. Updated profile.ui_languoid_id
-- 3. Marked the old languoid as inactive
-- 
-- But it didn't add the user to the new languoid's download_profiles,
-- meaning the languoid wouldn't sync to their device for offline access.
--
-- ============================================================================

set search_path = public;

create or replace function public.accept_languoid_link_suggestion(
  p_suggestion_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_suggestion record;
  v_user_id uuid;
begin
  -- Get current user
  v_user_id := auth.uid();
  
  -- Get the suggestion
  select * into v_suggestion
  from public.languoid_link_suggestion
  where id = p_suggestion_id
    and profile_id = v_user_id
    and status = 'pending'
    and active = true;
  
  if v_suggestion is null then
    raise exception 'Suggestion not found or not authorized';
  end if;
  
  -- ============================================================================
  -- NEW: Add user to the target languoid's download_profiles
  -- This ensures the languoid syncs to the user's device for offline access
  -- ============================================================================
  
  -- Update the target languoid's download_profiles
  update public.languoid
  set download_profiles = case 
      when download_profiles @> array[v_user_id] then download_profiles
      else array_append(coalesce(download_profiles, '{}'), v_user_id)
    end,
    last_updated = now()
  where id = v_suggestion.suggested_languoid_id;
  
  -- Update languoid_source records for the target languoid
  update public.languoid_source
  set download_profiles = case 
      when download_profiles @> array[v_user_id] then download_profiles
      else array_append(coalesce(download_profiles, '{}'), v_user_id)
    end,
    last_updated = now()
  where languoid_id = v_suggestion.suggested_languoid_id;
  
  -- Update languoid_alias records for the target languoid
  update public.languoid_alias
  set download_profiles = case 
      when download_profiles @> array[v_user_id] then download_profiles
      else array_append(coalesce(download_profiles, '{}'), v_user_id)
    end,
    last_updated = now()
  where subject_languoid_id = v_suggestion.suggested_languoid_id;
  
  -- Update languoid_property records for the target languoid
  update public.languoid_property
  set download_profiles = case 
      when download_profiles @> array[v_user_id] then download_profiles
      else array_append(coalesce(download_profiles, '{}'), v_user_id)
    end,
    last_updated = now()
  where languoid_id = v_suggestion.suggested_languoid_id;
  
  -- Update languoid_region records for the target languoid
  update public.languoid_region
  set download_profiles = case 
      when download_profiles @> array[v_user_id] then download_profiles
      else array_append(coalesce(download_profiles, '{}'), v_user_id)
    end,
    last_updated = now()
  where languoid_id = v_suggestion.suggested_languoid_id;
  
  -- Update region records linked to the target languoid
  update public.region
  set download_profiles = case 
      when download_profiles @> array[v_user_id] then download_profiles
      else array_append(coalesce(download_profiles, '{}'), v_user_id)
    end,
    last_updated = now()
  where id in (
    select region_id from public.languoid_region
    where languoid_id = v_suggestion.suggested_languoid_id
  );
  
  -- Update region_alias, region_source, region_property for linked regions
  update public.region_alias
  set download_profiles = case 
      when download_profiles @> array[v_user_id] then download_profiles
      else array_append(coalesce(download_profiles, '{}'), v_user_id)
    end,
    last_updated = now()
  where region_id in (
    select region_id from public.languoid_region
    where languoid_id = v_suggestion.suggested_languoid_id
  );
  
  update public.region_source
  set download_profiles = case 
      when download_profiles @> array[v_user_id] then download_profiles
      else array_append(coalesce(download_profiles, '{}'), v_user_id)
    end,
    last_updated = now()
  where region_id in (
    select region_id from public.languoid_region
    where languoid_id = v_suggestion.suggested_languoid_id
  );
  
  update public.region_property
  set download_profiles = case 
      when download_profiles @> array[v_user_id] then download_profiles
      else array_append(coalesce(download_profiles, '{}'), v_user_id)
    end,
    last_updated = now()
  where region_id in (
    select region_id from public.languoid_region
    where languoid_id = v_suggestion.suggested_languoid_id
  );
  
  -- ============================================================================
  -- Original functionality: Update references and mark old languoid inactive
  -- ============================================================================
  
  -- Update project_language_link references
  update public.project_language_link
  set languoid_id = v_suggestion.suggested_languoid_id,
      last_updated = now()
  where languoid_id = v_suggestion.languoid_id;
  
  -- Update asset_content_link references
  update public.asset_content_link
  set languoid_id = v_suggestion.suggested_languoid_id,
      last_updated = now()
  where languoid_id = v_suggestion.languoid_id;
  
  -- Update profile ui_languoid_id if it references the user languoid
  update public.profile
  set ui_languoid_id = v_suggestion.suggested_languoid_id,
      last_updated = now()
  where ui_languoid_id = v_suggestion.languoid_id;
  
  -- Mark the user-created languoid as inactive
  update public.languoid
  set active = false,
      last_updated = now()
  where id = v_suggestion.languoid_id
    and creator_id = v_user_id;
  
  -- Update the suggestion status
  update public.languoid_link_suggestion
  set status = 'accepted',
      last_updated = now()
  where id = p_suggestion_id;
  
  -- Withdraw all other pending suggestions for this user languoid
  update public.languoid_link_suggestion
  set status = 'withdrawn',
      last_updated = now()
  where languoid_id = v_suggestion.languoid_id
    and id != p_suggestion_id
    and status = 'pending';
  
  return true;
end;
$$;
