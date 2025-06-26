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
                                        "table": "language",
                                        "childField": "source_language_id",
                                        "parentField": "id"
                                    },
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

-- ====================================
-- DRY Helper Functions
-- ====================================

-- Get the ID field name for a table from its node
CREATE OR REPLACE FUNCTION get_id_field_from_node(p_node jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_key_fields jsonb;
BEGIN
    -- First check if idField is explicitly set
    IF p_node->>'idField' IS NOT NULL THEN
        RETURN p_node->>'idField';
    END IF;
    
    -- For composite key tables, use the first key field
    v_key_fields := p_node->'keyFields';
    IF v_key_fields IS NOT NULL AND jsonb_typeof(v_key_fields) = 'array' THEN
        RETURN v_key_fields->>0;
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
    v_record record;
    v_sql text;
    v_final_where_clause text;
    v_is_still_needed boolean;
    v_node jsonb;
    v_tree jsonb;
    v_tag_still_needed boolean;
    v_link_still_needed boolean;
BEGIN
    -- Build the complete WHERE clause with values substituted
    IF p_where_values IS NOT NULL AND array_length(p_where_values, 1) > 0 THEN
        v_final_where_clause := format(p_where_clause, variadic p_where_values);
    ELSE
        v_final_where_clause := p_where_clause;
    END IF;
    
    -- Get the tree structure and find the node for this table
    v_tree := get_download_tree_structure();
    v_node := find_node_in_tree(v_tree, p_table_name);
    
    -- Special handling for composite key link tables
    IF v_node IS NOT NULL AND v_node->'keyFields' IS NOT NULL THEN
        -- This is a composite key table (like quest_tag_link or asset_tag_link)
        
        -- For quest_tag_link
        IF p_table_name = 'quest_tag_link' THEN
            -- Process each quest_tag_link record individually
            v_sql := format('
                SELECT quest_id, tag_id 
                FROM %I 
                WHERE %s
            ', p_table_name, v_final_where_clause);
            
            FOR v_record IN EXECUTE v_sql
            LOOP
                -- Check if this specific link is still needed
                -- (i.e., the tag is used by another downloaded quest)
                v_link_still_needed := false;
                
                -- Check if there are other downloaded quests using this tag
                SELECT EXISTS(
                    SELECT 1
                    FROM quest_tag_link qtl
                    JOIN quest q ON q.id = qtl.quest_id
                    WHERE qtl.tag_id = v_record.tag_id
                      AND qtl.quest_id != v_record.quest_id  -- Different quest
                      AND q.download_profiles @> ARRAY[p_profile_id]
                ) INTO v_link_still_needed;
                
                IF NOT v_link_still_needed THEN
                    -- This tag is not used by any other downloaded quest
                    -- Check if it's used by any downloaded asset
                    SELECT EXISTS(
                        SELECT 1
                        FROM asset_tag_link atl
                        JOIN asset a ON a.id = atl.asset_id
                        WHERE atl.tag_id = v_record.tag_id
                          AND a.download_profiles @> ARRAY[p_profile_id]
                    ) INTO v_tag_still_needed;
                    
                    IF NOT v_tag_still_needed THEN
                        -- Remove profile from the tag itself
                        UPDATE tag 
                        SET download_profiles = normalize_download_profiles(
                            array_remove(download_profiles, p_profile_id)
                        )
                        WHERE id = v_record.tag_id;
                    END IF;
                END IF;
                
                -- Always remove from the link record
                UPDATE quest_tag_link
                SET download_profiles = normalize_download_profiles(
                    array_remove(download_profiles, p_profile_id)
                )
                WHERE quest_id = v_record.quest_id AND tag_id = v_record.tag_id;
            END LOOP;
            
        -- For asset_tag_link
        ELSIF p_table_name = 'asset_tag_link' THEN
            -- Process each asset_tag_link record individually
            v_sql := format('
                SELECT asset_id, tag_id 
                FROM %I 
                WHERE %s
            ', p_table_name, v_final_where_clause);
            
            FOR v_record IN EXECUTE v_sql
            LOOP
                -- Check if this specific link is still needed
                v_link_still_needed := false;
                
                -- Check if there are other downloaded assets using this tag
                SELECT EXISTS(
                    SELECT 1
                    FROM asset_tag_link atl
                    JOIN asset a ON a.id = atl.asset_id
                    WHERE atl.tag_id = v_record.tag_id
                      AND atl.asset_id != v_record.asset_id  -- Different asset
                      AND a.download_profiles @> ARRAY[p_profile_id]
                ) INTO v_link_still_needed;
                
                IF NOT v_link_still_needed THEN
                    -- This tag is not used by any other downloaded asset
                    -- Check if it's used by any downloaded quest
                    SELECT EXISTS(
                        SELECT 1
                        FROM quest_tag_link qtl
                        JOIN quest q ON q.id = qtl.quest_id
                        WHERE qtl.tag_id = v_record.tag_id
                          AND q.download_profiles @> ARRAY[p_profile_id]
                    ) INTO v_tag_still_needed;
                    
                    IF NOT v_tag_still_needed THEN
                        -- Remove profile from the tag itself
                        UPDATE tag 
                        SET download_profiles = normalize_download_profiles(
                            array_remove(download_profiles, p_profile_id)
                        )
                        WHERE id = v_record.tag_id;
                    END IF;
                END IF;
                
                -- Always remove from the link record
                UPDATE asset_tag_link
                SET download_profiles = normalize_download_profiles(
                    array_remove(download_profiles, p_profile_id)
                )
                WHERE asset_id = v_record.asset_id AND tag_id = v_record.tag_id;
            END LOOP;
            
        -- For quest_asset_link
        ELSIF p_table_name = 'quest_asset_link' THEN
            -- Process each quest_asset_link record individually
            v_sql := format('
                SELECT quest_id, asset_id 
                FROM %I 
                WHERE %s
            ', p_table_name, v_final_where_clause);
            
            FOR v_record IN EXECUTE v_sql
            LOOP
                -- Check if this asset is still needed by other downloaded quests
                v_is_still_needed := false;
                
                SELECT EXISTS(
                    SELECT 1
                    FROM quest_asset_link qal
                    JOIN quest q ON q.id = qal.quest_id
                    WHERE qal.asset_id = v_record.asset_id
                      AND qal.quest_id != v_record.quest_id  -- Different quest
                      AND q.download_profiles @> ARRAY[p_profile_id]
                ) INTO v_is_still_needed;
                
                IF NOT v_is_still_needed THEN
                    -- This asset is not used by any other downloaded quest
                    -- Recursively remove the asset and its children
                    -- The process_download_tree will handle shared resources correctly now
                    PERFORM process_download_tree('asset', ARRAY[v_record.asset_id], p_profile_id, 'remove');
                END IF;
                
                -- Always remove from the link record
                UPDATE quest_asset_link
                SET download_profiles = normalize_download_profiles(
                    array_remove(download_profiles, p_profile_id)
                )
                WHERE quest_id = v_record.quest_id AND asset_id = v_record.asset_id;
            END LOOP;
        ELSE
            -- Generic composite key table handling
            v_sql := format('
                UPDATE %I 
                SET download_profiles = normalize_download_profiles(
                    array_remove(download_profiles, %L::uuid)
                )
                WHERE %s
            ', p_table_name, p_profile_id, v_final_where_clause);
            
            EXECUTE v_sql;
        END IF;
        
    ELSE
        -- Regular table handling (non-composite key)
        v_sql := format('
            UPDATE %I 
            SET download_profiles = normalize_download_profiles(
                array_remove(download_profiles, %L::uuid)
            )
            WHERE %s
        ', p_table_name, p_profile_id, v_final_where_clause);
        
        EXECUTE v_sql;
    END IF;
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
    v_count integer := 0;
    v_sql text;
BEGIN
    -- Special handling for commonly shared resources
    CASE p_table_name
        WHEN 'tag' THEN
            -- Check if this tag is still referenced by any downloaded quests (via quest_tag_link)
            -- or any downloaded assets (via asset_tag_link)
            v_sql := '
                SELECT COUNT(*)
                FROM (
                    -- Check quest references
                    SELECT 1
                    FROM quest_tag_link qtl
                    JOIN quest q ON q.id = qtl.quest_id
                    WHERE qtl.tag_id = $1
                      AND q.download_profiles @> ARRAY[$2]
                    
                    UNION
                    
                    -- Check asset references
                    SELECT 1
                    FROM asset_tag_link atl
                    JOIN asset a ON a.id = atl.asset_id
                    WHERE atl.tag_id = $1
                      AND a.download_profiles @> ARRAY[$2]
                ) AS refs
            ';
            EXECUTE v_sql USING p_record_id, p_profile_id INTO v_count;
            RETURN v_count > 0;
            
        WHEN 'language' THEN
            -- Check if this language is still referenced by any downloaded projects or assets
            v_sql := '
                SELECT COUNT(*)
                FROM (
                    -- Check project source language references
                    SELECT 1
                    FROM project p
                    WHERE p.source_language_id = $1
                      AND p.download_profiles @> ARRAY[$2]
                    
                    UNION
                    
                    -- Check project target language references
                    SELECT 1
                    FROM project p
                    WHERE p.target_language_id = $1
                      AND p.download_profiles @> ARRAY[$2]
                    
                    UNION
                    
                    -- Check asset source language references
                    SELECT 1
                    FROM asset a
                    WHERE a.source_language_id = $1
                      AND a.download_profiles @> ARRAY[$2]
                ) AS refs
            ';
            EXECUTE v_sql USING p_record_id, p_profile_id INTO v_count;
            RETURN v_count > 0;
            
        WHEN 'asset' THEN
            -- Check if this asset is still referenced by any downloaded quests (via quest_asset_link)
            v_sql := '
                SELECT COUNT(*)
                FROM quest_asset_link qal
                JOIN quest q ON q.id = qal.quest_id
                WHERE qal.asset_id = $1
                  AND q.download_profiles @> ARRAY[$2]
            ';
            EXECUTE v_sql USING p_record_id, p_profile_id INTO v_count;
            RETURN v_count > 0;
            
        ELSE
            -- For other tables, don't protect (allow removal)
            RETURN false;
    END CASE;
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

-- Helper function to find all paths from downloaded parent tables to the target table
-- Currently returns empty set to avoid errors
CREATE OR REPLACE FUNCTION find_all_paths_to_table(
    p_tree jsonb,
    p_target_table text
)
RETURNS SETOF jsonb
LANGUAGE plpgsql
AS $$
BEGIN
    -- For now, return empty set since this function is not properly implemented
    -- This will effectively skip the direct reference counting
    RETURN;
END;
$$;

-- Helper function to build SQL for counting references
-- Currently returns NULL to skip checks
CREATE OR REPLACE FUNCTION build_reference_count_sql(
    p_link_path jsonb,
    p_target_record_id uuid,
    p_profile_id uuid
)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
    -- Return NULL to skip this check
    RETURN NULL;
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

-- Count references from composite key link tables
CREATE OR REPLACE FUNCTION count_composite_key_references_to_record(
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
    v_link_table text;
    v_target_field text;
    v_parent_field text;
    v_parent_table text;
    v_sql text;
BEGIN
    -- Find all composite key link tables that reference the target table
    FOR v_link_table, v_target_field, v_parent_field, v_parent_table IN
        SELECT 
            link_info.link_table,
            link_info.target_field,
            link_info.parent_field,
            link_info.parent_table
        FROM find_composite_key_links_to_table(p_tree, p_target_table) as link_info
    LOOP
        -- Count downloaded parent records that are linked to this target record
        v_sql := format('
            SELECT COUNT(DISTINCT p.id)
            FROM %I p
            JOIN %I l ON l.%I = p.id
            WHERE l.%I = %L
              AND p.download_profiles @> ARRAY[%L]
        ', v_parent_table, v_link_table, v_parent_field, v_target_field, p_target_record_id, p_profile_id);
        
        EXECUTE v_sql INTO v_count;
        v_total_count := v_total_count + v_count;
    END LOOP;
    
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

-- Helper function to find composite key link tables that reference a target table
CREATE OR REPLACE FUNCTION find_composite_key_links_to_table(
    p_tree jsonb,
    p_target_table text
)
RETURNS TABLE(
    link_table text,
    target_field text,
    parent_field text,
    parent_table text
)
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
    SELECT DISTINCT
        t.node->>'table' as link_table,
        CASE 
            -- If the link table references our target table directly
            WHEN EXISTS (
                SELECT 1 FROM jsonb_array_elements(t.node->'children') as child_elem
                WHERE child_elem->>'table' = p_target_table
            ) THEN 
                -- Find the field name that references the target table
                CASE p_target_table
                    WHEN 'tag' THEN 'tag_id'
                    WHEN 'asset' THEN 'asset_id'
                    WHEN 'quest' THEN 'quest_id'
                    ELSE 'id'
                END
            ELSE NULL
        END as target_field,
        t.node->>'parentField' as parent_field,
        t.parent->>'table' as parent_table
    FROM tree_traversal t
    WHERE t.node->'keyFields' IS NOT NULL  -- This is a composite key table
      AND t.parent IS NOT NULL
      AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(t.node->'children') as child_elem
          WHERE child_elem->>'table' = p_target_table
      );
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
    v_parent_id_field text;
    v_parent_profiles uuid[];
BEGIN
    v_parent_id_field := get_id_field_for_table(p_parent_table);
    
    EXECUTE format('
        SELECT download_profiles 
        FROM %I 
        WHERE %I = %L
    ', p_parent_table, v_parent_id_field, p_parent_id) INTO v_parent_profiles;
    
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
    v_id_field text;
    v_child_ids uuid[];
    v_sql text;
BEGIN
    v_child_table := p_child_node->>'table';
    v_id_field := get_id_field_from_node(p_child_node);
    
    -- Check if this is a reverse relationship (parent has FK to child)
    IF p_child_node->'childField' IS NOT NULL THEN
        -- Parent has FK pointing to child
        v_sql := format('
            SELECT array_agg(DISTINCT %I) 
            FROM %I 
            WHERE id = ANY(%L::uuid[])
              AND %I IS NOT NULL
        ', p_child_node->>'childField', p_parent_table, p_parent_ids, p_child_node->>'childField');
    ELSE
        -- Normal relationship (child has FK to parent)
        v_sql := format('
            SELECT array_agg(DISTINCT %I) 
            FROM %I 
            WHERE %I = ANY(%L::uuid[])
        ', v_id_field, v_child_table, p_child_node->>'parentField', p_parent_ids);
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
    
    -- Get the correct ID field for this table
    v_id_field := get_id_field_from_node(v_node);
    
    -- Update download_profiles for the current table using helper
    PERFORM update_download_profiles(
        p_table_name, 
        p_profile_id, 
        p_operation,
        format('%I = ANY(%%L::uuid[])', v_id_field),
        ARRAY[p_record_ids::text]
    );
    
    -- Process children if any
    v_children := v_node->'children';
    IF is_non_empty_array(v_children) THEN
        FOR v_child IN SELECT * FROM jsonb_array_elements(v_children)
        LOOP
            -- Check if this is a composite key table
            IF v_child->'keyFields' IS NOT NULL THEN
                -- Handle composite key tables
                PERFORM process_composite_key_table(
                    v_child,
                    p_record_ids,
                    p_profile_id,
                    p_operation,
                    v_child->>'parentField'
                );
            ELSE
                -- Handle regular tables
                v_child_ids := get_child_ids_for_node(v_child, p_table_name, p_record_ids);
                
                -- Recursively process children
                IF v_child_ids IS NOT NULL AND array_length(v_child_ids, 1) > 0 THEN
                    -- Special handling for certain child tables during removal
                    IF p_operation = 'remove' AND v_child->>'table' IN ('language', 'tag') THEN
                        -- Don't recursively process shared resources during removal
                        -- They will be handled by safe_remove_download_profiles
                        CONTINUE;
                    END IF;
                    
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
    v_id_field text;
    v_child_ids uuid[];
    v_children jsonb;
    v_child jsonb;
    v_child_table text;
BEGIN
    v_table_name := p_node->>'table';
    v_id_field := get_id_field_from_node(p_node);
    
    -- Update download_profiles for the composite key table using helper
    -- This will handle the safe removal for shared resources
    PERFORM update_download_profiles(
        v_table_name,
        p_profile_id,
        p_operation,
        format('%I = ANY(%%L::uuid[])', p_parent_field),
        ARRAY[p_parent_ids::text]
    );
    
    -- For remove operations, we should NOT recursively process shared resources
    -- The safe_remove_download_profiles function already handles this
    IF p_operation = 'remove' THEN
        -- Don't process children for composite key tables during removal
        -- This prevents tags and other shared resources from being incorrectly removed
        RETURN;
    END IF;
    
    -- For add operations, we still need to process children
    -- Get the IDs for child processing
    EXECUTE format('
        SELECT array_agg(DISTINCT %I) 
        FROM %I 
        WHERE %I = ANY(%L::uuid[])
    ', v_id_field, v_table_name, p_parent_field, p_parent_ids) INTO v_child_ids;
    
    -- Process children if any (only for add operations)
    v_children := p_node->'children';
    IF is_non_empty_array(v_children) AND 
       v_child_ids IS NOT NULL AND array_length(v_child_ids, 1) > 0 THEN
        FOR v_child IN SELECT * FROM jsonb_array_elements(v_children)
        LOOP
            v_child_table := v_child->>'table';
            
            -- For add operations, process all children normally
            PERFORM process_download_tree(
                v_child_table, 
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
    v_id_field text;
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
    
    v_id_field := get_id_field_from_node(p_node);
    
    -- Get the records for current table
    v_sql := format('
        SELECT jsonb_agg(%I) 
        FROM %I 
        WHERE %I = ANY(%L::uuid[])
    ', v_id_field, p_table_name, v_id_field, p_record_ids);
    
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
            -- Check if this is a composite key table
            IF v_child->'keyFields' IS NOT NULL THEN
                -- Handle composite key tables
                v_child_records := get_composite_key_child_records(
                    v_child,
                    p_table_name,
                    p_record_ids
                );
            ELSE
                -- Handle regular tables
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

-- Helper function to get composite key child records
CREATE OR REPLACE FUNCTION get_composite_key_child_records(
    p_node jsonb,
    p_parent_table text,
    p_parent_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_table_name text;
    v_id_field text;
    v_parent_field text;
    v_key_fields text[];
    v_child_ids uuid[];
    v_records jsonb;
    v_children jsonb;
    v_child jsonb;
    v_child_records jsonb;
    v_result jsonb;
    v_sql text;
BEGIN
    v_table_name := p_node->>'table';
    v_id_field := get_id_field_from_node(p_node);
    v_parent_field := p_node->>'parentField';
    
    -- Get the composite key records
    v_sql := format('
        SELECT jsonb_agg(
            jsonb_build_object(
                %s
            )
        )
        FROM %I 
        WHERE %I = ANY(%L::uuid[])
    ', 
        -- Build the key fields dynamically
        (SELECT string_agg(format('%L, %I', elem::text, elem::text), ', ')
         FROM jsonb_array_elements_text(p_node->'keyFields') elem),
        v_table_name,
        v_parent_field,
        p_parent_ids
    );
    
    EXECUTE v_sql INTO v_records;
    
    -- Get the IDs for child processing
    EXECUTE format('
        SELECT array_agg(DISTINCT %I) 
        FROM %I 
        WHERE %I = ANY(%L::uuid[])
    ', v_id_field, v_table_name, v_parent_field, p_parent_ids) INTO v_child_ids;
    
    -- Initialize result
    v_result := jsonb_build_object(
        'ids', COALESCE(v_records, '[]'::jsonb),
        'children', '{}'::jsonb
    );
    
    -- Process children if any
    v_children := p_node->'children';
    IF is_non_empty_array(v_children) AND 
       v_child_ids IS NOT NULL AND array_length(v_child_ids, 1) > 0 THEN
        FOR v_child IN SELECT * FROM jsonb_array_elements(v_children)
        LOOP
            v_child_records := get_records_for_node(
                v_child,
                v_child->>'table',
                v_child_ids
            );
            
            -- Add child records to result
            v_result := jsonb_set(
                v_result,
                ARRAY['children', v_child->>'table'],
                v_child_records
            );
        END LOOP;
    END IF;
    
    RETURN v_result;
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
-- GRANT EXECUTE ON FUNCTION count_records_with_profile TO authenticated;
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
-- GRANT EXECUTE ON FUNCTION get_all_related_records TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_records_for_node TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_composite_key_child_records TO authenticated;
-- GRANT SELECT ON download_tree_structure TO authenticated; 