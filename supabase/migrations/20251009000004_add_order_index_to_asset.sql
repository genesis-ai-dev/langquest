-- Add order_index column to asset table
-- This is used for maintaining asset order within a quest

ALTER TABLE public.asset 
ADD COLUMN IF NOT EXISTS order_index integer NOT NULL DEFAULT 0;

-- Add index for efficient ordering queries
CREATE INDEX IF NOT EXISTS idx_asset_order_index ON public.asset(order_index);

-- Add index for quest-specific ordering (combined with quest_asset_link)
CREATE INDEX IF NOT EXISTS idx_asset_project_order ON public.asset(project_id, order_index) 
WHERE project_id IS NOT NULL;

-- Comment explaining the column
COMMENT ON COLUMN public.asset.order_index IS 
'Defines the display order of assets within a quest. Lower values appear first. Default is 0.';


