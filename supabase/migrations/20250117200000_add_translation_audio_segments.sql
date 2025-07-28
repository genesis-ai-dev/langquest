-- Create translation_audio_link table for multiple audio segments per translation
CREATE TABLE IF NOT EXISTS "translation_audio_link" (
    "id" TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    "last_updated" TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    "translation_id" TEXT NOT NULL REFERENCES "translation"("id"),
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
    SELECT json_group_array(tal.id)
    FROM "translation_audio_link" tal
    JOIN "translation" t ON tal.translation_id = t.id
    JOIN "asset" a ON t.asset_id = a.id
    JOIN "quest_asset_link" qal ON a.id = qal.asset_id
    WHERE qal.quest_id = "quest_closure".quest_id
);

-- Update existing project_closure records to include translation_audio_link_ids
UPDATE "project_closure"
SET "translation_audio_link_ids" = (
    SELECT json_group_array(tal.id)
    FROM "translation_audio_link" tal
    JOIN "translation" t ON tal.translation_id = t.id
    JOIN "asset" a ON t.asset_id = a.id
    JOIN "quest_asset_link" qal ON a.id = qal.asset_id
    JOIN "quest" q ON qal.quest_id = q.id
    WHERE q.project_id = "project_closure".project_id
);

-- Drop the old audio column from translation table
-- Note: In SQLite, we need to recreate the table to drop a column
PRAGMA foreign_keys=off;

-- Create new translation table without audio column
CREATE TABLE "translation_new" (
    "id" TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    "last_updated" TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    "asset_id" TEXT NOT NULL REFERENCES "asset"("id"),
    "target_language_id" TEXT NOT NULL REFERENCES "language"("id"),
    "text" TEXT,
    "creator_id" TEXT NOT NULL REFERENCES "profile"("id"),
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "download_profiles" TEXT
);

-- Copy data from old table (excluding audio column)
INSERT INTO "translation_new" (
    "id", "active", "created_at", "last_updated", "asset_id", 
    "target_language_id", "text", "creator_id", "visible", "download_profiles"
)
SELECT 
    "id", "active", "created_at", "last_updated", "asset_id",
    "target_language_id", "text", "creator_id", "visible", "download_profiles"
FROM "translation";

-- Drop old table and rename new one
DROP TABLE "translation";
ALTER TABLE "translation_new" RENAME TO "translation";

-- Recreate indexes on translation table
CREATE INDEX IF NOT EXISTS "translation_asset_id_idx" ON "translation"("asset_id");
CREATE INDEX IF NOT EXISTS "translation_creator_id_idx" ON "translation"("creator_id");

PRAGMA foreign_keys=on;

-- Update last_updated trigger for translation_audio_link
CREATE TRIGGER IF NOT EXISTS "update_translation_audio_link_last_updated"
    AFTER UPDATE ON "translation_audio_link"
    FOR EACH ROW
BEGIN
    UPDATE "translation_audio_link" 
    SET "last_updated" = CURRENT_TIMESTAMP 
    WHERE "id" = NEW."id";
END; 