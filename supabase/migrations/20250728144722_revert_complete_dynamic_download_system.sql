-- Revert Complete Dynamic Download System
-- ======================================
-- 
-- This migration reverts all changes made by 20250616211432_complete_dynamic_download_system.sql
-- It removes the dynamic download system and restores the previous state.

-- ====================================
-- PART 1: Drop All Triggers
-- ====================================

-- Get all table names that had triggers and drop them
DO $$
DECLARE
    v_tables text[] := ARRAY['language', 'project', 'quest', 'asset', 'translation', 'quest_tag_link', 'tag', 'quest_asset_link', 'asset_tag_link', 'asset_content_link', 'vote'];
    v_table text;
BEGIN
    FOREACH v_table IN ARRAY v_tables
    LOOP
        -- Drop all download-related triggers
        EXECUTE format('DROP TRIGGER IF EXISTS propagate_download_profiles_trigger ON %I', v_table);
        EXECUTE format('DROP TRIGGER IF EXISTS cascade_download_profiles_trigger ON %I', v_table);
        EXECUTE format('DROP TRIGGER IF EXISTS handle_parent_change_trigger ON %I', v_table);
    END LOOP;
END;
$$;

-- ====================================
-- PART 2: Drop Views First (before functions)
-- ====================================

DROP VIEW IF EXISTS download_tree_structure;

-- ====================================
-- PART 3: Drop All Functions
-- ====================================

-- Drop all functions created by the download system (in reverse dependency order)
DROP FUNCTION IF EXISTS download_record(text, uuid, text);
DROP FUNCTION IF EXISTS download_records(text, uuid[], text);
DROP FUNCTION IF EXISTS get_records_for_node(jsonb, text, uuid[]);
DROP FUNCTION IF EXISTS get_all_related_records(text, uuid);
DROP FUNCTION IF EXISTS create_download_update_triggers();
DROP FUNCTION IF EXISTS create_download_propagation_triggers();
DROP FUNCTION IF EXISTS handle_parent_change_update();
DROP FUNCTION IF EXISTS handle_download_profiles_update();
DROP FUNCTION IF EXISTS get_record_id_value(text, record);
DROP FUNCTION IF EXISTS get_all_tables_from_tree(jsonb);
DROP FUNCTION IF EXISTS search_parent_table_recursive(jsonb, text, text);
DROP FUNCTION IF EXISTS has_child_table(jsonb, text);
DROP FUNCTION IF EXISTS find_parent_table_for_field(jsonb, text, text);
DROP FUNCTION IF EXISTS propagate_download_profiles_on_insert();
DROP FUNCTION IF EXISTS normalize_download_profiles(uuid[]);
DROP FUNCTION IF EXISTS process_download_tree(text, uuid[], uuid, text);
DROP FUNCTION IF EXISTS get_child_ids_for_node(jsonb, text, uuid[]);
DROP FUNCTION IF EXISTS is_non_empty_array(jsonb);
DROP FUNCTION IF EXISTS get_parent_download_profiles(text, uuid);
DROP FUNCTION IF EXISTS find_all_child_relationships(jsonb, text);
DROP FUNCTION IF EXISTS find_all_parent_relationships(jsonb, text);
DROP FUNCTION IF EXISTS count_reverse_references_to_record(jsonb, text, uuid, uuid);
DROP FUNCTION IF EXISTS count_direct_references_to_record(jsonb, text, uuid, uuid);
DROP FUNCTION IF EXISTS count_references_to_record_in_tree(jsonb, text, uuid, uuid);
DROP FUNCTION IF EXISTS is_profile_still_needed_for_shared_resource(text, uuid, uuid);
DROP FUNCTION IF EXISTS safe_remove_download_profiles(text, uuid, text, text[]);
DROP FUNCTION IF EXISTS update_download_profiles(text, uuid, text, text, text[]);
DROP FUNCTION IF EXISTS get_id_field_for_table(text);
DROP FUNCTION IF EXISTS get_id_field_from_node(jsonb);
DROP FUNCTION IF EXISTS find_node_in_tree(jsonb, text);
DROP FUNCTION IF EXISTS get_download_tree_structure();

-- Drop any additional helper functions that might exist
DROP FUNCTION IF EXISTS find_all_paths_to_table(jsonb, text);
DROP FUNCTION IF EXISTS build_reference_count_sql(jsonb, uuid, uuid);

-- ====================================
-- PART 4: Remove download_profiles Columns
-- ====================================

-- Remove download_profiles columns from all tables
ALTER TABLE language DROP COLUMN IF EXISTS download_profiles;
ALTER TABLE project DROP COLUMN IF EXISTS download_profiles;
ALTER TABLE quest DROP COLUMN IF EXISTS download_profiles;
ALTER TABLE asset DROP COLUMN IF EXISTS download_profiles;
ALTER TABLE translation DROP COLUMN IF EXISTS download_profiles;
ALTER TABLE quest_tag_link DROP COLUMN IF EXISTS download_profiles;
ALTER TABLE tag DROP COLUMN IF EXISTS download_profiles;
ALTER TABLE quest_asset_link DROP COLUMN IF EXISTS download_profiles;
ALTER TABLE asset_tag_link DROP COLUMN IF EXISTS download_profiles;
ALTER TABLE asset_content_link DROP COLUMN IF EXISTS download_profiles;
ALTER TABLE vote DROP COLUMN IF EXISTS download_profiles;

-- ====================================
-- REVERT COMPLETE
-- ====================================

-- The dynamic download system has been completely reverted.
-- All download_profiles columns, functions, triggers, indexes, and views have been removed.
-- The system is now back to its state before the dynamic download system was implemented. 