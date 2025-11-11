-- Migration: Fix vote trigger to use asset_id instead of translation_id
-- Purpose:
-- - The vote table has asset_id (NOT NULL, FK to asset) as the primary relationship
-- - The trigger function copy_asset_download_profiles_to_vote incorrectly references translation_id
-- - Update the trigger to copy download_profiles directly from asset using asset_id
-- - This aligns with the current schema where votes are directly linked to assets

-- Drop the existing trigger
drop trigger if exists trigger_copy_asset_download_profiles_to_vote on public.vote;

-- Drop the existing function
drop function if exists copy_asset_download_profiles_to_vote();

-- Create corrected function to copy download_profiles from asset to vote
create or replace function copy_asset_download_profiles_to_vote () returns trigger as $$
begin
    -- Copy download_profiles directly from the linked asset to the new vote
    -- vote -> asset (direct relationship via asset_id)
    select a.download_profiles 
    into NEW.download_profiles
    from public.asset a
    where a.id = NEW.asset_id;
    
    return NEW;
end;
$$ language plpgsql;

-- Recreate trigger that fires on INSERT to vote table
create trigger trigger_copy_asset_download_profiles_to_vote 
before insert on public.vote 
for each row
execute function copy_asset_download_profiles_to_vote ();

