-- Complete Dynamic Download System with Automatic Propagation
-- ===========================================================
-- 
-- This migration creates a comprehensive download system that:
-- 1. Uses a dynamic tree structure for flexible table relationships
-- 2. Automatically propagates download_profiles from parent to child records
-- 3. Handles INSERT and UPDATE operations for seamless download tracking
--
-- The tree structure is defined in get_download_tree_structure() and can be
-- easily modified without changing the core logic.

-- Drop old download tables (replaced by download_profiles columns)
DROP TABLE IF EXISTS project_download CASCADE;
DROP TABLE IF EXISTS quest_download CASCADE;
DROP TABLE IF EXISTS asset_download CASCADE;

-- Add download_profiles columns to all relevant tables
ALTER TABLE project ADD COLUMN IF NOT EXISTS download_profiles uuid[] DEFAULT NULL;
ALTER TABLE quest ADD COLUMN IF NOT EXISTS download_profiles uuid[] DEFAULT NULL;
ALTER TABLE asset ADD COLUMN IF NOT EXISTS download_profiles uuid[] DEFAULT NULL;
ALTER TABLE translation ADD COLUMN IF NOT EXISTS download_profiles uuid[] DEFAULT NULL;
ALTER TABLE quest_tag_link ADD COLUMN IF NOT EXISTS download_profiles uuid[] DEFAULT NULL;
ALTER TABLE tag ADD COLUMN IF NOT EXISTS download_profiles uuid[] DEFAULT NULL;
ALTER TABLE quest_asset_link ADD COLUMN IF NOT EXISTS download_profiles uuid[] DEFAULT NULL;
ALTER TABLE asset_tag_link ADD COLUMN IF NOT EXISTS download_profiles uuid[] DEFAULT NULL;
ALTER TABLE asset_content_link ADD COLUMN IF NOT EXISTS download_profiles uuid[] DEFAULT NULL;
ALTER TABLE vote ADD COLUMN IF NOT EXISTS download_profiles uuid[] DEFAULT NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_project_download_profiles ON project USING GIN (download_profiles);
CREATE INDEX IF NOT EXISTS idx_quest_download_profiles ON quest USING GIN (download_profiles);
CREATE INDEX IF NOT EXISTS idx_asset_download_profiles ON asset USING GIN (download_profiles);
CREATE INDEX IF NOT EXISTS idx_translation_download_profiles ON translation USING GIN (download_profiles);
CREATE INDEX IF NOT EXISTS idx_quest_tag_link_download_profiles ON quest_tag_link USING GIN (download_profiles);
CREATE INDEX IF NOT EXISTS idx_tag_download_profiles ON tag USING GIN (download_profiles);
CREATE INDEX IF NOT EXISTS idx_quest_asset_link_download_profiles ON quest_asset_link USING GIN (download_profiles);
CREATE INDEX IF NOT EXISTS idx_asset_tag_link_download_profiles ON asset_tag_link USING GIN (download_profiles);
CREATE INDEX IF NOT EXISTS idx_asset_content_link_download_profiles ON asset_content_link USING GIN (download_profiles);
CREATE INDEX IF NOT EXISTS idx_vote_download_profiles ON vote USING GIN (download_profiles);

-- ====================================
-- PART 1: Dynamic Tree Structure
-- ====================================

-- Create a function that returns the download tree structure
CREATE OR REPLACE FUNCTION get_download_tree_structure()
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    RETURN '{
        "table": "project",
        "children": [
            {
                "table": "quest",
                "parentField": "project_id",
                "children": [
                    {
                        "table": "quest_tag_link",
                        "idField": "tag_id",
                        "keyFields": ["tag_id", "quest_id"],
                        "parentField": "quest_id",
                        "children": [
                            {
                                "table": "tag",
                                "parentField": "id"
                            }
                        ]
                    },
                    {
                        "table": "quest_asset_link",
                        "idField": "asset_id",
                        "keyFields": ["asset_id", "quest_id"],
                        "parentField": "quest_id",
                        "children": [
                            {
                                "table": "asset",
                                "parentField": "id",
                                "children": [
                                    {
                                        "table": "asset_tag_link",
                                        "idField": "tag_id",
                                        "keyFields": ["tag_id", "asset_id"],
                                        "parentField": "asset_id",
                                        "children": [
                                            {
                                                "table": "tag",
                                                "parentField": "id"
                                            }
                                        ]
                                    },
                                    {
                                        "table": "asset_content_link",
                                        "idField": "id",
                                        "parentField": "asset_id"
                                    },
                                    {
                                        "table": "translation",
                                        "parentField": "asset_id",
                                        "children": [
                                            {
                                                "table": "vote",
                                                "parentField": "translation_id"
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        ]
    }'::jsonb;
END;
$$;

-- Helper function to find a node in the tree by table name
CREATE OR REPLACE FUNCTION find_node_in_tree(
    p_tree jsonb,
    p_table_name text
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_children jsonb;
    v_child jsonb;
    v_result jsonb;
BEGIN
    -- Check if current node matches
    IF p_tree->>'table' = p_table_name THEN
        RETURN p_tree;
    END IF;
    
    -- Check children recursively
    v_children := p_tree->'children';
    IF v_children IS NOT NULL AND jsonb_typeof(v_children) = 'array' THEN
        FOR v_child IN SELECT * FROM jsonb_array_elements(v_children)
        LOOP
            v_result := find_node_in_tree(v_child, p_table_name);
            IF v_result IS NOT NULL THEN
                RETURN v_result;
            END IF;
        END LOOP;
    END IF;
    
    RETURN NULL;
END;
$$;

-- Dynamic process_download_tree function
CREATE OR REPLACE FUNCTION process_download_tree(
    p_table_name text,
    p_record_ids uuid[],
    p_profile_id uuid,
    p_operation text DEFAULT 'add' -- 'add' or 'remove'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tree jsonb;
    v_node jsonb;
    v_sql text;
    v_child_ids uuid[];
    v_children jsonb;
    v_child jsonb;
    v_parent_field text;
    v_key_fields text[];
    v_id_field text;
BEGIN
    -- Validate operation
    IF p_operation NOT IN ('add', 'remove') THEN
        RAISE EXCEPTION 'Invalid operation: %. Must be "add" or "remove"', p_operation;
    END IF;
    
    -- Handle empty record_ids
    IF p_record_ids IS NULL OR array_length(p_record_ids, 1) IS NULL THEN
        RETURN;
    END IF;
    
    -- Get the tree structure
    v_tree := get_download_tree_structure();
    
    -- Find the node for the current table
    v_node := find_node_in_tree(v_tree, p_table_name);
    
    IF v_node IS NULL THEN
        RAISE EXCEPTION 'Table % not found in download tree', p_table_name;
    END IF;
    
    -- Update download_profiles for the current table
    IF p_operation = 'add' THEN
        v_sql := format('
            UPDATE %I 
            SET download_profiles = normalize_download_profiles(
                array_append(
                    array_remove(download_profiles, %L::uuid), 
                    %L::uuid
                )
            )
            WHERE id = ANY(%L::uuid[])
        ', p_table_name, p_profile_id, p_profile_id, p_record_ids);
    ELSE
        v_sql := format('
            UPDATE %I 
            SET download_profiles = normalize_download_profiles(
                array_remove(download_profiles, %L::uuid)
            )
            WHERE id = ANY(%L::uuid[])
        ', p_table_name, p_profile_id, p_record_ids);
    END IF;
    
    EXECUTE v_sql;
    
    -- Process children if any
    v_children := v_node->'children';
    IF v_children IS NOT NULL AND jsonb_typeof(v_children) = 'array' THEN
        FOR v_child IN SELECT * FROM jsonb_array_elements(v_children)
        LOOP
            v_parent_field := v_child->>'parentField';
            
            -- Check if this is a composite key table
            IF v_child->'keyFields' IS NOT NULL THEN
                -- Handle composite key tables
                PERFORM process_composite_key_table(
                    v_child,
                    p_record_ids,
                    p_profile_id,
                    p_operation,
                    v_parent_field
                );
            ELSE
                -- Handle regular tables
                v_id_field := COALESCE(v_child->>'idField', 'id');
                
                -- Get child IDs based on parent relationship
                v_sql := format('
                    SELECT array_agg(DISTINCT %I) 
                    FROM %I 
                    WHERE %I = ANY(%L::uuid[])
                ', v_id_field, v_child->>'table', v_parent_field, p_record_ids);
                
                EXECUTE v_sql INTO v_child_ids;
                
                -- Recursively process children
                IF v_child_ids IS NOT NULL AND array_length(v_child_ids, 1) > 0 THEN
                    PERFORM process_download_tree(
                        v_child->>'table', 
                        v_child_ids, 
                        p_profile_id, 
                        p_operation
                    );
                END IF;
            END IF;
        END LOOP;
    END IF;
END;
$$;

-- Helper function to process composite key tables
CREATE OR REPLACE FUNCTION process_composite_key_table(
    p_node jsonb,
    p_parent_ids uuid[],
    p_profile_id uuid,
    p_operation text,
    p_parent_field text
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_table_name text;
    v_sql text;
    v_key_fields jsonb;
    v_id_field text;
    v_child_ids uuid[];
    v_children jsonb;
    v_child jsonb;
    v_where_clause text;
    v_key_field text;
    v_temp_sql text;
BEGIN
    v_table_name := p_node->>'table';
    v_key_fields := p_node->'keyFields';
    v_id_field := COALESCE(p_node->>'idField', (v_key_fields->>0)::text, 'id');
    
    -- For composite key tables, we need to be more careful about which records to update
    -- If keyFields are defined, we should consider using them for more precise updates
    IF v_key_fields IS NOT NULL AND jsonb_typeof(v_key_fields) = 'array' THEN
        -- For now, we still use parent_field as the main filter
        -- This is correct behavior when downloading a parent and all its related junction records
        v_where_clause := format('%I = ANY(%L::uuid[])', p_parent_field, p_parent_ids);
    ELSE
        -- For non-composite key tables, use the parent field
        v_where_clause := format('%I = ANY(%L::uuid[])', p_parent_field, p_parent_ids);
    END IF;
    
    -- Update download_profiles for the composite key table
    IF p_operation = 'add' THEN
        v_sql := format('
            UPDATE %I 
            SET download_profiles = normalize_download_profiles(
                array_append(
                    array_remove(download_profiles, %L::uuid), 
                    %L::uuid
                )
            )
            WHERE %s
        ', v_table_name, p_profile_id, p_profile_id, v_where_clause);
    ELSE
        v_sql := format('
            UPDATE %I 
            SET download_profiles = normalize_download_profiles(
                array_remove(download_profiles, %L::uuid)
            )
            WHERE %s
        ', v_table_name, p_profile_id, v_where_clause);
    END IF;
    
    EXECUTE v_sql;
    
    -- Get the IDs for child processing
    v_sql := format('
        SELECT array_agg(DISTINCT %I) 
        FROM %I 
        WHERE %s
    ', v_id_field, v_table_name, v_where_clause);
    
    EXECUTE v_sql INTO v_child_ids;
    
    -- Process children if any
    v_children := p_node->'children';
    IF v_children IS NOT NULL AND jsonb_typeof(v_children) = 'array' AND 
       v_child_ids IS NOT NULL AND array_length(v_child_ids, 1) > 0 THEN
        FOR v_child IN SELECT * FROM jsonb_array_elements(v_children)
        LOOP
            PERFORM process_download_tree(
                v_child->>'table', 
                v_child_ids, 
                p_profile_id, 
                p_operation
            );
        END LOOP;
    END IF;
END;
$$;

-- Helper function to normalize download_profiles (convert empty arrays to null)
CREATE OR REPLACE FUNCTION normalize_download_profiles(p_profiles uuid[])
RETURNS uuid[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF p_profiles IS NULL OR array_length(p_profiles, 1) IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN p_profiles;
END;
$$;

-- Convenience function to check if a record is downloaded by a profile
CREATE OR REPLACE FUNCTION is_downloaded(
    p_table_name text,
    p_record_id uuid,
    p_profile_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_result boolean;
BEGIN
    EXECUTE format('
        SELECT %L = ANY(download_profiles)
        FROM %I
        WHERE id = %L
    ', p_profile_id, p_table_name, p_record_id)
    INTO v_result;
    
    RETURN COALESCE(v_result, false);
END;
$$;

-- ====================================
-- PART 2: Automatic Propagation
-- ====================================

-- Generic trigger function to propagate download_profiles from parent
CREATE OR REPLACE FUNCTION propagate_download_profiles_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_tree jsonb;
    v_node jsonb;
    v_parent_node jsonb;
    v_parent_table text;
    v_parent_field text;
    v_parent_id uuid;
    v_parent_profiles uuid[];
    v_sql text;
BEGIN
    -- Get the download tree structure
    v_tree := get_download_tree_structure();
    
    -- Find the current table's node in the tree
    v_node := find_node_in_tree(v_tree, TG_TABLE_NAME);
    
    IF v_node IS NULL THEN
        -- Table not in tree, just return the new record as-is
        RETURN NEW;
    END IF;
    
    -- Get parent field from the node
    v_parent_field := v_node->>'parentField';
    
    -- If no parent field or it's the root table, return as-is
    IF v_parent_field IS NULL OR v_node->>'table' = (v_tree->>'table') THEN
        RETURN NEW;
    END IF;
    
    -- Get the parent ID from the new record
    EXECUTE format('SELECT ($1).%I::uuid', v_parent_field) 
    USING NEW 
    INTO v_parent_id;
    
    -- If parent ID is null, return as-is
    IF v_parent_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Find parent table by searching the tree
    v_parent_table := find_parent_table_for_field(v_tree, TG_TABLE_NAME, v_parent_field);
    
    IF v_parent_table IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Get parent's download_profiles
    -- Need to determine the correct ID field for the parent table
    DECLARE
        v_parent_node jsonb;
        v_parent_id_field text;
    BEGIN
        v_parent_node := find_node_in_tree(v_tree, v_parent_table);
        v_parent_id_field := COALESCE(v_parent_node->>'idField', 'id');
        
        v_sql := format('
            SELECT download_profiles 
            FROM %I 
            WHERE %I = %L
        ', v_parent_table, v_parent_id_field, v_parent_id);
    END;
    
    EXECUTE v_sql INTO v_parent_profiles;
    
    -- Set the download_profiles on the new record
    NEW.download_profiles := normalize_download_profiles(v_parent_profiles);
    
    RETURN NEW;
END;
$$;

-- Helper function to find parent table for a given child table and parent field
CREATE OR REPLACE FUNCTION find_parent_table_for_field(
    p_tree jsonb,
    p_child_table text,
    p_parent_field text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_result text;
BEGIN
    -- First check if the parent field matches 'id' on the current node's table
    -- This handles direct parent-child relationships
    IF p_parent_field = 'id' AND p_tree->>'table' IS NOT NULL THEN
        -- Check if this table has the child as a direct child
        IF has_child_table(p_tree, p_child_table) THEN
            RETURN p_tree->>'table';
        END IF;
    END IF;
    
    -- For other cases, we need to search the tree
    v_result := search_parent_table_recursive(p_tree, p_child_table, p_parent_field);
    
    RETURN v_result;
END;
$$;

-- Helper function to check if a node has a specific child table
CREATE OR REPLACE FUNCTION has_child_table(
    p_node jsonb,
    p_child_table text
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_children jsonb;
    v_child jsonb;
BEGIN
    v_children := p_node->'children';
    IF v_children IS NOT NULL AND jsonb_typeof(v_children) = 'array' THEN
        FOR v_child IN SELECT * FROM jsonb_array_elements(v_children)
        LOOP
            IF v_child->>'table' = p_child_table THEN
                RETURN true;
            END IF;
        END LOOP;
    END IF;
    RETURN false;
END;
$$;

-- Recursive function to search for parent table
CREATE OR REPLACE FUNCTION search_parent_table_recursive(
    p_tree jsonb,
    p_child_table text,
    p_parent_field text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_children jsonb;
    v_child jsonb;
    v_result text;
    v_child_parent_field text;
BEGIN
    v_children := p_tree->'children';
    IF v_children IS NOT NULL AND jsonb_typeof(v_children) = 'array' THEN
        FOR v_child IN SELECT * FROM jsonb_array_elements(v_children)
        LOOP
            -- Check if this child is our target table
            IF v_child->>'table' = p_child_table THEN
                v_child_parent_field := v_child->>'parentField';
                -- If the parent field matches what we expect for the current level
                IF v_child_parent_field = (p_tree->>'table' || '_id') OR 
                   v_child_parent_field = 'id' OR
                   (p_tree->>'idField' IS NOT NULL AND v_child_parent_field = p_tree->>'idField') THEN
                    RETURN p_tree->>'table';
                END IF;
            END IF;
            
            -- Recursively search in children
            v_result := search_parent_table_recursive(v_child, p_child_table, p_parent_field);
            IF v_result IS NOT NULL THEN
                RETURN v_result;
            END IF;
        END LOOP;
    END IF;
    
    RETURN NULL;
END;
$$;

-- Function to get all table names from the tree
CREATE OR REPLACE FUNCTION get_all_tables_from_tree(p_tree jsonb)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_tables text[] := '{}';
    v_children jsonb;
    v_child jsonb;
    v_child_tables text[];
BEGIN
    -- Add current table
    IF p_tree->>'table' IS NOT NULL THEN
        v_tables := array_append(v_tables, p_tree->>'table');
    END IF;
    
    -- Process children
    v_children := p_tree->'children';
    IF v_children IS NOT NULL AND jsonb_typeof(v_children) = 'array' THEN
        FOR v_child IN SELECT * FROM jsonb_array_elements(v_children)
        LOOP
            v_child_tables := get_all_tables_from_tree(v_child);
            v_tables := array_cat(v_tables, v_child_tables);
        END LOOP;
    END IF;
    
    -- Remove duplicates
    SELECT array_agg(DISTINCT unnest) INTO v_tables FROM unnest(v_tables);
    
    RETURN v_tables;
END;
$$;

-- Helper function to get the correct ID field value for a record in any table
CREATE OR REPLACE FUNCTION get_record_id_value(
    p_table_name text,
    p_record record
)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_tree jsonb;
    v_node jsonb;
    v_id_field text;
    v_result uuid;
BEGIN
    -- Get the download tree structure
    v_tree := get_download_tree_structure();
    
    -- Find the node for the table
    v_node := find_node_in_tree(v_tree, p_table_name);
    
    IF v_node IS NULL THEN
        -- Default to 'id' if table not found in tree
        v_id_field := 'id';
    ELSE
        -- Get the ID field from the node, default to 'id'
        v_id_field := COALESCE(v_node->>'idField', 'id');
    END IF;
    
    -- Extract the ID value from the record
    EXECUTE format('SELECT ($1).%I::uuid', v_id_field) 
    USING p_record 
    INTO v_result;
    
    RETURN v_result;
END;
$$;

-- Trigger function to handle updates that might affect download_profiles
CREATE OR REPLACE FUNCTION handle_download_profiles_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_tree jsonb;
    v_node jsonb;
    v_children jsonb;
    v_child jsonb;
    v_child_table text;
    v_parent_field text;
    v_sql text;
    v_current_id uuid;
BEGIN
    -- Only proceed if download_profiles changed
    IF OLD.download_profiles IS DISTINCT FROM NEW.download_profiles THEN
        -- Get the correct ID value for the current record
        v_current_id := get_record_id_value(TG_TABLE_NAME, NEW);
        
        -- Get the download tree structure
        v_tree := get_download_tree_structure();
        
        -- Find the current table's node in the tree
        v_node := find_node_in_tree(v_tree, TG_TABLE_NAME);
        
        IF v_node IS NOT NULL THEN
            -- Get children of this node
            v_children := v_node->'children';
            
            IF v_children IS NOT NULL AND jsonb_typeof(v_children) = 'array' THEN
                -- Update all child tables
                FOR v_child IN SELECT * FROM jsonb_array_elements(v_children)
                LOOP
                    v_child_table := v_child->>'table';
                    v_parent_field := v_child->>'parentField';
                    
                    IF v_child_table IS NOT NULL AND v_parent_field IS NOT NULL THEN
                        -- Update child records that reference this parent
                        v_sql := format('
                            UPDATE %I 
                            SET download_profiles = normalize_download_profiles(%L::uuid[])
                            WHERE %I = %L::uuid
                        ', v_child_table, NEW.download_profiles, v_parent_field, v_current_id);
                        
                        EXECUTE v_sql;
                    END IF;
                END LOOP;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Trigger function to handle when a record's parent changes
CREATE OR REPLACE FUNCTION handle_parent_change_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_tree jsonb;
    v_node jsonb;
    v_parent_field text;
    v_parent_table text;
    v_old_parent_id uuid;
    v_new_parent_id uuid;
    v_parent_profiles uuid[];
    v_sql text;
BEGIN
    -- Get the download tree structure
    v_tree := get_download_tree_structure();
    
    -- Find the current table's node in the tree
    v_node := find_node_in_tree(v_tree, TG_TABLE_NAME);
    
    IF v_node IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Get parent field from the node
    v_parent_field := v_node->>'parentField';
    
    IF v_parent_field IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Get old and new parent IDs
    EXECUTE format('SELECT ($1).%I::uuid', v_parent_field) USING OLD INTO v_old_parent_id;
    EXECUTE format('SELECT ($1).%I::uuid', v_parent_field) USING NEW INTO v_new_parent_id;
    
    -- If parent changed, update download_profiles from new parent
    IF v_old_parent_id IS DISTINCT FROM v_new_parent_id AND v_new_parent_id IS NOT NULL THEN
        v_parent_table := find_parent_table_for_field(v_tree, TG_TABLE_NAME, v_parent_field);
        
        IF v_parent_table IS NOT NULL THEN
            -- Get new parent's download_profiles
            -- Need to determine the correct ID field for the parent table
            DECLARE
                v_parent_node jsonb;
                v_parent_id_field text;
            BEGIN
                v_parent_node := find_node_in_tree(v_tree, v_parent_table);
                v_parent_id_field := COALESCE(v_parent_node->>'idField', 'id');
                
                v_sql := format('
                    SELECT download_profiles 
                    FROM %I 
                    WHERE %I = %L
                ', v_parent_table, v_parent_id_field, v_new_parent_id);
            END;
            
            EXECUTE v_sql INTO v_parent_profiles;
            
            -- Update the record's download_profiles
            NEW.download_profiles := normalize_download_profiles(v_parent_profiles);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- ====================================
-- PART 3: Create All Triggers
-- ====================================

-- Function to create triggers for all tables in the download tree
CREATE OR REPLACE FUNCTION create_download_propagation_triggers()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_tree jsonb;
    v_tables text[];
    v_table text;
BEGIN
    -- Get all table names from the tree
    v_tables := get_all_tables_from_tree(get_download_tree_structure());
    
    -- Create trigger for each table
    FOREACH v_table IN ARRAY v_tables
    LOOP
        -- Drop existing trigger if it exists
        EXECUTE format('DROP TRIGGER IF EXISTS propagate_download_profiles_trigger ON %I', v_table);
        
        -- Create new trigger
        EXECUTE format('
            CREATE TRIGGER propagate_download_profiles_trigger
            BEFORE INSERT ON %I
            FOR EACH ROW
            EXECUTE FUNCTION propagate_download_profiles_on_insert()
        ', v_table);
    END LOOP;
END;
$$;

-- Function to create UPDATE triggers for all tables
CREATE OR REPLACE FUNCTION create_download_update_triggers()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_tables text[];
    v_table text;
BEGIN
    -- Get all table names from the tree
    v_tables := get_all_tables_from_tree(get_download_tree_structure());
    
    -- Create triggers for each table
    FOREACH v_table IN ARRAY v_tables
    LOOP
        -- Drop existing triggers if they exist
        EXECUTE format('DROP TRIGGER IF EXISTS cascade_download_profiles_trigger ON %I', v_table);
        EXECUTE format('DROP TRIGGER IF EXISTS handle_parent_change_trigger ON %I', v_table);
        
        -- Create trigger for cascading download_profiles changes
        EXECUTE format('
            CREATE TRIGGER cascade_download_profiles_trigger
            AFTER UPDATE OF download_profiles ON %I
            FOR EACH ROW
            EXECUTE FUNCTION handle_download_profiles_update()
        ', v_table);
        
        -- Create trigger for parent changes
        EXECUTE format('
            CREATE TRIGGER handle_parent_change_trigger
            BEFORE UPDATE ON %I
            FOR EACH ROW
            EXECUTE FUNCTION handle_parent_change_update()
        ', v_table);
    END LOOP;
END;
$$;

-- Create all triggers
SELECT create_download_propagation_triggers();
SELECT create_download_update_triggers();

-- ====================================
-- PART 4: Utility Functions
-- ====================================

-- Function to manually propagate profiles to existing records
CREATE OR REPLACE FUNCTION backfill_download_profiles(
    p_table_name text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tree jsonb;
    v_tables text[];
    v_table text;
    v_node jsonb;
    v_parent_field text;
    v_parent_table text;
    v_sql text;
BEGIN
    v_tree := get_download_tree_structure();
    
    IF p_table_name IS NOT NULL THEN
        v_tables := ARRAY[p_table_name];
    ELSE
        v_tables := get_all_tables_from_tree(v_tree);
    END IF;
    
    FOREACH v_table IN ARRAY v_tables
    LOOP
        v_node := find_node_in_tree(v_tree, v_table);
        IF v_node IS NULL THEN
            CONTINUE;
        END IF;
        
        v_parent_field := v_node->>'parentField';
        IF v_parent_field IS NULL THEN
            CONTINUE;
        END IF;
        
        v_parent_table := find_parent_table_for_field(v_tree, v_table, v_parent_field);
        IF v_parent_table IS NULL THEN
            CONTINUE;
        END IF;
        
        -- Update records that have empty download_profiles but their parent has profiles
        -- Need to determine the correct ID field for the parent table
        DECLARE
            v_parent_node jsonb;
            v_parent_id_field text;
        BEGIN
            v_parent_node := find_node_in_tree(v_tree, v_parent_table);
            v_parent_id_field := COALESCE(v_parent_node->>'idField', 'id');
            
            v_sql := format('
                UPDATE %I child
                SET download_profiles = normalize_download_profiles(parent.download_profiles)
                FROM %I parent
                WHERE child.%I = parent.%I
                AND (child.download_profiles IS NULL OR array_length(child.download_profiles, 1) IS NULL)
                AND parent.download_profiles IS NOT NULL
                AND array_length(parent.download_profiles, 1) > 0
            ', v_table, v_parent_table, v_parent_field, v_parent_id_field);
        END;
        
        EXECUTE v_sql;
    END LOOP;
END;
$$;

-- Utility function to refresh download_profiles for a specific record and its descendants
CREATE OR REPLACE FUNCTION refresh_download_profiles(
    p_table_name text,
    p_record_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profiles uuid[];
    v_tree jsonb;
    v_node jsonb;
    v_id_field text;
BEGIN
    -- Get the download tree structure and determine the correct ID field
    v_tree := get_download_tree_structure();
    v_node := find_node_in_tree(v_tree, p_table_name);
    v_id_field := COALESCE(v_node->>'idField', 'id');
    
    -- Get current profiles for the record
    EXECUTE format('
        SELECT download_profiles 
        FROM %I 
        WHERE %I = %L
    ', p_table_name, v_id_field, p_record_id) INTO v_profiles;
    
    -- If no profiles, nothing to do
    IF v_profiles IS NULL OR array_length(v_profiles, 1) IS NULL THEN
        RETURN;
    END IF;
    
    -- Use process_download_tree to update this record and all descendants
    PERFORM process_download_tree(p_table_name, ARRAY[p_record_id], unnest, 'add')
    FROM unnest(v_profiles);
END;
$$;

-- ====================================
-- PART 5: Views and Permissions
-- ====================================

-- Create a view to easily see the download tree structure
CREATE OR REPLACE VIEW download_tree_structure AS
SELECT get_download_tree_structure() AS tree;

-- Grant all necessary permissions
-- GRANT EXECUTE ON FUNCTION get_download_tree_structure TO authenticated;
-- GRANT EXECUTE ON FUNCTION find_node_in_tree TO authenticated;
-- GRANT EXECUTE ON FUNCTION process_download_tree TO authenticated;
-- GRANT EXECUTE ON FUNCTION process_composite_key_table TO authenticated;
-- GRANT EXECUTE ON FUNCTION normalize_download_profiles TO authenticated;
-- GRANT EXECUTE ON FUNCTION is_downloaded TO authenticated;
-- GRANT EXECUTE ON FUNCTION propagate_download_profiles_on_insert TO authenticated;
-- GRANT EXECUTE ON FUNCTION find_parent_table_for_field TO authenticated;
-- GRANT EXECUTE ON FUNCTION has_child_table TO authenticated;
-- GRANT EXECUTE ON FUNCTION search_parent_table_recursive TO authenticated;
-- GRANT EXECUTE ON FUNCTION create_download_propagation_triggers TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_all_tables_from_tree TO authenticated;
-- GRANT EXECUTE ON FUNCTION handle_download_profiles_update TO authenticated;
-- GRANT EXECUTE ON FUNCTION handle_parent_change_update TO authenticated;
-- GRANT EXECUTE ON FUNCTION create_download_update_triggers TO authenticated;
-- GRANT EXECUTE ON FUNCTION backfill_download_profiles TO authenticated;
-- GRANT EXECUTE ON FUNCTION refresh_download_profiles TO authenticated;
-- GRANT SELECT ON download_tree_structure TO authenticated;

-- ====================================
-- PART 5: RPC Functions for User Access
-- ====================================

-- RPC function to download records at any level in the tree
CREATE OR REPLACE FUNCTION download_records(
    p_table_name text,
    p_record_ids uuid[],
    p_operation text DEFAULT 'add' -- 'add' or 'remove'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile_id uuid;
    v_tree jsonb;
    v_node jsonb;
    v_affected_tables jsonb;
    v_table_counts jsonb := '{}'::jsonb;
    v_sql text;
    v_count int;
    v_table text;
BEGIN
    -- Get current user's profile ID
    v_profile_id := auth.uid();
    
    IF v_profile_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    
    -- Validate operation
    IF p_operation NOT IN ('add', 'remove') THEN
        RAISE EXCEPTION 'Invalid operation: %. Must be "add" or "remove"', p_operation;
    END IF;
    
    -- Validate table exists in tree
    v_tree := get_download_tree_structure();
    v_node := find_node_in_tree(v_tree, p_table_name);
    
    IF v_node IS NULL THEN
        RAISE EXCEPTION 'Table % not found in download tree', p_table_name;
    END IF;
    
    -- Process the download tree
    PERFORM process_download_tree(p_table_name, p_record_ids, v_profile_id, p_operation);
    
    -- Get count of affected records for each table
    -- This provides feedback on what was downloaded
    FOR v_table IN SELECT unnest(get_all_tables_from_tree(v_node))
    LOOP
        v_sql := format('
            SELECT COUNT(*) 
            FROM %I 
            WHERE %L = ANY(download_profiles)
        ', v_table, v_profile_id);
        
        EXECUTE v_sql INTO v_count;
        
        IF v_count > 0 THEN
            v_table_counts := v_table_counts || jsonb_build_object(v_table, v_count);
        END IF;
    END LOOP;
    
    -- Return summary
    RETURN jsonb_build_object(
        'success', true,
        'operation', p_operation,
        'table', p_table_name,
        'record_count', array_length(p_record_ids, 1),
        'profile_id', v_profile_id,
        'affected_tables', v_table_counts,
        'timestamp', now()
    );
END;
$$;

-- Convenience RPC to download a single record
CREATE OR REPLACE FUNCTION download_record(
    p_table_name text,
    p_record_id uuid,
    p_operation text DEFAULT 'add'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN download_records(p_table_name, ARRAY[p_record_id], p_operation);
END;
$$;

-- RPC function to check download status of a record (simple version for single ID)
CREATE OR REPLACE FUNCTION get_download_status(
    p_record_table text,
    p_record_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile_id uuid;
    v_tree jsonb;
    v_node jsonb;
    v_id_field text;
    v_sql text;
    v_is_downloaded boolean;
BEGIN
    -- Get current user's profile ID
    v_profile_id := auth.uid();
    
    IF v_profile_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    
    -- Get the download tree structure to determine the correct ID field
    v_tree := get_download_tree_structure();
    v_node := find_node_in_tree(v_tree, p_record_table);
    
    -- Determine the ID field (default to 'id' if table not in tree)
    v_id_field := COALESCE(v_node->>'idField', 'id');
    
    -- Check if the record's download_profiles contains the current user
    v_sql := format('
        SELECT CASE 
            WHEN download_profiles IS NULL THEN false
            WHEN %L = ANY(download_profiles) THEN true
            ELSE false
        END
        FROM %I 
        WHERE %I = %L
    ', v_profile_id, p_record_table, v_id_field, p_record_id);
    
    EXECUTE v_sql INTO v_is_downloaded;
    
    -- Return false if record not found
    RETURN COALESCE(v_is_downloaded, false);
END;
$$;

-- RPC function to check download status of a record with composite keys
CREATE OR REPLACE FUNCTION get_download_status_composite(
    p_record_table text,
    p_key_values jsonb  -- e.g., {"quest_id": "uuid1", "tag_id": "uuid2"}
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile_id uuid;
    v_tree jsonb;
    v_node jsonb;
    v_key_fields jsonb;
    v_sql text;
    v_where_clause text := '';
    v_key text;
    v_value text;
    v_is_downloaded boolean;
BEGIN
    -- Get current user's profile ID
    v_profile_id := auth.uid();
    
    IF v_profile_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    
    -- Get the download tree structure to find key fields
    v_tree := get_download_tree_structure();
    v_node := find_node_in_tree(v_tree, p_record_table);
    
    IF v_node IS NULL THEN
        RAISE EXCEPTION 'Table % not found in download tree', p_record_table;
    END IF;
    
    -- Get key fields for the table
    v_key_fields := v_node->'keyFields';
    
    -- Build WHERE clause based on provided keys or keyFields
    IF v_key_fields IS NOT NULL AND jsonb_typeof(v_key_fields) = 'array' THEN
        -- Use keyFields from tree structure
        FOR v_key IN SELECT jsonb_array_elements_text(v_key_fields)
        LOOP
            v_value := p_key_values->>v_key;
            IF v_value IS NULL THEN
                RAISE EXCEPTION 'Missing required key field: %', v_key;
            END IF;
            
            IF v_where_clause != '' THEN
                v_where_clause := v_where_clause || ' AND ';
            END IF;
            v_where_clause := v_where_clause || format('%I = %L::uuid', v_key, v_value);
        END LOOP;
    ELSE
        -- Use all provided keys if no keyFields defined
        FOR v_key, v_value IN SELECT * FROM jsonb_each_text(p_key_values)
        LOOP
            IF v_where_clause != '' THEN
                v_where_clause := v_where_clause || ' AND ';
            END IF;
            v_where_clause := v_where_clause || format('%I = %L::uuid', v_key, v_value);
        END LOOP;
    END IF;
    
    IF v_where_clause = '' THEN
        RAISE EXCEPTION 'No key fields provided for table %', p_record_table;
    END IF;
    
    -- Check if the record's download_profiles contains the current user
    v_sql := format('
        SELECT CASE 
            WHEN download_profiles IS NULL THEN false
            WHEN %L = ANY(download_profiles) THEN true
            ELSE false
        END
        FROM %I 
        WHERE %s
        LIMIT 1
    ', v_profile_id, p_record_table, v_where_clause);
    
    EXECUTE v_sql INTO v_is_downloaded;
    
    -- Return false if record not found
    RETURN COALESCE(v_is_downloaded, false);
END;
$$;

-- Unified RPC function that automatically handles both single ID and composite key cases
CREATE OR REPLACE FUNCTION check_download_status(
    p_record_table text,
    p_keys jsonb  -- Can be either a single UUID string or an object with multiple keys
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tree jsonb;
    v_node jsonb;
    v_key_fields jsonb;
    v_id_field text;
BEGIN
    -- Get the download tree structure
    v_tree := get_download_tree_structure();
    v_node := find_node_in_tree(v_tree, p_record_table);
    
    -- If jsonb is a string, assume it's a single ID
    IF jsonb_typeof(p_keys) = 'string' THEN
        -- Convert to proper format for single ID lookup
        v_id_field := COALESCE(v_node->>'idField', 'id');
        RETURN get_download_status_composite(
            p_record_table, 
            jsonb_build_object(v_id_field, p_keys)
        );
    ELSE
        -- It's already an object with key-value pairs
        RETURN get_download_status_composite(p_record_table, p_keys);
    END IF;
END;
$$;

-- RPC function to download specific composite key records by all their keyFields
CREATE OR REPLACE FUNCTION download_composite_records(
    p_table_name text,
    p_composite_keys jsonb[], -- Array of objects, each with all keyFields
    p_operation text DEFAULT 'add'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile_id uuid;
    v_tree jsonb;
    v_node jsonb;
    v_key_fields jsonb;
    v_sql text;
    v_where_clause text;
    v_key_obj jsonb;
    v_key text;
    v_value text;
    v_updated_count int := 0;
    v_total_count int := 0;
BEGIN
    -- Get current user's profile ID
    v_profile_id := auth.uid();
    
    IF v_profile_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    
    -- Validate operation
    IF p_operation NOT IN ('add', 'remove') THEN
        RAISE EXCEPTION 'Invalid operation: %. Must be "add" or "remove"', p_operation;
    END IF;
    
    -- Get the tree structure to find key fields
    v_tree := get_download_tree_structure();
    v_node := find_node_in_tree(v_tree, p_table_name);
    
    IF v_node IS NULL THEN
        RAISE EXCEPTION 'Table % not found in download tree', p_table_name;
    END IF;
    
    -- Get key fields for the table
    v_key_fields := v_node->'keyFields';
    
    IF v_key_fields IS NULL OR jsonb_typeof(v_key_fields) != 'array' THEN
        RAISE EXCEPTION 'Table % does not have composite keys defined', p_table_name;
    END IF;
    
    -- Process each composite key record
    FOREACH v_key_obj IN ARRAY p_composite_keys
    LOOP
        v_where_clause := '';
        
        -- Build WHERE clause using all keyFields
        FOR v_key IN SELECT jsonb_array_elements_text(v_key_fields)
        LOOP
            v_value := v_key_obj->>v_key;
            IF v_value IS NULL THEN
                RAISE EXCEPTION 'Missing required key field: % for table %', v_key, p_table_name;
            END IF;
            
            IF v_where_clause != '' THEN
                v_where_clause := v_where_clause || ' AND ';
            END IF;
            v_where_clause := v_where_clause || format('%I = %L::uuid', v_key, v_value);
        END LOOP;
        
        -- Update the specific record
        IF p_operation = 'add' THEN
            v_sql := format('
                UPDATE %I 
                SET download_profiles = normalize_download_profiles(
                    array_append(
                        array_remove(download_profiles, %L::uuid), 
                        %L::uuid
                    )
                )
                WHERE %s
            ', p_table_name, v_profile_id, v_profile_id, v_where_clause);
        ELSE
            v_sql := format('
                UPDATE %I 
                SET download_profiles = normalize_download_profiles(
                    array_remove(download_profiles, %L::uuid)
                )
                WHERE %s
            ', p_table_name, v_profile_id, v_where_clause);
        END IF;
        
        EXECUTE v_sql;
        GET DIAGNOSTICS v_updated_count = ROW_COUNT;
        v_total_count := v_total_count + v_updated_count;
    END LOOP;
    
    -- Return summary
    RETURN jsonb_build_object(
        'success', true,
        'operation', p_operation,
        'table', p_table_name,
        'records_processed', array_length(p_composite_keys, 1),
        'records_updated', v_total_count,
        'profile_id', v_profile_id,
        'timestamp', now()
    );
END;
$$;

-- RPC function to get download status for multiple composite key records
CREATE OR REPLACE FUNCTION get_bulk_download_status_composite(
    p_table_name text,
    p_composite_keys jsonb[] -- Array of objects, each with all keyFields
)
RETURNS jsonb[]
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile_id uuid;
    v_tree jsonb;
    v_node jsonb;
    v_key_fields jsonb;
    v_sql text;
    v_where_clause text;
    v_key_obj jsonb;
    v_key text;
    v_value text;
    v_is_downloaded boolean;
    v_results jsonb[] := '{}';
    v_result_obj jsonb;
BEGIN
    -- Get current user's profile ID
    v_profile_id := auth.uid();
    
    IF v_profile_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    
    -- Get the tree structure to find key fields
    v_tree := get_download_tree_structure();
    v_node := find_node_in_tree(v_tree, p_table_name);
    
    IF v_node IS NULL THEN
        RAISE EXCEPTION 'Table % not found in download tree', p_table_name;
    END IF;
    
    -- Get key fields for the table
    v_key_fields := v_node->'keyFields';
    
    IF v_key_fields IS NULL OR jsonb_typeof(v_key_fields) != 'array' THEN
        RAISE EXCEPTION 'Table % does not have composite keys defined', p_table_name;
    END IF;
    
    -- Check each composite key record
    FOREACH v_key_obj IN ARRAY p_composite_keys
    LOOP
        v_where_clause := '';
        
        -- Build WHERE clause using all keyFields
        FOR v_key IN SELECT jsonb_array_elements_text(v_key_fields)
        LOOP
            v_value := v_key_obj->>v_key;
            IF v_value IS NULL THEN
                RAISE EXCEPTION 'Missing required key field: % for table %', v_key, p_table_name;
            END IF;
            
            IF v_where_clause != '' THEN
                v_where_clause := v_where_clause || ' AND ';
            END IF;
            v_where_clause := v_where_clause || format('%I = %L::uuid', v_key, v_value);
        END LOOP;
        
        -- Check if the record's download_profiles contains the current user
        v_sql := format('
            SELECT CASE 
                WHEN download_profiles IS NULL THEN false
                WHEN %L = ANY(download_profiles) THEN true
                ELSE false
            END
            FROM %I 
            WHERE %s
            LIMIT 1
        ', v_profile_id, p_table_name, v_where_clause);
        
        EXECUTE v_sql INTO v_is_downloaded;
        
        -- Build result object
        v_result_obj := v_key_obj || jsonb_build_object('is_downloaded', COALESCE(v_is_downloaded, false));
        v_results := array_append(v_results, v_result_obj);
    END LOOP;
    
    RETURN v_results;
END;
$$;

-- Grant permissions for RPC functions
-- GRANT EXECUTE ON FUNCTION download_records TO authenticated;
-- GRANT EXECUTE ON FUNCTION download_record TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_download_status TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_download_status_composite TO authenticated;
-- GRANT EXECUTE ON FUNCTION check_download_status TO authenticated;
-- GRANT EXECUTE ON FUNCTION download_composite_records TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_bulk_download_status_composite TO authenticated;

-- ====================================
-- USAGE EXAMPLES
-- ====================================

-- Example 1: Download a quest and all its related records (including composite key tables)
-- This will download the quest and ALL its quest_tag_link, quest_asset_link records
-- SELECT download_record('quest', 'quest-uuid-here');

-- Example 2: Download specific composite key records using all keyFields
-- This allows precise control over which junction records are downloaded
-- SELECT download_composite_records(
--     'quest_tag_link',
--     ARRAY[
--         '{"quest_id": "quest-uuid-1", "tag_id": "tag-uuid-1"}'::jsonb,
--         '{"quest_id": "quest-uuid-1", "tag_id": "tag-uuid-2"}'::jsonb
--     ]
-- );

-- Example 3: Check download status for a composite key record
-- SELECT check_download_status(
--     'quest_tag_link',
--     '{"quest_id": "quest-uuid-1", "tag_id": "tag-uuid-1"}'::jsonb
-- );

-- Example 4: Bulk check download status for multiple composite key records
-- SELECT get_bulk_download_status_composite(
--     'quest_asset_link',
--     ARRAY[
--         '{"quest_id": "quest-uuid-1", "asset_id": "asset-uuid-1"}'::jsonb,
--         '{"quest_id": "quest-uuid-1", "asset_id": "asset-uuid-2"}'::jsonb,
--         '{"quest_id": "quest-uuid-2", "asset_id": "asset-uuid-3"}'::jsonb
--     ]
-- );

-- ====================================
-- PART 6: Views and Permissions
-- ====================================

-- Create a view to easily see the download tree structure
CREATE OR REPLACE VIEW download_tree_structure AS
SELECT get_download_tree_structure() AS tree;

-- Grant all necessary permissions
-- GRANT EXECUTE ON FUNCTION get_download_tree_structure TO authenticated;
-- GRANT EXECUTE ON FUNCTION find_node_in_tree TO authenticated;
-- GRANT EXECUTE ON FUNCTION process_download_tree TO authenticated;
-- GRANT EXECUTE ON FUNCTION process_composite_key_table TO authenticated;
-- GRANT EXECUTE ON FUNCTION is_downloaded TO authenticated;
-- GRANT EXECUTE ON FUNCTION propagate_download_profiles_on_insert TO authenticated;
-- GRANT EXECUTE ON FUNCTION find_parent_table_for_field TO authenticated;
-- GRANT EXECUTE ON FUNCTION has_child_table TO authenticated;
-- GRANT EXECUTE ON FUNCTION search_parent_table_recursive TO authenticated;
-- GRANT EXECUTE ON FUNCTION create_download_propagation_triggers TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_all_tables_from_tree TO authenticated;
-- GRANT EXECUTE ON FUNCTION handle_download_profiles_update TO authenticated;
-- GRANT EXECUTE ON FUNCTION handle_parent_change_update TO authenticated;
-- GRANT EXECUTE ON FUNCTION create_download_update_triggers TO authenticated;
-- GRANT EXECUTE ON FUNCTION backfill_download_profiles TO authenticated;
-- GRANT EXECUTE ON FUNCTION refresh_download_profiles TO authenticated;
-- GRANT SELECT ON download_tree_structure TO authenticated; 