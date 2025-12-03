-- Migration: Add submission_type enum field to asset table
-- Version: 2.0 → 3.0 (BREAKING CHANGE)
-- Purpose: Support both translations and transcriptions in the asset table
-- Affected tables: asset
-- 
-- BREAKING CHANGE: Constraint requires submission_type for assets with source_asset_id.
-- v2.0 clients uploading without submission_type will fail without transform function.

-- Add submission_type column
-- NULL for source assets (assets without source_asset_id)
-- 'translation' or 'transcription' for assets that are translations/transcriptions (with source_asset_id)
-- Made nullable to support source assets and existing code that doesn't specify it
alter table asset
  add column submission_type text;

-- Add check constraint to ensure only valid enum values
-- NULL is only allowed for source assets (assets without source_asset_id)
-- Translations/transcriptions (with source_asset_id) must have a submission_type
alter table asset
  add constraint asset_submission_type_check
  check (
    (submission_type is null and source_asset_id is null) or
    (submission_type is not null and submission_type in ('translation', 'transcription'))
  );

-- Update existing records: only set 'translation' for assets that have source_asset_id
-- (i.e., translations/transcriptions). Source assets should remain NULL.
update asset
set submission_type = 'translation'
where submission_type is null
  and source_asset_id is not null;

-- Add comment for documentation
comment on column asset.submission_type is 'Type of submission: translation (target language) or transcription (source language). NULL for source assets (assets without source_asset_id).';

-- Add index for efficient filtering by submission type
create index if not exists asset_submission_type_idx on asset(submission_type);

-- ============================================================================
-- Update schema version
-- ============================================================================

-- Update get_schema_info function to return version 3.0
create or replace function public.get_schema_info()
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'schema_version', '3.0',
    'notes', 'Added submission_type field to asset table for transcription support (breaking change)'
  );
$$;

grant execute on function public.get_schema_info() to anon, authenticated;

-- ============================================================================
-- Server-side transform function for v2.0 → v3.0
-- ============================================================================
-- Purpose: Handle uploads from v2.0 clients that don't include submission_type
-- Transform chain:
--   v0.x data → v0_to_v1 → v1_to_v2 → v2_to_v3 → v3.0 data
--   v1.x data → v1_to_v2 → v2_to_v3 → v3.0 data
--   v2.0 data → v2_to_v3 → v3.0 data
--   v3.0+ data → passthrough

CREATE OR REPLACE FUNCTION public.v2_to_v3(
  p_ops public.mutation_op[],
  p_meta jsonb
)
RETURNS public.mutation_op[]
LANGUAGE plpgsql
AS $$
DECLARE
  out_ops public.mutation_op[] := '{}';
  op public.mutation_op;
  v_meta text := coalesce(p_meta->>'schema_version', '');
  v_record jsonb;
  v_source_asset_id text;
BEGIN
  raise log '[v2_to_v3] start meta=% ops_count=%',
    v_meta,
    coalesce(array_length(p_ops,1),0);

  FOREACH op IN ARRAY p_ops LOOP
    raise log '[v2_to_v3] inbound op: table=% op=% record=%',
      op.table_name, op.op, op.record::text;

    -- Transform asset records that don't have submission_type
    -- This handles v0, v1, and v2.x data (v3.0+ should already have submission_type)
    IF lower(op.table_name) = 'asset' THEN
      v_record := op.record;
      v_source_asset_id := v_record->>'source_asset_id';

      -- Only add submission_type if source_asset_id exists but submission_type is missing
      IF v_source_asset_id IS NOT NULL AND (v_record->>'submission_type') IS NULL THEN
        -- Default to 'translation' for existing translations/transcriptions
        v_record := v_record || jsonb_build_object('submission_type', 'translation');
        raise log '[v2_to_v3] asset: added submission_type=translation for source_asset_id=% version=%',
          v_source_asset_id, v_meta;
      END IF;

      out_ops := out_ops || (row(op.table_name, op.op, v_record))::public.mutation_op;
    ELSE
      -- Passthrough for all other tables or versions
      out_ops := out_ops || op;
    END IF;
  END LOOP;

  raise log '[v2_to_v3] end out_ops_count=%', coalesce(array_length(out_ops,1),0);

  RETURN out_ops;
END;
$$;

-- ============================================================================
-- Update apply_table_mutation to chain v2_to_v3 transform
-- ============================================================================

CREATE OR REPLACE FUNCTION public.apply_table_mutation(
  p_op text,
  p_table_name text,
  p_record jsonb,
  p_client_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  target_schema_name text := 'public';
  v_logs text := '';
  v_meta text := coalesce(p_client_meta->>'schema_version', '0');
  v_version_is_v0 boolean := (v_meta = '0') OR (v_meta LIKE '0.%');
  v_version_is_v1 boolean := (v_meta = '1') OR (v_meta LIKE '1.%');
  v_version_is_v2 boolean := (v_meta = '2.0') OR (v_meta LIKE '2.%');
  ops public.mutation_op[] := ARRAY[(row(p_table_name, lower(p_op), p_record))::public.mutation_op];
  final_ops public.mutation_op[];
  t text; o text; r jsonb;
BEGIN
  -- Validate required inputs
  IF p_op IS NULL OR p_table_name IS NULL THEN
    RAISE EXCEPTION 'apply_table_mutation: op and table_name are required';
  END IF;

  p_op := lower(p_op);

  -- Log inputs
  raise log '[apply_table_mutation] input op=% table=% meta=% record=%',
    p_op, p_table_name, v_meta, p_record::text;

  raise log '[apply_table_mutation] v_is_v0=% v_is_v1=% v_is_v2=% full_meta=%',
    v_version_is_v0, v_version_is_v1, v_version_is_v2, v_meta;

  v_logs := v_logs
    || format('[input] op=%s table=%s meta=%s record=%s\n', p_op, p_table_name, v_meta, p_record::text)
    || format('[debug] v_is_v0=%s v_is_v1=%s v_is_v2=%s lower(table)=%s\n',
         CASE WHEN v_version_is_v0 THEN 'true' ELSE 'false' END,
         CASE WHEN v_version_is_v1 THEN 'true' ELSE 'false' END,
         CASE WHEN v_version_is_v2 THEN 'true' ELSE 'false' END,
         lower(p_table_name)
       );

  -- Versioned transform chain
  IF v_version_is_v0 THEN
    -- v0 → v0_to_v1 → v1_to_v2 → v2_to_v3
    ops := public.v0_to_v1(ops, p_client_meta);
    v_logs := v_logs || '[transform] v0_to_v1 applied\n';

    raise log '[apply_table_mutation] after v0_to_v1 transform ops=%',
      (SELECT string_agg(format('(%s %s %s)', x.table_name, x.op, x.record::text), ' | ')
       FROM unnest(ops) x);
    
    -- v0_to_v1 now includes languoid_id, but apply v1_to_v2 for any edge cases
    ops := public.v1_to_v2(ops, p_client_meta);
    v_logs := v_logs || '[transform] v1_to_v2 applied\n';

    raise log '[apply_table_mutation] after v1_to_v2 transform ops=%',
      (SELECT string_agg(format('(%s %s %s)', x.table_name, x.op, x.record::text), ' | ')
       FROM unnest(ops) x);

    -- Apply v2_to_v3 for submission_type
    ops := public.v2_to_v3(ops, p_client_meta);
    v_logs := v_logs || '[transform] v2_to_v3 applied\n';
       
  ELSIF v_version_is_v1 THEN
    -- v1 → v1_to_v2 → v2_to_v3
    ops := public.v1_to_v2(ops, p_client_meta);
    v_logs := v_logs || '[transform] v1_to_v2 applied\n';

    raise log '[apply_table_mutation] after v1_to_v2 transform ops=%',
      (SELECT string_agg(format('(%s %s %s)', x.table_name, x.op, x.record::text), ' | ')
       FROM unnest(ops) x);

    -- Apply v2_to_v3 for submission_type
    ops := public.v2_to_v3(ops, p_client_meta);
    v_logs := v_logs || '[transform] v2_to_v3 applied\n';

  ELSIF v_version_is_v2 THEN
    -- v2.0 → v2_to_v3
    ops := public.v2_to_v3(ops, p_client_meta);
    v_logs := v_logs || '[transform] v2_to_v3 applied\n';

    raise log '[apply_table_mutation] after v2_to_v3 transform ops=%',
      (SELECT string_agg(format('(%s %s %s)', x.table_name, x.op, x.record::text), ' | ')
       FROM unnest(ops) x);
  END IF;
  -- v3.0+ data passes through unchanged

  final_ops := ops;

  -- Execute each resulting op
  FOR t, o, r IN
    SELECT (x).table_name, (x).op, (x).record
    FROM unnest(final_ops) AS x
  LOOP
    raise log '[apply_table_mutation] executing op=% table=% record=%', o, t, r::text;

    v_logs := v_logs || format('[exec] %s %s %s\n', o, t, r::text);

    PERFORM public._apply_single_json_dml(o, t, r);
  END LOOP;

  raise log '[apply_table_mutation] complete. aggregated logs=%', v_logs;

  RETURN v_logs;
END;
$$;

-- ============================================================================
-- Update apply_table_mutation_transaction to chain v2_to_v3 transform
-- ============================================================================

CREATE OR REPLACE FUNCTION public.apply_table_mutation_transaction(
  p_ops jsonb,
  p_default_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  inbound_ops jsonb[] := '{}';
  final_ops public.mutation_op[] := '{}';
  staged_ops public.mutation_op[];
  v_transformed_ops public.mutation_op[];
  elem jsonb;
  op_table text;
  op_name text;
  op_record jsonb;
  op_client_meta jsonb;
  v_meta text;
  v_version_is_v0 boolean;
  v_version_is_v1 boolean;
    v_version_is_v2 boolean;
  v_logs text := '';
  v_op_count int;
  v_failed_op jsonb;
  t text; o text; r jsonb;
BEGIN
  IF p_ops IS NULL OR jsonb_typeof(p_ops) <> 'array' THEN
    RAISE EXCEPTION 'apply_table_mutation_transaction: p_ops must be a json array';
  END IF;

  -- stage inbound ops in order
  FOR elem IN SELECT jsonb_array_elements(p_ops)
  LOOP
    inbound_ops := array_append(inbound_ops, elem);
  END LOOP;

  -- transform/build final ops list
  FOREACH elem IN ARRAY inbound_ops
  LOOP
    op_table := coalesce(elem->>'table_name', elem->>'table');
    op_name := lower(coalesce(elem->>'op', ''));
    op_record := coalesce(elem->'record', '{}'::jsonb);
    op_client_meta := coalesce(elem->'client_meta', p_default_meta);
    v_meta := coalesce(op_client_meta->>'schema_version', '0');
    v_version_is_v0 := (v_meta = '0') OR (v_meta LIKE '0.%');
    v_version_is_v1 := (v_meta = '1') OR (v_meta LIKE '1.%');
    v_version_is_v2 := (v_meta = '2.0') OR (v_meta LIKE '2.%');

    IF op_table IS NULL OR op_name = '' THEN
      RAISE EXCEPTION 'apply_table_mutation_transaction: each elem requires table_name and op';
    END IF;

    -- build a single mutation_op
    staged_ops := ARRAY[(row(op_table, op_name, op_record))::public.mutation_op];

    -- Apply transform chain based on version
    IF v_version_is_v0 THEN
      -- v0 → v0_to_v1 → v1_to_v2 → v2_to_v3
      v_transformed_ops := public.v0_to_v1(staged_ops, op_client_meta);
      v_transformed_ops := public.v1_to_v2(v_transformed_ops, op_client_meta);
      v_transformed_ops := public.v2_to_v3(v_transformed_ops, op_client_meta);
      v_logs := v_logs || format('[transform] v0_to_v1 + v1_to_v2 + v2_to_v3 applied for %s %s\n', op_table, op_name);
    ELSIF v_version_is_v1 THEN
      -- v1 → v1_to_v2 → v2_to_v3
      v_transformed_ops := public.v1_to_v2(staged_ops, op_client_meta);
      v_transformed_ops := public.v2_to_v3(v_transformed_ops, op_client_meta);
      v_logs := v_logs || format('[transform] v1_to_v2 + v2_to_v3 applied for %s %s\n', op_table, op_name);
    ELSIF v_version_is_v2 THEN
      -- v2.0 → v2_to_v3
      v_transformed_ops := public.v2_to_v3(staged_ops, op_client_meta);
      v_logs := v_logs || format('[transform] v2_to_v3 applied for %s %s\n', op_table, op_name);
    ELSE
      -- v3.0+ passthrough
      v_transformed_ops := staged_ops;
    END IF;
    
    final_ops := final_ops || v_transformed_ops;
  END LOOP;

  v_op_count := array_length(final_ops, 1);
  v_logs := v_logs || format('[summary] total_ops=%s\n', coalesce(v_op_count, 0));

  -- execute in a sub-transaction to allow catching and classifying errors
  BEGIN
    FOR t, o, r IN
      SELECT (x::public.mutation_op).table_name, (x::public.mutation_op).op, (x::public.mutation_op).record 
      FROM unnest(final_ops) AS x
    LOOP
      v_logs := v_logs || format('[exec] %s %s %s\n', o, t, r::text);
      v_failed_op := jsonb_build_object('op', o, 'table', t, 'record', r);
      PERFORM public._apply_single_json_dml(o, t, r);
    END LOOP;

    RETURN jsonb_build_object(
      'success', true,
      'logs', v_logs,
      'op_count', coalesce(v_op_count, 0)
    );
  EXCEPTION
    WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'failed_op', v_failed_op,
        'logs', v_logs,
        'op_count', coalesce(v_op_count, 0)
      );
  END;
END;
$$;

