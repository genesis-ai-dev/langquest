-- Validation Script for Data Extraction
-- Purpose: Test extraction logic on a small subset before full extraction
-- Usage: psql [connection-string] -f validate_extraction.sql

\set ON_ERROR_STOP on

-- Display environment info
\echo '========================================='
\echo 'Data Extraction Validation Script'
\echo '========================================='
\echo ''

-- Check database connection
SELECT 'Database: ' || current_database() as info;
SELECT 'User: ' || current_user as info;
SELECT 'Server Version: ' || version() as info;
\echo ''

-- Test 1: Check if key tables exist
\echo 'Test 1: Verifying table existence...'
\echo ''

DO $$
DECLARE
  v_tables TEXT[] := ARRAY[
    'auth.users',
    'auth.identities',
    'storage.objects',
    'public.project',
    'public.quest',
    'public.asset',
    'public.languoid',
    'public.region',
    'public.profile',
    'public.tag',
    'public.vote'
  ];
  v_table TEXT;
  v_exists BOOLEAN;
  v_missing TEXT[] := '{}';
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s LIMIT 1)', v_table) INTO v_exists;
    IF v_exists THEN
      RAISE NOTICE '✓ Table exists: %', v_table;
    ELSE
      RAISE NOTICE '✗ Table missing or empty: %', v_table;
      v_missing := array_append(v_missing, v_table);
    END IF;
  END LOOP;
  
  IF array_length(v_missing, 1) > 0 THEN
    RAISE WARNING 'Some tables are missing or empty. Extraction may be incomplete.';
  END IF;
END $$;

\echo ''

-- Test 2: Count recent records (last 2 days)
\echo 'Test 2: Counting records from last 2 days...'
\echo ''

DO $$
DECLARE
  v_cutoff TIMESTAMP := NOW() - INTERVAL '2 days';
BEGIN
  RAISE NOTICE 'Cutoff date: %', v_cutoff;
END $$;

\echo ''

-- Public schema counts
SELECT 'public.project' as table_name, COUNT(*) as recent_count
FROM public.project
WHERE created_at >= NOW() - INTERVAL '2 days'
UNION ALL
SELECT 'public.quest', COUNT(*)
FROM public.quest
WHERE created_at >= NOW() - INTERVAL '2 days'
UNION ALL
SELECT 'public.asset', COUNT(*)
FROM public.asset
WHERE created_at >= NOW() - INTERVAL '2 days'
UNION ALL
SELECT 'public.profile', COUNT(*)
FROM public.profile
WHERE created_at >= NOW() - INTERVAL '2 days'
UNION ALL
SELECT 'public.vote', COUNT(*)
FROM public.vote
WHERE created_at >= NOW() - INTERVAL '2 days'
UNION ALL
SELECT 'public.tag', COUNT(*)
FROM public.tag
WHERE created_at >= NOW() - INTERVAL '2 days'
UNION ALL
SELECT 'auth.users', COUNT(*)
FROM auth.users
WHERE created_at >= NOW() - INTERVAL '2 days'
ORDER BY table_name;

\echo ''

-- Test 3: Check for self-referential dependencies
\echo 'Test 3: Checking self-referential dependencies...'
\echo ''

-- Assets with source_asset_id
SELECT 'Assets with source_asset_id: ' || COUNT(*)::text as info
FROM public.asset
WHERE source_asset_id IS NOT NULL
  AND created_at >= NOW() - INTERVAL '2 days';

-- Languoids with parent_id
SELECT 'Languoids with parent_id: ' || COUNT(*)::text as info
FROM public.languoid
WHERE parent_id IS NOT NULL
  AND created_at >= NOW() - INTERVAL '2 days';

-- Regions with parent_id
SELECT 'Regions with parent_id: ' || COUNT(*)::text as info
FROM public.region
WHERE parent_id IS NOT NULL
  AND created_at >= NOW() - INTERVAL '2 days';

\echo ''

-- Test 4: Verify foreign key relationships
\echo 'Test 4: Verifying foreign key integrity...'
\echo ''

-- Check for orphaned assets (assets without valid project_id)
DO $$
DECLARE
  v_orphaned_assets INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_orphaned_assets
  FROM public.asset a
  WHERE a.created_at >= NOW() - INTERVAL '2 days'
    AND a.project_id IS NOT NULL
    AND a.project_id NOT IN (SELECT id FROM public.project);
  
  IF v_orphaned_assets > 0 THEN
    RAISE WARNING '% assets reference non-existent projects', v_orphaned_assets;
  ELSE
    RAISE NOTICE '✓ No orphaned assets found';
  END IF;
END $$;

-- Check for orphaned quests
DO $$
DECLARE
  v_orphaned_quests INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_orphaned_quests
  FROM public.quest q
  WHERE q.created_at >= NOW() - INTERVAL '2 days'
    AND q.project_id NOT IN (SELECT id FROM public.project);
  
  IF v_orphaned_quests > 0 THEN
    RAISE WARNING '% quests reference non-existent projects', v_orphaned_quests;
  ELSE
    RAISE NOTICE '✓ No orphaned quests found';
  END IF;
END $$;

\echo ''

-- Test 5: Sample INSERT statement generation
\echo 'Test 5: Testing INSERT statement generation...'
\echo ''

-- Create the helper function temporarily
CREATE OR REPLACE FUNCTION test_generate_insert(
  p_schema TEXT,
  p_table TEXT,
  p_limit INTEGER DEFAULT 1
)
RETURNS TABLE(insert_stmt TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
  v_columns TEXT;
  v_select TEXT;
  v_sql TEXT;
BEGIN
  -- Get column list
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
  INTO v_columns
  FROM information_schema.columns
  WHERE table_schema = p_schema
    AND table_name = p_table;

  -- Build SELECT with proper formatting
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

  -- Build query
  v_sql := format(
    'SELECT ''INSERT INTO %I.%I (%s) VALUES ('' || %s || '');'' FROM %I.%I LIMIT %s',
    p_schema, p_table, v_columns, v_select, p_schema, p_table, p_limit
  );

  RETURN QUERY EXECUTE v_sql;
END;
$$;

-- Test on public.language (should be stable)
\echo 'Sample INSERT for public.language:'
SELECT * FROM test_generate_insert('public', 'language', 1);

\echo ''

-- Clean up test function
DROP FUNCTION test_generate_insert(TEXT, TEXT, INTEGER);

-- Test 6: Check table schemas match expected structure
\echo 'Test 6: Verifying table schemas...'
\echo ''

-- Check for critical columns
DO $$
BEGIN
  -- Quest should have metadata column (added in migration 20251017000000)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quest'
      AND column_name = 'metadata'
  ) THEN
    RAISE NOTICE '✓ quest.metadata column exists';
  ELSE
    RAISE WARNING '✗ quest.metadata column missing - migration 20251017000000 may not be applied';
  END IF;

  -- Asset should have project_id column (added in migration 20251008120001)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'asset'
      AND column_name = 'project_id'
  ) THEN
    RAISE NOTICE '✓ asset.project_id column exists';
  ELSE
    RAISE WARNING '✗ asset.project_id column missing - migration 20251008120001 may not be applied';
  END IF;

  -- Tag should have key/value columns (migrated in 20251008120001)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tag'
      AND column_name = 'key'
  ) THEN
    RAISE NOTICE '✓ tag.key column exists';
  ELSE
    RAISE WARNING '✗ tag.key column missing - migration 20251008120001 may not be applied';
  END IF;

  -- Languoid table should exist (created in migration 20251001124000)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'languoid'
  ) THEN
    RAISE NOTICE '✓ languoid table exists';
  ELSE
    RAISE WARNING '✗ languoid table missing - migration 20251001124000 may not be applied';
  END IF;
END $$;

\echo ''

-- Summary
\echo '========================================='
\echo 'Validation Complete'
\echo '========================================='
\echo ''
\echo 'Review the output above for any warnings or errors.'
\echo ''
\echo 'If all tests passed:'
\echo '  → You can proceed with extract_recent_data.sql'
\echo ''
\echo 'If there are warnings:'
\echo '  → Review the specific issues'
\echo '  → Some warnings are expected if certain tables are empty'
\echo '  → Migration warnings indicate schema state'
\echo ''

