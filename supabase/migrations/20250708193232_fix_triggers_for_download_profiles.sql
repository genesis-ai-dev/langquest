-- Fix triggers to not fire when only download_profiles is updated
-- This prevents the "record new has no field id" error when calling download_quest_closure

-- Drop existing triggers
DROP TRIGGER IF EXISTS update_quest_closure_on_asset_link_trigger ON public.quest_asset_link;
DROP TRIGGER IF EXISTS update_quest_closure_on_translation_trigger ON public.translation;
DROP TRIGGER IF EXISTS update_quest_closure_on_vote_trigger ON public.vote;

-- Recreate triggers with conditions to only fire on content changes, not download_profiles changes

-- For quest_asset_link: only fire when quest_id, asset_id, or active changes
CREATE TRIGGER update_quest_closure_on_asset_link_trigger 
AFTER INSERT OR UPDATE OF quest_id, asset_id, active 
ON public.quest_asset_link 
FOR EACH ROW 
EXECUTE FUNCTION update_quest_closure_on_asset_link();

-- For translation: only fire when asset_id, target_language_id, text, or active changes
CREATE TRIGGER update_quest_closure_on_translation_trigger 
AFTER INSERT OR UPDATE OF asset_id, target_language_id, text, active 
ON public.translation 
FOR EACH ROW 
EXECUTE FUNCTION update_quest_closure_on_translation();

-- For vote: only fire when translation_id, polarity, or active changes
CREATE TRIGGER update_quest_closure_on_vote_trigger 
AFTER INSERT OR UPDATE OF translation_id, polarity, active 
ON public.vote 
FOR EACH ROW 
EXECUTE FUNCTION update_quest_closure_on_vote(); 