-- Migration: Add v2_3_to_v2_4 transform for quest_asset_link placement fields
-- Purpose: Handle uploads from <2.4 clients that still store name / order_index /
--          metadata on asset (not quest_asset_link) by enriching link ops at
--          upload time. Looks for a sibling asset op in the same batch first,
--          then falls back to public.asset.
--
-- Path A (server-only): no APP_SCHEMA_VERSION / get_schema_info bump — already 2.4.
--
-- Transform chain:
--   v0.x data → v0_to_v1 → v1_to_v2 → v2_1_to_v2_2 → v2_3_to_v2_4
--   v1.x data → v1_to_v2 → v2_1_to_v2_2 → v2_3_to_v2_4
--   v2.0/v2.1 data → v2_1_to_v2_2 → v2_3_to_v2_4
--   v2.2/v2.3 data → v2_3_to_v2_4
--   v2.4+ data → passthrough

-- ============================================================================
-- STEP 1: Create v2_3_to_v2_4 transform (batch-aware)
-- ============================================================================
-- For quest_asset_link put/patch:
--   - name NULL → copy from asset.name
--   - metadata NULL → copy from asset.metadata
--   - order_index missing or 0, asset has non-zero → copy from asset.order_index
-- Source priority: sibling asset op in p_ops, then public.asset.

CREATE OR REPLACE FUNCTION public.v2_3_to_v2_4(
  p_ops public.mutation_op[],
  p_meta jsonb
)
RETURNS public.mutation_op[]
LANGUAGE plpgsql
AS $$
DECLARE
  out_ops public.mutation_op[] := '{}';
  op public.mutation_op;
  sibling public.mutation_op;
  v_meta text := coalesce(p_meta->>'schema_version', '');
  v_record jsonb;
  v_asset_id text;
  v_asset jsonb;
  v_needs_name boolean;
  v_needs_metadata boolean;
  v_needs_order boolean;
  v_asset_order int;
BEGIN
  RAISE LOG '[v2_3_to_v2_4] start meta=% ops_count=%',
    v_meta,
    coalesce(array_length(p_ops, 1), 0);

  IF p_ops IS NULL THEN
    RETURN '{}';
  END IF;

  FOREACH op IN ARRAY p_ops LOOP
    RAISE LOG '[v2_3_to_v2_4] inbound op: table=% op=% record=%',
      op.table_name, op.op, op.record::text;

    IF lower(op.table_name) = 'quest_asset_link'
       AND lower(op.op) IN ('put', 'patch') THEN
      v_record := coalesce(op.record, '{}'::jsonb);
      v_asset_id := v_record->>'asset_id';
      v_needs_name := (v_record->>'name') IS NULL;
      v_needs_metadata := (v_record->>'metadata') IS NULL;
      v_needs_order := (v_record->>'order_index') IS NULL
        OR (
          (v_record->>'order_index') ~ '^-?\d+$'
          AND (v_record->>'order_index')::int = 0
        );

      IF v_asset_id IS NOT NULL
         AND (v_needs_name OR v_needs_metadata OR v_needs_order) THEN
        v_asset := NULL;

        -- 1) Sibling asset op in the same batch
        FOREACH sibling IN ARRAY p_ops LOOP
          IF v_asset IS NULL
             AND lower(sibling.table_name) = 'asset'
             AND lower(sibling.op) IN ('put', 'patch')
             AND (sibling.record->>'id') = v_asset_id THEN
            v_asset := sibling.record;
            RAISE LOG '[v2_3_to_v2_4] found asset sibling in batch for asset_id=%',
              v_asset_id;
          END IF;
        END LOOP;

        -- 2) Fallback to public.asset
        IF v_asset IS NULL THEN
          SELECT jsonb_build_object(
            'name', a.name,
            'order_index', a.order_index,
            'metadata', a.metadata
          )
          INTO v_asset
          FROM public.asset a
          WHERE a.id::text = v_asset_id;

          IF v_asset IS NOT NULL THEN
            RAISE LOG '[v2_3_to_v2_4] found asset in public.asset for asset_id=%',
              v_asset_id;
          END IF;
        END IF;

        IF v_asset IS NOT NULL THEN
          IF v_needs_name AND (v_asset->>'name') IS NOT NULL THEN
            v_record := v_record || jsonb_build_object('name', v_asset->>'name');
          END IF;

          IF v_needs_metadata AND v_asset ? 'metadata'
             AND v_asset->>'metadata' IS NOT NULL THEN
            v_record := v_record || jsonb_build_object('metadata', v_asset->>'metadata');
          END IF;

          IF v_needs_order THEN
            BEGIN
              v_asset_order := (v_asset->>'order_index')::int;
            EXCEPTION WHEN OTHERS THEN
              v_asset_order := NULL;
            END;

            IF (v_record->>'order_index') IS NULL THEN
              v_record := v_record || jsonb_build_object(
                'order_index',
                coalesce(v_asset_order, 0)
              );
            ELSIF coalesce(v_asset_order, 0) <> 0 THEN
              -- Match backfill: replace legacy default 0 when asset has a real order
              v_record := v_record || jsonb_build_object(
                'order_index',
                v_asset_order
              );
            END IF;
          END IF;

          RAISE LOG '[v2_3_to_v2_4] enriched quest_asset_link asset_id=% record=%',
            v_asset_id, v_record::text;
        ELSE
          RAISE LOG '[v2_3_to_v2_4] no asset source for asset_id=%; leaving link unchanged',
            v_asset_id;
        END IF;
      END IF;

      out_ops := out_ops || (row(op.table_name, op.op, v_record))::public.mutation_op;
    ELSE
      out_ops := out_ops || op;
    END IF;
  END LOOP;

  RAISE LOG '[v2_3_to_v2_4] end out_ops_count=%',
    coalesce(array_length(out_ops, 1), 0);

  RETURN out_ops;
END;
$$;

COMMENT ON FUNCTION public.v2_3_to_v2_4(public.mutation_op[], jsonb) IS
  'Upload transform: copy name/order_index/metadata from asset onto quest_asset_link for clients < 2.4. Prefers sibling ops in the same batch, then public.asset.';

-- ============================================================================
-- STEP 2: Update apply_table_mutation to chain v2_3_to_v2_4
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
  v_logs text := '';
  v_meta text := coalesce(p_client_meta->>'schema_version', '0');
  v_version_is_v0 boolean := (v_meta = '0') OR (v_meta LIKE '0.%');
  v_version_is_v1 boolean := (v_meta = '1') OR (v_meta LIKE '1.%');
  v_version_is_pre_v2_2 boolean := (v_meta = '2') OR (v_meta = '2.0') OR (v_meta = '2.1');
  v_version_is_v2_2_or_v2_3 boolean := (v_meta = '2.2') OR (v_meta = '2.3');
  ops public.mutation_op[] := ARRAY[(row(p_table_name, lower(p_op), p_record))::public.mutation_op];
  final_ops public.mutation_op[];
  t text; o text; r jsonb;
BEGIN
  IF p_op IS NULL OR p_table_name IS NULL THEN
    RAISE EXCEPTION 'apply_table_mutation: op and table_name are required';
  END IF;

  p_op := lower(p_op);

  RAISE LOG '[apply_table_mutation] input op=% table=% meta=% record=%',
    p_op, p_table_name, v_meta, p_record::text;

  RAISE LOG '[apply_table_mutation] v_is_v0=% v_is_v1=% v_is_pre_v2_2=% v_is_v2_2_or_v2_3=% full_meta=%',
    v_version_is_v0, v_version_is_v1, v_version_is_pre_v2_2, v_version_is_v2_2_or_v2_3, v_meta;

  v_logs := v_logs
    || format('[input] op=%s table=%s meta=%s record=%s\n', p_op, p_table_name, v_meta, p_record::text)
    || format('[debug] v_is_v0=%s v_is_v1=%s v_is_pre_v2_2=%s v_is_v2_2_or_v2_3=%s lower(table)=%s\n',
         CASE WHEN v_version_is_v0 THEN 'true' ELSE 'false' END,
         CASE WHEN v_version_is_v1 THEN 'true' ELSE 'false' END,
         CASE WHEN v_version_is_pre_v2_2 THEN 'true' ELSE 'false' END,
         CASE WHEN v_version_is_v2_2_or_v2_3 THEN 'true' ELSE 'false' END,
         lower(p_table_name)
       );

  IF v_version_is_v0 THEN
    ops := public.v0_to_v1(ops, p_client_meta);
    v_logs := v_logs || '[transform] v0_to_v1 applied\n';

    ops := public.v1_to_v2(ops, p_client_meta);
    v_logs := v_logs || '[transform] v1_to_v2 applied\n';

    ops := public.v2_1_to_v2_2(ops, p_client_meta);
    v_logs := v_logs || '[transform] v2_1_to_v2_2 applied\n';

    ops := public.v2_3_to_v2_4(ops, p_client_meta);
    v_logs := v_logs || '[transform] v2_3_to_v2_4 applied\n';

  ELSIF v_version_is_v1 THEN
    ops := public.v1_to_v2(ops, p_client_meta);
    v_logs := v_logs || '[transform] v1_to_v2 applied\n';

    ops := public.v2_1_to_v2_2(ops, p_client_meta);
    v_logs := v_logs || '[transform] v2_1_to_v2_2 applied\n';

    ops := public.v2_3_to_v2_4(ops, p_client_meta);
    v_logs := v_logs || '[transform] v2_3_to_v2_4 applied\n';

  ELSIF v_version_is_pre_v2_2 THEN
    ops := public.v2_1_to_v2_2(ops, p_client_meta);
    v_logs := v_logs || '[transform] v2_1_to_v2_2 applied\n';

    ops := public.v2_3_to_v2_4(ops, p_client_meta);
    v_logs := v_logs || '[transform] v2_3_to_v2_4 applied\n';

  ELSIF v_version_is_v2_2_or_v2_3 THEN
    ops := public.v2_3_to_v2_4(ops, p_client_meta);
    v_logs := v_logs || '[transform] v2_3_to_v2_4 applied\n';
  END IF;
  -- v2.4+ data passes through unchanged

  final_ops := ops;

  FOR t, o, r IN
    SELECT (x).table_name, (x).op, (x).record
    FROM unnest(final_ops) AS x
  LOOP
    RAISE LOG '[apply_table_mutation] executing op=% table=% record=%', o, t, r::text;
    v_logs := v_logs || format('[exec] %s %s %s\n', o, t, r::text);
    PERFORM public._apply_single_json_dml(o, t, r);
  END LOOP;

  RAISE LOG '[apply_table_mutation] complete. aggregated logs=%', v_logs;

  RETURN v_logs;
END;
$$;

-- ============================================================================
-- STEP 3: Update apply_table_mutation_transaction
-- ============================================================================
-- Version chain still runs per inbound op. v2_3_to_v2_4 runs once on the full
-- final_ops list when any inbound op is < 2.4, so sibling asset ops in the same
-- batch are visible when enriching quest_asset_link.

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
  v_logs text := '';
  inbound_ops jsonb[] := '{}';
  staged_ops public.mutation_op[] := '{}';
  final_ops public.mutation_op[] := '{}';
  t text; o text; r jsonb;
  v_sqlstate text;
  v_status text := '2xx';
  v_ref_code text := null;
  v_error_code text := null;
  v_error_message text := null;
  v_failed_op jsonb := null;
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
  v_version_is_v2_2_or_v2_3 boolean;
  v_version_is_pre_v2_4 boolean;
  v_any_pre_v2_4 boolean := false;
  v_transformed_ops public.mutation_op[];
BEGIN
  IF p_ops IS NULL OR jsonb_typeof(p_ops) <> 'array' THEN
    RAISE EXCEPTION 'apply_table_mutation_transaction: p_ops must be a json array';
  END IF;

  FOR elem IN SELECT jsonb_array_elements(p_ops)
  LOOP
    inbound_ops := array_append(inbound_ops, elem);
  END LOOP;

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
    v_version_is_v2_2_or_v2_3 := (v_meta = '2.2') OR (v_meta = '2.3');
    v_version_is_pre_v2_4 :=
      v_version_is_v0
      OR v_version_is_v1
      OR v_version_is_pre_v2_2
      OR v_version_is_v2_2_or_v2_3;

    IF op_table IS NULL OR op_name = '' THEN
      RAISE EXCEPTION 'apply_table_mutation_transaction: each elem requires table_name and op';
    END IF;

    staged_ops := ARRAY[(row(op_table, op_name, op_record))::public.mutation_op];

    -- Version chain up to v2.2 (v2_3_to_v2_4 applied once on full batch below)
    IF v_version_is_v0 THEN
      v_transformed_ops := public.v0_to_v1(staged_ops, op_client_meta);
      v_transformed_ops := public.v1_to_v2(v_transformed_ops, op_client_meta);
      v_transformed_ops := public.v2_1_to_v2_2(v_transformed_ops, op_client_meta);
      v_logs := v_logs || format(
        '[transform] v0_to_v1 + v1_to_v2 + v2_1_to_v2_2 applied for %s %s\n',
        op_table, op_name
      );
    ELSIF v_version_is_v1 THEN
      v_transformed_ops := public.v1_to_v2(staged_ops, op_client_meta);
      v_transformed_ops := public.v2_1_to_v2_2(v_transformed_ops, op_client_meta);
      v_logs := v_logs || format(
        '[transform] v1_to_v2 + v2_1_to_v2_2 applied for %s %s\n',
        op_table, op_name
      );
    ELSIF v_version_is_pre_v2_2 THEN
      v_transformed_ops := public.v2_1_to_v2_2(staged_ops, op_client_meta);
      v_logs := v_logs || format(
        '[transform] v2_1_to_v2_2 applied for %s %s\n',
        op_table, op_name
      );
    ELSE
      -- v2.2 / v2.3 / v2.4+ passthrough until batch enrich
      v_transformed_ops := staged_ops;
    END IF;

    IF v_version_is_pre_v2_4 THEN
      v_any_pre_v2_4 := true;
    END IF;

    final_ops := final_ops || v_transformed_ops;
  END LOOP;

  -- Batch-aware placement enrich so sibling asset ops are visible
  IF v_any_pre_v2_4 THEN
    final_ops := public.v2_3_to_v2_4(final_ops, p_default_meta);
    v_logs := v_logs || '[transform] v2_3_to_v2_4 applied to batch\n';
  END IF;

  v_op_count := array_length(final_ops, 1);
  v_logs := v_logs || format('[summary] total_ops=%s\n', coalesce(v_op_count, 0));

  BEGIN
    FOR t, o, r IN
      SELECT (x::public.mutation_op).table_name,
             (x::public.mutation_op).op,
             (x::public.mutation_op).record
      FROM unnest(final_ops) AS x
    LOOP
      v_logs := v_logs || format('[exec] %s %s %s\n', o, t, r::text);
      v_failed_op := jsonb_build_object('op', o, 'table', t, 'record', r);
      PERFORM public._apply_single_json_dml(o, t, r);
      v_failed_op := null;
    END LOOP;
    v_status := '2xx';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      v_sqlstate = returned_sqlstate,
      v_error_message = message_text;
    v_error_code := v_sqlstate;

    IF (v_sqlstate ~ '^22...$')
       OR (v_sqlstate ~ '^23...$')
       OR (v_sqlstate = '42501')
       OR (v_sqlstate = '23505') THEN
      v_status := '4xx';
    ELSE
      v_status := '5xx';
    END IF;

    v_logs := v_logs || format(
      '[error] sqlstate=%s message=%s\n',
      v_sqlstate,
      coalesce(v_error_message, '')
    );

    IF v_status = '4xx' THEN
      v_ref_code := lpad((floor(random() * 1000000))::int::text, 6, '0');

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
