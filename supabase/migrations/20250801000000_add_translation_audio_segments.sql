-- Create translation_audio_link table for multiple audio segments per translation
CREATE TABLE IF NOT EXISTS "translation_audio_link" (
    "id" uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "last_updated" timestamptz NOT NULL DEFAULT now(),
    "translation_id" uuid NOT NULL REFERENCES "translation"("id"),
    "audio_url" TEXT NOT NULL,
    "sequence_index" INTEGER NOT NULL,
    "download_profiles" TEXT
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "translation_audio_link_translation_id_idx" ON "translation_audio_link"("translation_id");
CREATE INDEX IF NOT EXISTS "translation_audio_link_sequence_idx" ON "translation_audio_link"("translation_id", "sequence_index");

-- Migrate existing audio data from translation table to translation_audio_link
INSERT INTO "translation_audio_link" (
    "translation_id", 
    "audio_url", 
    "sequence_index", 
    "download_profiles"
)
SELECT 
    "id",
    "audio",
    0,
    "download_profiles"
FROM "translation" 
WHERE "audio" IS NOT NULL AND "audio" != '';

-- Add translation_audio_link_ids to quest_closure table
ALTER TABLE "quest_closure" 
ADD COLUMN "translation_audio_link_ids" TEXT DEFAULT '[]';

-- Add translation_audio_link_ids to project_closure table  
ALTER TABLE "project_closure"
ADD COLUMN "translation_audio_link_ids" TEXT DEFAULT '[]';

-- Update existing quest_closure records to include translation_audio_link_ids
UPDATE "quest_closure" 
SET "translation_audio_link_ids" = (
    SELECT json_agg(tal.id)
    FROM "translation_audio_link" tal
    JOIN "translation" t ON tal.translation_id = t.id
    JOIN "asset" a ON t.asset_id = a.id
    JOIN "quest_asset_link" qal ON a.id = qal.asset_id
    WHERE qal.quest_id = "quest_closure".quest_id
);

-- Update existing project_closure records to include translation_audio_link_ids
UPDATE "project_closure"
SET "translation_audio_link_ids" = (
    SELECT json_agg(tal.id)
    FROM "translation_audio_link" tal
    JOIN "translation" t ON tal.translation_id = t.id
    JOIN "asset" a ON t.asset_id = a.id
    JOIN "quest_asset_link" qal ON a.id = qal.asset_id
    JOIN "quest" q ON qal.quest_id = q.id
    WHERE q.project_id = "project_closure".project_id
);

-- Remove the audio column from translation table using PostgreSQL syntax
ALTER TABLE "translation" DROP COLUMN IF EXISTS "audio";

-- Update last_updated trigger for translation_audio_link
CREATE OR REPLACE FUNCTION update_translation_audio_link_last_updated()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_translation_audio_link_last_updated
    BEFORE UPDATE ON "translation_audio_link"
    FOR EACH ROW
    EXECUTE FUNCTION update_translation_audio_link_last_updated(); 