-- Revert Dynamic Download System (Functions and Triggers Only)
-- ================================================================
-- 
-- This migration removes the functions and triggers from the dynamic download system
-- migration (20250616211432_complete_dynamic_download_system.sql) that were replaced
-- by the closure-based download system.
--
-- NOTE: We keep the download_profiles columns and indexes as they are still used
-- by the closure-based system introduced in later migrations.

-- ====================================
-- PART 1: Drop Triggers
-- ====================================

-- Drop triggers from all tables that had them
-- Based on the tree structure: language, project, quest, asset, translation, 
-- quest_tag_link, tag, quest_asset_link, asset_tag_link, asset_content_link, vote

DROP TRIGGER IF EXISTS propagate_download_profiles_trigger ON language;
DROP TRIGGER IF EXISTS cascade_download_profiles_trigger ON language;
DROP TRIGGER IF EXISTS handle_parent_change_trigger ON language;

DROP TRIGGER IF EXISTS propagate_download_profiles_trigger ON project;
DROP TRIGGER IF EXISTS cascade_download_profiles_trigger ON project;
DROP TRIGGER IF EXISTS handle_parent_change_trigger ON project;

DROP TRIGGER IF EXISTS propagate_download_profiles_trigger ON quest;
DROP TRIGGER IF EXISTS cascade_download_profiles_trigger ON quest;
DROP TRIGGER IF EXISTS handle_parent_change_trigger ON quest;

DROP TRIGGER IF EXISTS propagate_download_profiles_trigger ON asset;
DROP TRIGGER IF EXISTS cascade_download_profiles_trigger ON asset;
DROP TRIGGER IF EXISTS handle_parent_change_trigger ON asset;

DROP TRIGGER IF EXISTS propagate_download_profiles_trigger ON translation;
DROP TRIGGER IF EXISTS cascade_download_profiles_trigger ON translation;
DROP TRIGGER IF EXISTS handle_parent_change_trigger ON translation;

DROP TRIGGER IF EXISTS propagate_download_profiles_trigger ON quest_tag_link;
DROP TRIGGER IF EXISTS cascade_download_profiles_trigger ON quest_tag_link;
DROP TRIGGER IF EXISTS handle_parent_change_trigger ON quest_tag_link;

DROP TRIGGER IF EXISTS propagate_download_profiles_trigger ON tag;
DROP TRIGGER IF EXISTS cascade_download_profiles_trigger ON tag;
DROP TRIGGER IF EXISTS handle_parent_change_trigger ON tag;

DROP TRIGGER IF EXISTS propagate_download_profiles_trigger ON quest_asset_link;
DROP TRIGGER IF EXISTS cascade_download_profiles_trigger ON quest_asset_link;
DROP TRIGGER IF EXISTS handle_parent_change_trigger ON quest_asset_link;

DROP TRIGGER IF EXISTS propagate_download_profiles_trigger ON asset_tag_link;
DROP TRIGGER IF EXISTS cascade_download_profiles_trigger ON asset_tag_link;
DROP TRIGGER IF EXISTS handle_parent_change_trigger ON asset_tag_link;

DROP TRIGGER IF EXISTS propagate_download_profiles_trigger ON asset_content_link;
DROP TRIGGER IF EXISTS cascade_download_profiles_trigger ON asset_content_link;
DROP TRIGGER IF EXISTS handle_parent_change_trigger ON asset_content_link;

DROP TRIGGER IF EXISTS propagate_download_profiles_trigger ON vote;
DROP TRIGGER IF EXISTS cascade_download_profiles_trigger ON vote;
DROP TRIGGER IF EXISTS handle_parent_change_trigger ON vote;

-- ====================================
-- PART 2: Drop Views
-- ====================================

DROP VIEW IF EXISTS download_tree_structure;

-- ====================================
-- PART 3: Drop Functions
-- ====================================

-- Main API functions
DROP FUNCTION IF EXISTS download_records(text, uuid[], text);
DROP FUNCTION IF EXISTS download_record(text, uuid, text);

-- Utility and analysis functions
DROP FUNCTION IF EXISTS get_all_related_records(text, uuid);
DROP FUNCTION IF EXISTS get_records_for_node(jsonb, text, uuid[]);

-- Trigger management functions
DROP FUNCTION IF EXISTS create_download_update_triggers();
DROP FUNCTION IF EXISTS create_download_propagation_triggers();

-- Trigger functions
DROP FUNCTION IF EXISTS handle_parent_change_update();
DROP FUNCTION IF EXISTS handle_download_profiles_update();
DROP FUNCTION IF EXISTS propagate_download_profiles_on_insert();

-- Tree traversal and processing functions
DROP FUNCTION IF EXISTS process_download_tree(text, uuid[], uuid, text);
DROP FUNCTION IF EXISTS get_child_ids_for_node(jsonb, text, uuid[]);
DROP FUNCTION IF EXISTS get_all_tables_from_tree(jsonb);
DROP FUNCTION IF EXISTS get_record_id_value(text, record);

-- Parent table lookup functions
DROP FUNCTION IF EXISTS search_parent_table_recursive(jsonb, text, text);
DROP FUNCTION IF EXISTS has_child_table(jsonb, text);
DROP FUNCTION IF EXISTS find_parent_table_for_field(jsonb, text, text);

-- Reference counting functions for safe removal
DROP FUNCTION IF EXISTS count_reverse_references_to_record(jsonb, text, uuid, uuid);
DROP FUNCTION IF EXISTS count_direct_references_to_record(jsonb, text, uuid, uuid);
DROP FUNCTION IF EXISTS count_references_to_record_in_tree(jsonb, text, uuid, uuid);
DROP FUNCTION IF EXISTS is_profile_still_needed_for_shared_resource(text, uuid, uuid);

-- Relationship discovery functions
DROP FUNCTION IF EXISTS find_all_child_relationships(jsonb, text);
DROP FUNCTION IF EXISTS find_all_parent_relationships(jsonb, text);

-- Safe removal functions
DROP FUNCTION IF EXISTS safe_remove_download_profiles(text, uuid, text, text[]);

-- Download profile management functions
DROP FUNCTION IF EXISTS update_download_profiles(text, uuid, text, text, text[]);
DROP FUNCTION IF EXISTS get_parent_download_profiles(text, uuid);
DROP FUNCTION IF EXISTS normalize_download_profiles(uuid[]);

-- Tree structure and navigation functions
DROP FUNCTION IF EXISTS is_non_empty_array(jsonb);
DROP FUNCTION IF EXISTS get_id_field_for_table(text);
DROP FUNCTION IF EXISTS get_id_field_from_node(jsonb);
DROP FUNCTION IF EXISTS find_node_in_tree(jsonb, text);
DROP FUNCTION IF EXISTS get_download_tree_structure();

-- Note: We explicitly keep the download_profiles columns and their indexes
-- as they are still used by the closure-based download system that replaced
-- this tree-based system. 