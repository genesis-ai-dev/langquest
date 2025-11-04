-- Fix any existing double-encoded metadata in quest table
-- This handles data that was inserted when the column was jsonb
-- and got double-stringified by Drizzle

-- Update any records where metadata is double-encoded
-- We detect this by checking if the parsed JSON is a string type (not an object)
-- If it's a string, we unwrap one layer by extracting the string value
UPDATE "public"."quest"
SET metadata = 
  CASE 
    -- If metadata parses as a JSON string (not object), it's double-encoded
    -- Extract the inner string value by casting to jsonb and back to text
    WHEN jsonb_typeof(metadata::jsonb) = 'string' THEN 
      -- Remove quotes and unescape by extracting the string value
      (metadata::jsonb #>> '{}')
    ELSE 
      metadata
  END
WHERE metadata IS NOT NULL
  AND jsonb_typeof(metadata::jsonb) = 'string';

-- Note: This migration is safe to run multiple times (idempotent)

