-- Migration: Backfill download_profiles for existing profile_project_link records
-- Purpose:
-- - Populate download_profiles for existing active members with OTHER active members' profile_ids
-- - Set download_profiles to null for inactive members
-- - Ensures existing records match the behavior of the trigger functions
-- - Uses the existing normalize_download_profiles function for consistency

-- Increase timeout for long-running migration (may affect many rows)
set statement_timeout = '30min';

-- Backfill download_profiles for active members
-- For each active record, populate with all OTHER active members' profile_ids in the same project
-- This ensures all active records have the correct download_profiles, even if they were set incorrectly before
update public.profile_project_link ppl
set download_profiles = public.normalize_download_profiles(
    (
        select coalesce(array_agg(other_ppl.profile_id), '{}')
        from public.profile_project_link other_ppl
        where other_ppl.project_id = ppl.project_id
          and other_ppl.active = true
          and other_ppl.profile_id != ppl.profile_id
    )
)
where ppl.active = true;

-- Set download_profiles to null for inactive members
-- Inactive members don't need to sync other members' profiles
update public.profile_project_link
set download_profiles = null
where active is distinct from true
  and download_profiles is not null;

-- Reset timeout to default
reset statement_timeout;
