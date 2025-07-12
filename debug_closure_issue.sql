-- Debug script to identify closure timeout issues
-- Run this in your Supabase SQL editor

-- 1. Check the size of project_closure records
SELECT 
    project_id,
    jsonb_array_length(COALESCE(quest_ids, '[]'::jsonb)) as quest_count,
    jsonb_array_length(COALESCE(asset_ids, '[]'::jsonb)) as asset_count,
    jsonb_array_length(COALESCE(translation_ids, '[]'::jsonb)) as translation_count,
    jsonb_array_length(COALESCE(vote_ids, '[]'::jsonb)) as vote_count,
    jsonb_array_length(COALESCE(tag_ids, '[]'::jsonb)) as tag_count,
    jsonb_array_length(COALESCE(language_ids, '[]'::jsonb)) as language_count,
    jsonb_array_length(COALESCE(quest_asset_link_ids, '[]'::jsonb)) as quest_asset_link_count,
    jsonb_array_length(COALESCE(asset_content_link_ids, '[]'::jsonb)) as asset_content_link_count,
    jsonb_array_length(COALESCE(quest_tag_link_ids, '[]'::jsonb)) as quest_tag_link_count,
    jsonb_array_length(COALESCE(asset_tag_link_ids, '[]'::jsonb)) as asset_tag_link_count,
    total_quests,
    total_assets,
    total_translations,
    last_updated
FROM project_closure 
ORDER BY 
    jsonb_array_length(COALESCE(quest_ids, '[]'::jsonb)) + 
    jsonb_array_length(COALESCE(asset_ids, '[]'::jsonb)) + 
    jsonb_array_length(COALESCE(translation_ids, '[]'::jsonb)) DESC
LIMIT 10;

-- 2. Check for malformed JSONB data
SELECT 
    project_id,
    quest_ids IS NULL as quest_ids_null,
    asset_ids IS NULL as asset_ids_null,
    translation_ids IS NULL as translation_ids_null,
    vote_ids IS NULL as vote_ids_null,
    tag_ids IS NULL as tag_ids_null,
    language_ids IS NULL as language_ids_null,
    quest_asset_link_ids IS NULL as quest_asset_link_ids_null,
    asset_content_link_ids IS NULL as asset_content_link_ids_null,
    quest_tag_link_ids IS NULL as quest_tag_link_ids_null,
    asset_tag_link_ids IS NULL as asset_tag_link_ids_null
FROM project_closure 
WHERE 
    quest_ids IS NULL OR 
    asset_ids IS NULL OR 
    translation_ids IS NULL OR 
    vote_ids IS NULL OR 
    tag_ids IS NULL OR 
    language_ids IS NULL OR 
    quest_asset_link_ids IS NULL OR 
    asset_content_link_ids IS NULL OR 
    quest_tag_link_ids IS NULL OR 
    asset_tag_link_ids IS NULL;

-- 3. Check indexes on closure tables
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('project_closure', 'quest_closure')
ORDER BY tablename, indexname;

-- 4. Check indexes on download_profiles columns
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE indexdef LIKE '%download_profiles%'
ORDER BY tablename, indexname;

-- 5. Test a simple JSONB operation on the largest closure
WITH largest_closure AS (
    SELECT * FROM project_closure 
    ORDER BY 
        jsonb_array_length(COALESCE(quest_ids, '[]'::jsonb)) + 
        jsonb_array_length(COALESCE(asset_ids, '[]'::jsonb)) DESC
    LIMIT 1
)
SELECT 
    project_id,
    (SELECT COUNT(*) FROM (SELECT jsonb_array_elements_text(quest_ids)) AS t) as quest_ids_parsed,
    (SELECT COUNT(*) FROM (SELECT jsonb_array_elements_text(asset_ids)) AS t) as asset_ids_parsed
FROM largest_closure; 