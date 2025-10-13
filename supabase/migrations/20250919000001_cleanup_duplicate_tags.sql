-- Clean up duplicate tags AFTER key/value columns are added but BEFORE unique constraint
-- This migration runs after 20250919000000 adds the key/value columns
-- Prerequisites: tag.key and tag.value columns exist and are populated

-- Delete duplicate tags, keeping only the oldest one (earliest created_at)
-- For each (key, value) pair, keep the row with the earliest created_at
DELETE FROM public.tag
WHERE id IN (
    SELECT id
    FROM (
        SELECT 
            id,
            ROW_NUMBER() OVER (
                PARTITION BY "key", "value" 
                ORDER BY created_at ASC, id ASC
            ) as row_num
        FROM public.tag
    ) ranked
    WHERE row_num > 1
);


