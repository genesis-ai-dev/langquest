-- Function to copy download_profiles from asset to translation
create or replace function copy_asset_download_profiles () RETURNS TRIGGER as $$
BEGIN
    -- Copy download_profiles from the linked asset to the new translation
    SELECT download_profiles 
    INTO NEW.download_profiles
    FROM public.asset 
    WHERE id = NEW.asset_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger that fires on INSERT to translation table
create
or REPLACE TRIGGER trigger_copy_asset_download_profiles BEFORE INSERT on public.translation for EACH row
execute FUNCTION copy_asset_download_profiles ();

-- Function to copy download_profiles from asset grandparent to vote
create or replace function copy_asset_download_profiles_to_vote () RETURNS TRIGGER as $$
BEGIN
    -- Copy download_profiles from the asset (grandparent) to the new vote
    -- vote -> translation -> asset
    SELECT a.download_profiles 
    INTO NEW.download_profiles
    FROM public.asset a
    INNER JOIN public.translation t ON a.id = t.asset_id
    WHERE t.id = NEW.translation_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger that fires on INSERT to vote table
create
or REPLACE TRIGGER trigger_copy_asset_download_profiles_to_vote BEFORE INSERT on public.vote for EACH row
execute FUNCTION copy_asset_download_profiles_to_vote ();