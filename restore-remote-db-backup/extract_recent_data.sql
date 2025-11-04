-- Extract Recent Data Script
-- Purpose: Generate INSERT statements for all records created in the last 2 days
-- Usage: psql [connection-string] -f extract_recent_data.sql > extracted_data.sql
--
-- This script generates INSERT statements that can be re-executed after backup restoration
-- and migration re-application.

\set ON_ERROR_STOP on

-- Output format settings for clean INSERT statements
\pset format unaligned
\pset tuples_only on
\pset fieldsep ''

-- Helper function to generate INSERT statements
-- This will be used to extract data in the correct format

BEGIN;

-- Create a temporary function to generate INSERT statements for a table
-- with ON CONFLICT DO NOTHING for idempotency
CREATE OR REPLACE FUNCTION generate_insert_statements(
  p_schema TEXT,
  p_table TEXT,
  p_where_clause TEXT DEFAULT NULL
)
RETURNS SETOF TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_columns TEXT;
  v_select TEXT;
  v_sql TEXT;
  v_pk_columns TEXT;
  v_on_conflict TEXT;
BEGIN
  -- Get column list with proper quoting
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
  INTO v_columns
  FROM information_schema.columns
  WHERE table_schema = p_schema
    AND table_name = p_table;

  -- Get primary key columns for ON CONFLICT clause
  SELECT string_agg(quote_ident(kcu.column_name), ', ' ORDER BY kcu.ordinal_position)
  INTO v_pk_columns
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  WHERE tc.constraint_type = 'PRIMARY KEY'
    AND tc.table_schema = p_schema
    AND tc.table_name = p_table;

  -- Build ON CONFLICT clause if primary key exists
  IF v_pk_columns IS NOT NULL THEN
    v_on_conflict := ' ON CONFLICT (' || v_pk_columns || ') DO NOTHING';
  ELSE
    v_on_conflict := '';
  END IF;

  -- Build SELECT statement with proper value formatting
  SELECT string_agg(
    CASE 
      WHEN data_type IN ('uuid', 'text', 'character varying', 'varchar', 'char') 
        THEN 'quote_literal(' || quote_ident(column_name) || '::text)'
      WHEN data_type IN ('jsonb', 'json')
        THEN 'quote_literal(' || quote_ident(column_name) || '::text)'
      WHEN data_type IN ('timestamp with time zone', 'timestamp without time zone', 'timestamptz')
        THEN 'quote_literal(' || quote_ident(column_name) || '::text)'
      WHEN data_type IN ('boolean')
        THEN quote_ident(column_name) || '::text'
      WHEN data_type IN ('ARRAY')
        THEN 'quote_literal(' || quote_ident(column_name) || '::text)'
      WHEN data_type = 'USER-DEFINED'
        THEN 'quote_literal(' || quote_ident(column_name) || '::text)'
      ELSE quote_ident(column_name) || '::text'
    END,
    ' || '', '' || '
    ORDER BY ordinal_position
  )
  INTO v_select
  FROM information_schema.columns
  WHERE table_schema = p_schema
    AND table_name = p_table;

  -- Build and execute query with ON CONFLICT
  v_sql := format(
    'SELECT ''INSERT INTO %I.%I (%s) VALUES ('' || %s || '')%s;'' FROM %I.%I',
    p_schema, p_table, v_columns, v_select, v_on_conflict, p_schema, p_table
  );

  IF p_where_clause IS NOT NULL THEN
    v_sql := v_sql || ' ' || p_where_clause;
  END IF;

  RETURN QUERY EXECUTE v_sql;
END;
$$;

COMMIT;

-- Begin extraction output
\echo '-- Extracted Data from Last 2 Days'
\echo '-- Generated: ' :CURRENT_TIMESTAMP
\echo '-- Database Recovery Script'
\echo ''
\echo 'BEGIN;'
\echo ''

-- ====================
-- AUTH SCHEMA TABLES
-- ====================

-- Note: Some auth tables may not have created_at columns
-- We'll extract them conservatively

\echo '-- ===================='
\echo '-- Auth Schema Tables'
\echo '-- ===================='
\echo ''

-- auth.users (has created_at)
\echo '-- auth.users'
SELECT * FROM generate_insert_statements('auth', 'users', 
  'WHERE created_at >= NOW() - INTERVAL ''2 days''');

-- auth.identities (has created_at)
\echo '-- auth.identities'
SELECT * FROM generate_insert_statements('auth', 'identities',
  'WHERE created_at >= NOW() - INTERVAL ''2 days''');

-- auth.sessions (has created_at)
\echo '-- auth.sessions'
SELECT * FROM generate_insert_statements('auth', 'sessions',
  'WHERE created_at >= NOW() - INTERVAL ''2 days''');

-- auth.refresh_tokens (has created_at)
\echo '-- auth.refresh_tokens'
SELECT * FROM generate_insert_statements('auth', 'refresh_tokens',
  'WHERE created_at >= NOW() - INTERVAL ''2 days''');

-- auth.mfa_factors (has created_at)
\echo '-- auth.mfa_factors'
SELECT * FROM generate_insert_statements('auth', 'mfa_factors',
  'WHERE created_at >= NOW() - INTERVAL ''2 days''');

-- auth.mfa_challenges (has created_at)
\echo '-- auth.mfa_challenges'
SELECT * FROM generate_insert_statements('auth', 'mfa_challenges',
  'WHERE created_at >= NOW() - INTERVAL ''2 days''');

-- auth.one_time_tokens (has created_at)
\echo '-- auth.one_time_tokens'
SELECT * FROM generate_insert_statements('auth', 'one_time_tokens',
  'WHERE created_at >= NOW() - INTERVAL ''2 days''');

-- auth.flow_state (has created_at)
\echo '-- auth.flow_state'
SELECT * FROM generate_insert_statements('auth', 'flow_state',
  'WHERE created_at >= NOW() - INTERVAL ''2 days''');

-- ====================
-- STORAGE SCHEMA TABLES
-- ====================

\echo ''
\echo '-- ===================='
\echo '-- Storage Schema Tables'
\echo '-- ===================='
\echo ''

-- storage.objects (has created_at)
\echo '-- storage.objects'
SELECT * FROM generate_insert_statements('storage', 'objects',
  'WHERE created_at >= NOW() - INTERVAL ''2 days''');

-- storage.buckets (has created_at)
\echo '-- storage.buckets'
SELECT * FROM generate_insert_statements('storage', 'buckets',
  'WHERE created_at >= NOW() - INTERVAL ''2 days''');

-- storage.s3_multipart_uploads (has created_at)
\echo '-- storage.s3_multipart_uploads'
SELECT * FROM generate_insert_statements('storage', 's3_multipart_uploads',
  'WHERE created_at >= NOW() - INTERVAL ''2 days''');

-- storage.s3_multipart_uploads_parts (has created_at)
\echo '-- storage.s3_multipart_uploads_parts'
SELECT * FROM generate_insert_statements('storage', 's3_multipart_uploads_parts',
  'WHERE created_at >= NOW() - INTERVAL ''2 days''');

-- ====================
-- PUBLIC SCHEMA TABLES (in dependency order)
-- ====================

\echo ''
\echo '-- ===================='
\echo '-- Public Schema Tables'
\echo '-- ===================='
\echo ''

-- 1. Independent tables with no foreign keys (or only self-references)

\echo '-- public.language'
SELECT * FROM generate_insert_statements('public', 'language',
  'WHERE created_at >= NOW() - INTERVAL ''2 days''');

\echo '-- public.profile'
SELECT * FROM generate_insert_statements('public', 'profile',
  'WHERE created_at >= NOW() - INTERVAL ''2 days''');

-- 2. Language and region tables (self-referential, need special handling)

\echo '-- public.languoid (may have self-references via parent_id)'
\echo '-- Note: These will be inserted with deferred constraints'
SELECT * FROM generate_insert_statements('public', 'languoid',
  'WHERE created_at >= NOW() - INTERVAL ''2 days'' ORDER BY created_at');

\echo '-- public.languoid_alias'
SELECT * FROM generate_insert_statements('public', 'languoid_alias',
  'WHERE created_at >= NOW() - INTERVAL ''2 days''');

\echo '-- public.languoid_source'
SELECT * FROM generate_insert_statements('public', 'languoid_source',
  'WHERE created_at >= NOW() - INTERVAL ''2 days''');

\echo '-- public.languoid_property'
SELECT * FROM generate_insert_statements('public', 'languoid_property',
  'WHERE created_at >= NOW() - INTERVAL ''2 days''');

\echo '-- public.region (may have self-references via parent_id)'
SELECT * FROM generate_insert_statements('public', 'region',
  'WHERE created_at >= NOW() - INTERVAL ''2 days'' ORDER BY created_at');

\echo '-- public.region_alias'
SELECT * FROM generate_insert_statements('public', 'region_alias',
  'WHERE created_at >= NOW() - INTERVAL ''2 days''');

\echo '-- public.region_source'
SELECT * FROM generate_insert_statements('public', 'region_source',
  'WHERE created_at >= NOW() - INTERVAL ''2 days''');

\echo '-- public.region_property'
SELECT * FROM generate_insert_statements('public', 'region_property',
  'WHERE created_at >= NOW() - INTERVAL ''2 days''');

\echo '-- public.languoid_region'
SELECT * FROM generate_insert_statements('public', 'languoid_region',
  'WHERE created_at >= NOW() - INTERVAL ''2 days''');

-- 3. Project and related tables

\echo '-- public.project'
SELECT * FROM generate_insert_statements('public', 'project',
  'WHERE created_at >= NOW() - INTERVAL ''2 days''');

\echo '-- public.project_language_link'
SELECT * FROM generate_insert_statements('public', 'project_language_link',
  'WHERE created_at >= NOW() - INTERVAL ''2 days''');

\echo '-- public.profile_project_link'
SELECT * FROM generate_insert_statements('public', 'profile_project_link',
  'WHERE created_at >= NOW() - INTERVAL ''2 days''');

\echo '-- public.project_closure'
\echo '-- Note: Skipping - computed table that will be regenerated automatically'
-- SELECT * FROM generate_insert_statements('public', 'project_closure', NULL);

\echo '-- public.project_rollup_progress'
\echo '-- Note: Skipping - tracking table that will be regenerated automatically'
-- SELECT * FROM generate_insert_statements('public', 'project_rollup_progress', NULL);

\echo '-- public.invite'
SELECT * FROM generate_insert_statements('public', 'invite',
  'WHERE created_at >= NOW() - INTERVAL ''2 days''');

-- 4. Quest tables

\echo '-- public.quest'
SELECT * FROM generate_insert_statements('public', 'quest',
  'WHERE created_at >= NOW() - INTERVAL ''2 days''');

\echo '-- public.quest_closure'
\echo '-- Note: Skipping - computed table that will be regenerated automatically'
-- SELECT * FROM generate_insert_statements('public', 'quest_closure', NULL);

-- 5. Asset tables (handle self-references carefully)

\echo '-- public.asset (may have self-references via source_asset_id)'
\echo '-- Ordered by created_at to handle dependencies'
SELECT * FROM generate_insert_statements('public', 'asset',
  'WHERE created_at >= NOW() - INTERVAL ''2 days'' ORDER BY created_at');

\echo '-- public.asset_content_link'
SELECT * FROM generate_insert_statements('public', 'asset_content_link',
  'WHERE created_at >= NOW() - INTERVAL ''2 days''');

-- 6. Link tables between quest and asset

\echo '-- public.quest_asset_link'
SELECT * FROM generate_insert_statements('public', 'quest_asset_link',
  'WHERE created_at >= NOW() - INTERVAL ''2 days''');

-- 7. Tag tables

\echo '-- public.tag'
SELECT * FROM generate_insert_statements('public', 'tag',
  'WHERE created_at >= NOW() - INTERVAL ''2 days''');

\echo '-- public.quest_tag_link'
SELECT * FROM generate_insert_statements('public', 'quest_tag_link',
  'WHERE created_at >= NOW() - INTERVAL ''2 days''');

\echo '-- public.asset_tag_link'
SELECT * FROM generate_insert_statements('public', 'asset_tag_link',
  'WHERE created_at >= NOW() - INTERVAL ''2 days''');

-- 8. Vote and interaction tables

\echo '-- public.vote'
SELECT * FROM generate_insert_statements('public', 'vote',
  'WHERE created_at >= NOW() - INTERVAL ''2 days''');

-- 9. Moderation and reporting tables

\echo '-- public.flag'
SELECT * FROM generate_insert_statements('public', 'flag',
  'WHERE created_at >= NOW() - INTERVAL ''2 days''');

\echo '-- public.reports'
SELECT * FROM generate_insert_statements('public', 'reports',
  'WHERE created_at >= NOW() - INTERVAL ''2 days''');

\echo '-- public.blocked_users'
SELECT * FROM generate_insert_statements('public', 'blocked_users',
  'WHERE created_at >= NOW() - INTERVAL ''2 days''');

\echo '-- public.blocked_content'
SELECT * FROM generate_insert_statements('public', 'blocked_content',
  'WHERE created_at >= NOW() - INTERVAL ''2 days''');

-- 10. System tables
-- Note: Some of these tables may not exist in all environments
-- Commented out non-existent tables

-- \echo '-- public.notification'
-- SELECT * FROM generate_insert_statements('public', 'notification',
--   'WHERE created_at >= NOW() - INTERVAL ''2 days''');

-- \echo '-- public.subscription'
-- SELECT * FROM generate_insert_statements('public', 'subscription',
--   'WHERE created_at >= NOW() - INTERVAL ''2 days''');

-- \echo '-- public.http_request_queue'
-- SELECT * FROM generate_insert_statements('public', 'http_request_queue',
--   'WHERE created_at >= NOW() - INTERVAL ''2 days''');

-- \echo '-- public._http_response'
-- SELECT * FROM generate_insert_statements('public', '_http_response',
--   'WHERE created_at >= NOW() - INTERVAL ''2 days''');

-- 11. Map tables and clone_job
-- Note: map_* tables are metadata/cache tables that will be regenerated
-- Skipping them to reduce extraction size significantly (80,000+ records!)

\echo '-- public.map_project'
\echo '-- Note: Skipping - metadata table that will be regenerated automatically'
-- SELECT * FROM generate_insert_statements('public', 'map_project', NULL);

\echo '-- public.map_quest'
\echo '-- Note: Skipping - metadata table that will be regenerated automatically'
-- SELECT * FROM generate_insert_statements('public', 'map_quest', NULL);

\echo '-- public.map_asset'
\echo '-- Note: Skipping - metadata table that will be regenerated automatically'
-- SELECT * FROM generate_insert_statements('public', 'map_asset', NULL);

\echo '-- public.map_acl'
\echo '-- Note: Skipping - metadata table that will be regenerated automatically'
-- SELECT * FROM generate_insert_statements('public', 'map_acl', NULL);

\echo '-- public.clone_job'
SELECT * FROM generate_insert_statements('public', 'clone_job',
  'WHERE created_at >= NOW() - INTERVAL ''2 days''');

-- Finalize
\echo ''
\echo 'COMMIT;'
\echo ''
\echo '-- Extraction complete'

-- Clean up the temporary function
DROP FUNCTION IF EXISTS generate_insert_statements(TEXT, TEXT, TEXT);

