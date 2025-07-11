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
--
-- Tree node parameters:
-- - table: The table name
-- - parentField: The field in the child table that references the parent (normal FK)
-- - childField: The field in the parent table that references the child (reverse FK)
-- - idField: The primary key field name (defaults to 'id')
-- - keyFields: Array of fields for composite primary keys
-- - children: Array of child nodes
--
-- Use childField when the parent table has a foreign key to the child table
-- (e.g., project.source_language_id -> language.id)

-- Drop old download tables (replaced by download_profiles columns)
DROP TABLE IF EXISTS project_download CASCADE;
DROP TABLE IF EXISTS quest_download CASCADE;
DROP TABLE IF EXISTS asset_download CASCADE;

-- Add download_profiles columns to all relevant tables
ALTER TABLE language ADD COLUMN IF NOT EXISTS download_profiles uuid[] DEFAULT NULL;
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
CREATE INDEX IF NOT EXISTS idx_language_download_profiles ON language USING GIN (download_profiles);
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
                "table": "language",
                "childField": "source_language_id",
                "parentField": "id"
            },
            {
                "table": "language",
                "childField": "target_language_id",
                "parentField": "id"
            },
            {
                "table": "quest",
                "parentField": "project_id",
                "children": [
                    {
                        "table": "quest_tag_link",
                        "idField": "tag_id",
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
                        "parentField": "quest_id",
                        "children": [
                            {
                                "table": "asset",
                                "parentField": "id",
                                "children": [
                                    {
                                        "table": "language",
                                        "childField": "source_language_id",
                                        "parentField": "id"
                                    },
                                    {
                                        "table": "asset_tag_link",
                                        "idField": "tag_id",
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

-- ====================================
-- DRY Helper Functions
-- ====================================

-- Get the ID field name for a table from its node
CREATE OR REPLACE FUNCTION get_id_field_from_node(p_node jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    -- Check if idField is explicitly set
    IF p_node->>'idField' IS NOT NULL THEN
        RETURN p_node->>'idField';
    END IF;
    
    -- Default to 'id'
    RETURN 'id';
END;
$$;

-- Get the ID field name for a table by table name
CREATE OR REPLACE FUNCTION get_id_field_for_table(p_table_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_node jsonb;
BEGIN
    v_node := find_node_in_tree(get_download_tree_structure(), p_table_name);
    IF v_node IS NULL THEN
        RETURN 'id';
    END IF;
    RETURN get_id_field_from_node(v_node);
END;
$$;

-- Execute update for download_profiles on a table
CREATE OR REPLACE FUNCTION update_download_profiles(
    p_table_name text,
    p_profile_id uuid,
    p_operation text,
    p_where_clause text,
    p_where_values text[]
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_sql text;
    v_final_where_clause text;
BEGIN
    IF p_operation = 'add' THEN
        -- Build the complete WHERE clause with values substituted
        IF p_where_values IS NOT NULL AND array_length(p_where_values, 1) > 0 THEN
            v_final_where_clause := format(p_where_clause, variadic p_where_values);
        ELSE
            v_final_where_clause := p_where_clause;
        END IF;
        
        v_sql := format('
            UPDATE %I 
            SET download_profiles = normalize_download_profiles(
                array_append(
                    array_remove(download_profiles, %L::uuid), 
                    %L::uuid
                )
            )
            WHERE %s
        ', p_table_name, p_profile_id, p_profile_id, v_final_where_clause);
        
        EXECUTE v_sql;
    ELSE
        -- For remove operations, use safe removal to avoid removing profiles still needed by other records
        PERFORM safe_remove_download_profiles(
            p_table_name, 
            p_profile_id, 
            p_where_clause, 
            p_where_values
        );
    END IF;
END;
$$;

-- Safely remove download profiles from shared resources
-- Only removes a profile if it's not still needed by other downloaded records
CREATE OR REPLACE FUNCTION safe_remove_download_profiles(
    p_table_name text,
    p_profile_id uuid,
    p_where_clause text,
    p_where_values text[]
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_record_id uuid;
    v_record_ids uuid[];
    v_sql text;
    v_final_where_clause text;
    v_is_still_needed boolean;
BEGIN
    -- Build the complete WHERE clause with values substituted
    IF p_where_values IS NOT NULL AND array_length(p_where_values, 1) > 0 THEN
        v_final_where_clause := format(p_where_clause, variadic p_where_values);
    ELSE
        v_final_where_clause := p_where_clause;
    END IF;
    
    -- Get all record IDs that match the where clause
    v_sql := format('SELECT array_agg(%I) FROM %I WHERE %s', 
        get_id_field_for_table(p_table_name), p_table_name, v_final_where_clause);
    
    EXECUTE v_sql INTO v_record_ids;
    
    -- If no records found, nothing to do
    IF v_record_ids IS NULL OR array_length(v_record_ids, 1) IS NULL THEN
        RETURN;
    END IF;
    
    -- Check each record individually
    FOREACH v_record_id IN ARRAY v_record_ids
    LOOP
        -- Check if this profile is still needed by other downloaded records
        v_is_still_needed := is_profile_still_needed_for_shared_resource(
            p_table_name, 
            v_record_id, 
            p_profile_id
        );
        
        -- Only remove the profile if it's not still needed
        IF NOT v_is_still_needed THEN
            EXECUTE format('
                UPDATE %I 
                SET download_profiles = normalize_download_profiles(
                    array_remove(download_profiles, %L::uuid)
                )
                WHERE %I = %L
            ', p_table_name, p_profile_id, get_id_field_for_table(p_table_name), v_record_id);
        END IF;
    END LOOP;
END;
$$;

-- Check if a profile is still needed by other downloaded records for a shared resource
-- This function generically traverses the download tree to find all references to a record
CREATE OR REPLACE FUNCTION is_profile_still_needed_for_shared_resource(
    p_table_name text,
    p_record_id uuid,
    p_profile_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
    v_tree jsonb;
    v_reference_count integer := 0;
BEGIN
    -- Get the tree structure
    v_tree := get_download_tree_structure();
    
    -- Find all references to this record in the download tree
    v_reference_count := count_references_to_record_in_tree(
        v_tree, 
        p_table_name, 
        p_record_id, 
        p_profile_id
    );
    
    -- Record is still needed if there are any references from downloaded records
    RETURN v_reference_count > 0;
END;
$$;

-- Generic function to count references to a record in the download tree
CREATE OR REPLACE FUNCTION count_references_to_record_in_tree(
    p_tree jsonb,
    p_target_table text,
    p_target_record_id uuid,
    p_profile_id uuid
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    v_total_count integer := 0;
    v_count integer := 0;
BEGIN
    -- Count direct references (where this record is a child of downloaded parents)
    v_count := count_direct_references_to_record(
        p_tree, 
        p_target_table, 
        p_target_record_id, 
        p_profile_id
    );
    v_total_count := v_total_count + v_count;
    
    -- Count reverse references (where this record is a parent of downloaded children)
    v_count := count_reverse_references_to_record(
        p_tree, 
        p_target_table, 
        p_target_record_id, 
        p_profile_id
    );
    v_total_count := v_total_count + v_count;
    
    RETURN v_total_count;
END;
$$;

-- Count direct references: where target record is referenced by downloaded parent records
CREATE OR REPLACE FUNCTION count_direct_references_to_record(
    p_tree jsonb,
    p_target_table text,
    p_target_record_id uuid,
    p_profile_id uuid
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    v_total_count integer := 0;
    v_count integer := 0;
    v_sql text;
    v_link_path jsonb;
BEGIN
    -- Find all paths from downloaded parent tables to the target table
    FOR v_link_path IN
        SELECT * FROM find_all_paths_to_table(p_tree, p_target_table)
    LOOP
        -- Build SQL based on the path
        v_sql := build_reference_count_sql(v_link_path, p_target_record_id, p_profile_id);
        
        IF v_sql IS NOT NULL THEN
            EXECUTE v_sql INTO v_count;
            v_total_count := v_total_count + v_count;
        END IF;
    END LOOP;
    
    RETURN v_total_count;
END;
$$;

-- Count reverse references: where target record is a parent of downloaded child records
CREATE OR REPLACE FUNCTION count_reverse_references_to_record(
    p_tree jsonb,
    p_target_table text,
    p_target_record_id uuid,
    p_profile_id uuid
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    v_total_count integer := 0;
    v_count integer := 0;
    v_child_table text;
    v_parent_field text;
    v_child_field text;
    v_sql text;
BEGIN
    -- Find all child relationships for the target table
    SELECT 
        array_agg(child_info.child_table),
        array_agg(child_info.parent_field),
        array_agg(child_info.child_field)
    INTO v_child_table, v_parent_field, v_child_field
    FROM (
        SELECT DISTINCT
            child_node->>'table' as child_table,
            child_node->>'parentField' as parent_field,
            child_node->>'childField' as child_field
        FROM find_all_child_relationships(p_tree, p_target_table) as child_relationships(parent_node, child_node)
    ) as child_info;
    
    -- For each child relationship, count downloaded children that reference this record
    IF v_child_table IS NOT NULL THEN
        FOR i IN 1..array_length(v_child_table, 1)
        LOOP
            IF v_parent_field[i] IS NOT NULL THEN
                -- Normal relationship: child has FK to parent
                v_sql := format('
                    SELECT COUNT(*)
                    FROM %I c
                    WHERE c.%I = %L
                      AND c.download_profiles @> ARRAY[%L]
                ', v_child_table[i], v_parent_field[i], p_target_record_id, p_profile_id);
            ELSIF v_child_field[i] IS NOT NULL THEN
                -- Reverse relationship: parent has FK to child
                v_sql := format('
                    SELECT COUNT(*)
                    FROM %I c
                    JOIN %I p ON p.%I = c.id
                    WHERE p.id = %L
                      AND c.download_profiles @> ARRAY[%L]
                ', v_child_table[i], p_target_table, v_child_field[i], p_target_record_id, p_profile_id);
            END IF;
            
            IF v_sql IS NOT NULL THEN
                EXECUTE v_sql INTO v_count;
                v_total_count := v_total_count + v_count;
                v_sql := NULL;
            END IF;
        END LOOP;
    END IF;
    
    RETURN v_total_count;
END;
$$;



-- Helper function to find all parent relationships for a table in the tree
CREATE OR REPLACE FUNCTION find_all_parent_relationships(
    p_tree jsonb,
    p_target_table text
)
RETURNS TABLE(parent_node jsonb, child_node jsonb)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE tree_traversal AS (
        -- Base case: start with root
        SELECT p_tree as node, NULL::jsonb as parent
        
        UNION ALL
        
        -- Recursive case: traverse children
        SELECT 
            child.value as node,
            t.node as parent
        FROM tree_traversal t,
             jsonb_array_elements(t.node->'children') as child
        WHERE t.node->'children' IS NOT NULL
    )
    SELECT 
        t.parent as parent_node,
        t.node as child_node
    FROM tree_traversal t
    WHERE t.node->>'table' = p_target_table
      AND t.parent IS NOT NULL;
END;
$$;

-- Helper function to find all child relationships for a table in the tree
CREATE OR REPLACE FUNCTION find_all_child_relationships(
    p_tree jsonb,
    p_target_table text
)
RETURNS TABLE(parent_node jsonb, child_node jsonb)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE tree_traversal AS (
        -- Base case: start with root
        SELECT p_tree as node, NULL::jsonb as parent
        
        UNION ALL
        
        -- Recursive case: traverse children
        SELECT 
            child.value as node,
            t.node as parent
        FROM tree_traversal t,
             jsonb_array_elements(t.node->'children') as child
        WHERE t.node->'children' IS NOT NULL
    )
    SELECT 
        t.node as parent_node,
        child.value as child_node
    FROM tree_traversal t,
         jsonb_array_elements(t.node->'children') as child
    WHERE t.node->>'table' = p_target_table
      AND t.node->'children' IS NOT NULL;
END;
$$;



-- Get download_profiles from a parent record
CREATE OR REPLACE FUNCTION get_parent_download_profiles(
    p_parent_table text,
    p_parent_id uuid
)
RETURNS uuid[]
LANGUAGE plpgsql
AS $$
DECLARE
    v_parent_profiles uuid[];
BEGIN
    EXECUTE format('
        SELECT download_profiles 
        FROM %I 
        WHERE %I = %L
    ', p_parent_table, get_id_field_for_table(p_parent_table), p_parent_id) INTO v_parent_profiles;
    
    RETURN v_parent_profiles;
END;
$$;

-- Check if a jsonb value is a non-empty array
CREATE OR REPLACE FUNCTION is_non_empty_array(p_value jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    RETURN p_value IS NOT NULL AND jsonb_typeof(p_value) = 'array' AND jsonb_array_length(p_value) > 0;
END;
$$;

-- Get child IDs for a node based on parent-child relationship
CREATE OR REPLACE FUNCTION get_child_ids_for_node(
    p_child_node jsonb,
    p_parent_table text,
    p_parent_ids uuid[]
)
RETURNS uuid[]
LANGUAGE plpgsql
AS $$
DECLARE
    v_child_table text;
    v_child_id_field text;
    v_child_ids uuid[];
    v_sql text;
BEGIN
    v_child_table := p_child_node->>'table';
    v_child_id_field := get_id_field_from_node(p_child_node);
    
    -- Check if this is a reverse relationship (parent has FK to child)
    IF p_child_node->'childField' IS NOT NULL THEN
        -- Parent has FK pointing to child
        v_sql := format('
            SELECT array_agg(DISTINCT %I) 
            FROM %I 
            WHERE %I = ANY(%L::uuid[])
              AND %I IS NOT NULL
        ', p_child_node->>'childField', p_parent_table, 
           get_id_field_for_table(p_parent_table), p_parent_ids, p_child_node->>'childField');
    ELSE
        -- Normal relationship (child has FK to parent)
        v_sql := format('
            SELECT array_agg(DISTINCT %I) 
            FROM %I 
            WHERE %I = ANY(%L::uuid[])
        ', v_child_id_field, v_child_table, p_child_node->>'parentField', p_parent_ids);
    END IF;
    
    EXECUTE v_sql INTO v_child_ids;
    RETURN v_child_ids;
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
    v_child_ids uuid[];
    v_children jsonb;
    v_child jsonb;
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
    
    -- Update download_profiles for the current table using helper
    PERFORM update_download_profiles(
        p_table_name, 
        p_profile_id, 
        p_operation,
        format('%I = ANY(%%L::uuid[])', get_id_field_for_table(p_table_name)),
        ARRAY[p_record_ids::text]
    );
    
    -- Process children if any
    v_children := v_node->'children';
    IF is_non_empty_array(v_children) THEN
        FOR v_child IN SELECT * FROM jsonb_array_elements(v_children)
        LOOP
            -- Handle all tables the same way
            v_child_ids := get_child_ids_for_node(v_child, p_table_name, p_record_ids);
            
            -- Recursively process children
            IF v_child_ids IS NOT NULL AND array_length(v_child_ids, 1) > 0 THEN
                PERFORM process_download_tree(
                    v_child->>'table', 
                    v_child_ids, 
                    p_profile_id, 
                    p_operation
                );
            END IF;
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
    v_parent_table text;
    v_parent_field text;
    v_parent_id uuid;
    v_parent_profiles uuid[];
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
    
    -- Check if this node has a childField (reverse relationship)
    IF v_node->'childField' IS NOT NULL THEN
        -- This is a reverse relationship - skip propagation on insert
        -- (language records don't inherit from projects/assets)
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
    
    -- Get parent's download_profiles using helper
    v_parent_profiles := get_parent_download_profiles(v_parent_table, v_parent_id);
    
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
    IF is_non_empty_array(v_children) THEN
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
    IF is_non_empty_array(v_children) THEN
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
    IF is_non_empty_array(v_children) THEN
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
    v_id_field text;
    v_result uuid;
BEGIN
    -- Get the ID field for the table
    v_id_field := get_id_field_for_table(p_table_name);
    
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
            
            IF is_non_empty_array(v_children) THEN
                -- Update all child tables
                FOR v_child IN SELECT * FROM jsonb_array_elements(v_children)
                LOOP
                    v_child_table := v_child->>'table';
                    v_parent_field := v_child->>'parentField';
                    
                    IF v_child_table IS NOT NULL AND v_parent_field IS NOT NULL THEN
                        -- Check if this is a reverse relationship
                        IF v_child->'childField' IS NOT NULL THEN
                            -- Skip reverse relationships in update trigger
                            -- (language records don't get updated when project/asset changes)
                            CONTINUE;
                        END IF;
                        
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
            -- Get new parent's download_profiles using helper
            v_parent_profiles := get_parent_download_profiles(v_parent_table, v_new_parent_id);
            
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
-- PART 4: Utility Views and Functions
-- ====================================

-- Function to get all related records for a given record
CREATE OR REPLACE FUNCTION get_all_related_records(
    p_table_name text,
    p_record_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tree jsonb;
    v_node jsonb;
    v_result jsonb;
BEGIN
    -- Get the tree structure
    v_tree := get_download_tree_structure();
    
    -- Find the node for the current table
    v_node := find_node_in_tree(v_tree, p_table_name);
    
    IF v_node IS NULL THEN
        RAISE EXCEPTION 'Table % not found in download tree', p_table_name;
    END IF;
    
    -- Start recursive collection of records
    v_result := jsonb_build_object(
        'table', p_table_name,
        'records', get_records_for_node(v_node, p_table_name, ARRAY[p_record_id])
    );
    
    RETURN v_result;
END;
$$;

-- Helper function to get records for a node and its children
CREATE OR REPLACE FUNCTION get_records_for_node(
    p_node jsonb,
    p_table_name text,
    p_record_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_records jsonb := '[]'::jsonb;
    v_children jsonb;
    v_child jsonb;
    v_child_ids uuid[];
    v_child_records jsonb;
    v_sql text;
    v_record jsonb;
BEGIN
    -- Return empty if no records to process
    IF p_record_ids IS NULL OR array_length(p_record_ids, 1) IS NULL THEN
        RETURN jsonb_build_object(
            'ids', '[]'::jsonb,
            'children', '{}'::jsonb
        );
    END IF;
    
    -- Get the records for current table
    v_sql := format('
        SELECT jsonb_agg(%I) 
        FROM %I 
        WHERE %I = ANY(%L::uuid[])
    ', get_id_field_for_table(p_table_name), p_table_name, 
      get_id_field_for_table(p_table_name), p_record_ids);
    
    EXECUTE v_sql INTO v_records;
    
    -- Initialize result with current records
    v_record := jsonb_build_object(
        'ids', COALESCE(v_records, '[]'::jsonb),
        'children', '{}'::jsonb
    );
    
    -- Process children if any
    v_children := p_node->'children';
    IF is_non_empty_array(v_children) THEN
        FOR v_child IN SELECT * FROM jsonb_array_elements(v_children)
        LOOP
            -- Handle all tables the same way
            v_child_ids := get_child_ids_for_node(v_child, p_table_name, p_record_ids);
            
            IF v_child_ids IS NOT NULL AND array_length(v_child_ids, 1) > 0 THEN
                v_child_records := get_records_for_node(
                    v_child,
                    v_child->>'table',
                    v_child_ids
                );
            ELSE
                v_child_records := jsonb_build_object(
                    'ids', '[]'::jsonb,
                    'children', '{}'::jsonb
                );
            END IF;
            
            -- Add child records to result
            v_record := jsonb_set(
                v_record,
                ARRAY['children', v_child->>'table'],
                v_child_records
            );
        END LOOP;
    END IF;
    
    RETURN v_record;
END;
$$;



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

-- View to show the download tree structure
CREATE OR REPLACE VIEW download_tree_structure AS
SELECT get_download_tree_structure() AS tree;

-- ====================================
-- PART 5: Views and Permissions
-- ====================================

-- Grant all necessary permissions
-- GRANT EXECUTE ON FUNCTION get_download_tree_structure TO authenticated;
-- GRANT EXECUTE ON FUNCTION find_node_in_tree TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_id_field_from_node TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_id_field_for_table TO authenticated;
-- GRANT EXECUTE ON FUNCTION update_download_profiles TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_parent_download_profiles TO authenticated;
-- GRANT EXECUTE ON FUNCTION is_non_empty_array TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_child_ids_for_node TO authenticated;
-- GRANT EXECUTE ON FUNCTION process_download_tree TO authenticated;
-- GRANT EXECUTE ON FUNCTION normalize_download_profiles TO authenticated;
-- GRANT EXECUTE ON FUNCTION propagate_download_profiles_on_insert TO authenticated;
-- GRANT EXECUTE ON FUNCTION find_parent_table_for_field TO authenticated;
-- GRANT EXECUTE ON FUNCTION has_child_table TO authenticated;
-- GRANT EXECUTE ON FUNCTION search_parent_table_recursive TO authenticated;
-- GRANT EXECUTE ON FUNCTION create_download_propagation_triggers TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_all_tables_from_tree TO authenticated;
-- GRANT EXECUTE ON FUNCTION handle_download_profiles_update TO authenticated;
-- GRANT EXECUTE ON FUNCTION handle_parent_change_update TO authenticated;
-- GRANT EXECUTE ON FUNCTION create_download_update_triggers TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_all_related_records TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_records_for_node TO authenticated;
-- GRANT SELECT ON download_tree_structure TO authenticated; 