-- Migration: Add v2_1_to_v2_2 transform for content_type addition
-- Purpose: Handle uploads from v2.1 clients that don't include content_type by:
--   1. Creating v2_1_to_v2_2 transform function to add content_type to asset records
--   2. Updating mutation handlers to chain v2_1_to_v2_2 transform
--
-- Transform chain:
--   v0.x data → v0_to_v1 → v1_to_v2 → v2_1_to_v2_2
--   v1.x data → v1_to_v2 → v2_1_to_v2_2
--   v2.0/v2.1 data → v2_1_to_v2_2
--   v2.2+ data → passthrough

-- ============================================================================
-- STEP 1: Create v2_1_to_v2_2 transform function
-- ============================================================================
-- This function adds content_type to asset records that don't have it.
-- - If source_asset_id is present → content_type = 'translation'
-- - Otherwise → content_type = 'source'

CREATE OR REPLACE FUNCTION public.v2_1_to_v2_2(
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
  v_content_type text;
BEGIN
  raise log '[v2_1_to_v2_2] start meta=% ops_count=%',
    v_meta,
    coalesce(array_length(p_ops,1),0);

  FOREACH op IN ARRAY p_ops LOOP
    raise log '[v2_1_to_v2_2] inbound op: table=% op=% record=%',
      op.table_name, op.op, op.record::text;

    -- Handle asset: add content_type if not present
    IF lower(op.table_name) = 'asset' THEN
      v_record := op.record;
      
      -- Only add content_type if not already present
      IF (v_record->>'content_type') IS NULL THEN
        -- Determine content_type based on source_asset_id
        IF (v_record->>'source_asset_id') IS NOT NULL THEN
          v_content_type := 'translation';
        ELSE
          v_content_type := 'source';
        END IF;
        
        v_record := v_record || jsonb_build_object('content_type', v_content_type);
        raise log '[v2_1_to_v2_2] asset: added content_type=% (source_asset_id=%)',
          v_content_type, v_record->>'source_asset_id';
      END IF;
      
      out_ops := out_ops || (row(op.table_name, op.op, v_record))::public.mutation_op;
    ELSE
      -- Passthrough for all other tables
      out_ops := out_ops || op;
    END IF;
  END LOOP;

  raise log '[v2_1_to_v2_2] end out_ops_count=%', coalesce(array_length(out_ops,1),0);

  RETURN out_ops;
END;
$$;

-- ============================================================================
-- STEP 2: Update apply_table_mutation to chain v2_1_to_v2_2 transform
-- ============================================================================
-- v0 data → v0_to_v1 → v1_to_v2 → v2_1_to_v2_2
-- v1 data → v1_to_v2 → v2_1_to_v2_2
-- v2.0/v2.1 data → v2_1_to_v2_2
-- v2.2+ data → passthrough

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
  v_version_is_pre_v2_2 boolean := (v_meta = '2') OR (v_meta = '2.0') OR (v_meta = '2.1');
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

  raise log '[apply_table_mutation] v_is_v0=% v_is_v1=% v_is_pre_v2_2=% full_meta=%',
    v_version_is_v0, v_version_is_v1, v_version_is_pre_v2_2, v_meta;

  v_logs := v_logs
    || format('[input] op=%s table=%s meta=%s record=%s\n', p_op, p_table_name, v_meta, p_record::text)
    || format('[debug] v_is_v0=%s v_is_v1=%s v_is_pre_v2_2=%s lower(table)=%s\n',
         CASE WHEN v_version_is_v0 THEN 'true' ELSE 'false' END,
         CASE WHEN v_version_is_v1 THEN 'true' ELSE 'false' END,
         CASE WHEN v_version_is_pre_v2_2 THEN 'true' ELSE 'false' END,
         lower(p_table_name)
       );

  -- Versioned transform chain
  IF v_version_is_v0 THEN
    -- v0 → v0_to_v1 → v1_to_v2 → v2_1_to_v2_2
    ops := public.v0_to_v1(ops, p_client_meta);
    v_logs := v_logs || '[transform] v0_to_v1 applied\n';

    raise log '[apply_table_mutation] after v0_to_v1 transform ops=%',
      (SELECT string_agg(format('(%s %s %s)', x.table_name, x.op, x.record::text), ' | ')
       FROM unnest(ops) x);
    
    ops := public.v1_to_v2(ops, p_client_meta);
    v_logs := v_logs || '[transform] v1_to_v2 applied\n';

    raise log '[apply_table_mutation] after v1_to_v2 transform ops=%',
      (SELECT string_agg(format('(%s %s %s)', x.table_name, x.op, x.record::text), ' | ')
       FROM unnest(ops) x);

    ops := public.v2_1_to_v2_2(ops, p_client_meta);
    v_logs := v_logs || '[transform] v2_1_to_v2_2 applied\n';

    raise log '[apply_table_mutation] after v2_1_to_v2_2 transform ops=%',
      (SELECT string_agg(format('(%s %s %s)', x.table_name, x.op, x.record::text), ' | ')
       FROM unnest(ops) x);
       
  ELSIF v_version_is_v1 THEN
    -- v1 → v1_to_v2 → v2_1_to_v2_2
    ops := public.v1_to_v2(ops, p_client_meta);
    v_logs := v_logs || '[transform] v1_to_v2 applied\n';

    raise log '[apply_table_mutation] after v1_to_v2 transform ops=%',
      (SELECT string_agg(format('(%s %s %s)', x.table_name, x.op, x.record::text), ' | ')
       FROM unnest(ops) x);

    ops := public.v2_1_to_v2_2(ops, p_client_meta);
    v_logs := v_logs || '[transform] v2_1_to_v2_2 applied\n';

    raise log '[apply_table_mutation] after v2_1_to_v2_2 transform ops=%',
      (SELECT string_agg(format('(%s %s %s)', x.table_name, x.op, x.record::text), ' | ')
       FROM unnest(ops) x);

  ELSIF v_version_is_pre_v2_2 THEN
    -- v2.0/v2.1 → v2_1_to_v2_2
    ops := public.v2_1_to_v2_2(ops, p_client_meta);
    v_logs := v_logs || '[transform] v2_1_to_v2_2 applied\n';

    raise log '[apply_table_mutation] after v2_1_to_v2_2 transform ops=%',
      (SELECT string_agg(format('(%s %s %s)', x.table_name, x.op, x.record::text), ' | ')
       FROM unnest(ops) x);
  END IF;
  -- v2.2+ data passes through unchanged

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
-- STEP 3: Update apply_table_mutation_transaction to chain v2_1_to_v2_2 transform
-- ============================================================================

CREATE OR REPLACE FUNCTION public.apply_table_mutation_transaction(
  p_ops jsonb,
  p_default_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public'
AS $$
DECLARE
  -- logging
  v_logs text := '';
  -- arrays of ops
  inbound_ops jsonb[] := '{}';
  staged_ops public.mutation_op[] := '{}';
  final_ops public.mutation_op[] := '{}';
  -- loop vars for execution
  t text; o text; r jsonb;
  -- error classification
  v_sqlstate text;
  v_status text := '2xx';
  v_ref_code text := null;
  v_error_code text := null;
  v_error_message text := null;
  v_failed_op jsonb := null;
  -- helpers
  v_meta text;
  elem jsonb;
  op_table text;
  op_name text;
  op_record jsonb;
  op_client_meta jsonb;
  v_op_count int := 0;
  v_version_is_v0 boolean;
  v_version_is_v1 boolean;
  v_version_is_pre_v2_2 boolean;
  v_transformed_ops public.mutation_op[];
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
    v_version_is_pre_v2_2 := (v_meta = '2') OR (v_meta = '2.0') OR (v_meta = '2.1');

    IF op_table IS NULL OR op_name = '' THEN
      RAISE EXCEPTION 'apply_table_mutation_transaction: each elem requires table_name and op';
    END IF;

    -- build a single mutation_op
    staged_ops := ARRAY[(row(op_table, op_name, op_record))::public.mutation_op];

    -- Apply transform chain based on version
    IF v_version_is_v0 THEN
      -- v0 → v0_to_v1 → v1_to_v2 → v2_1_to_v2_2
      v_transformed_ops := public.v0_to_v1(staged_ops, op_client_meta);
      v_transformed_ops := public.v1_to_v2(v_transformed_ops, op_client_meta);
      v_transformed_ops := public.v2_1_to_v2_2(v_transformed_ops, op_client_meta);
      v_logs := v_logs || format('[transform] v0_to_v1 + v1_to_v2 + v2_1_to_v2_2 applied for %s %s\n', op_table, op_name);
    ELSIF v_version_is_v1 THEN
      -- v1 → v1_to_v2 → v2_1_to_v2_2
      v_transformed_ops := public.v1_to_v2(staged_ops, op_client_meta);
      v_transformed_ops := public.v2_1_to_v2_2(v_transformed_ops, op_client_meta);
      v_logs := v_logs || format('[transform] v1_to_v2 + v2_1_to_v2_2 applied for %s %s\n', op_table, op_name);
    ELSIF v_version_is_pre_v2_2 THEN
      -- v2.0/v2.1 → v2_1_to_v2_2
      v_transformed_ops := public.v2_1_to_v2_2(staged_ops, op_client_meta);
      v_logs := v_logs || format('[transform] v2_1_to_v2_2 applied for %s %s\n', op_table, op_name);
    ELSE
      -- v2.2+ passthrough
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
      v_failed_op := null; -- clear on success
    END LOOP;
    v_status := '2xx';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS 
      v_sqlstate = returned_sqlstate,
      v_error_message = message_text;
    v_error_code := v_sqlstate;

    -- classify
    IF (v_sqlstate ~ '^22...$') OR (v_sqlstate ~ '^23...$') OR (v_sqlstate = '42501') OR (v_sqlstate = '23505') THEN
      v_status := '4xx';
    ELSE
      v_status := '5xx';
    END IF;

    v_logs := v_logs || format('[error] sqlstate=%s message=%s\n', v_sqlstate, coalesce(v_error_message, ''));

    IF v_status = '4xx' THEN
      -- generate 6-digit ref code
      v_ref_code := lpad((floor(random()*1000000))::int::text, 6, '0');

      -- persist each ORIGINAL inbound op (not transformed) to inbox
      FOREACH elem IN ARRAY inbound_ops
      LOOP
        INSERT INTO public.upload_inbox (data, logs, error_code, ref_code)
        VALUES (elem, v_logs, v_error_code, v_ref_code);
      END LOOP;
    END IF;
  END;

  RETURN jsonb_build_object(
    'status', v_status,
    'logs', v_logs,
    'ref_code', v_ref_code,
    'error_code', v_error_code,
    'error_message', v_error_message,
    'failed_op', v_failed_op,
    'op_count', v_op_count,
    'ops_summary', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'table', op_elem->>'table_name',
          'op', op_elem->>'op',
          'has_record', (op_elem ? 'record')
        )
      )
      FROM jsonb_array_elements(p_ops) AS op_elem
    )
  );
END;
$$;

