-- Migration: Update apply_table_mutation to support client metadata and v1->v2 transform
-- Purpose:
-- - Add p_client_meta jsonb param to RPC used by the app upload path
-- - Introduce a version-aware transform function (ps_transform_v1_to_v2) that can map
--   legacy v1 records (e.g. table "translation") to v2 schema (e.g. "asset_content_link")
-- - Ensure the transformed table/record then flows through the existing generic JSON->SQL DML
--
-- Notes:
-- - Client sends a metadata string in p_client_meta->>'metadata' (e.g., '1.0')
-- - For v1 translation records, we map fields:
--     * target_language_id -> source_language_id
--     * audio -> audio_id
--     * visible -> active (boolean)
--     * creator_id is dropped (no direct target column on asset_content_link)
--   Other fields like id, asset_id, text, download_profiles, timestamps pass-through
-- - This transform applies for all ops (put/patch/delete) as it is key-preserving

set check_function_bodies = off;

-- 1) Normalized op type and pure v1->v2 transform that returns a list of ops
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'mutation_op' and n.nspname = 'public'
  ) then
    create type public.mutation_op as (
      table_name text,
      op text,
      record jsonb
    );
  end if;
end;
$$;

create or replace function public.v1_to_v2(p_ops public.mutation_op[], p_meta jsonb)
returns public.mutation_op[]
language plpgsql
security invoker
set search_path = public
as $$
declare
  out_ops public.mutation_op[] := '{}';
  op public.mutation_op;
  new_ops public.mutation_op[] := '{}';
  v_meta text := coalesce(p_meta->>'metadata', '');
  v_version_is_v1 boolean := (v_meta = '1') or (v_meta like '1.%');
  v_id uuid;
  v_parent_id uuid;
  v_acl_id uuid;
  v_active bool;
begin
  foreach op in array p_ops loop
    if v_version_is_v1 and lower(op.table_name) = 'translation' then
      begin v_id := (op.record->>'id')::uuid; exception when others then v_id := gen_random_uuid(); end;
      begin v_parent_id := (op.record->>'asset_id')::uuid; exception when others then v_parent_id := null; end;
      v_acl_id := gen_random_uuid();
      v_active := coalesce((op.record->>'active')::boolean, coalesce((op.record->>'visible')::int,1)=1);

      -- 1) asset variant
      new_ops := new_ops || (row(
        'asset',
        case when lower(op.op) = 'delete' then 'delete' else 'put' end,
        jsonb_build_object(
          'id', v_id,
          'source_asset_id', v_parent_id,
          'active', v_active,
          'visible', coalesce((op.record->>'visible')::int,1)=1,
          'creator_id', (op.record->>'creator_id')::uuid,
          'download_profiles', coalesce(op.record->'download_profiles', '[]'::jsonb),
          'created_at', op.record->>'created_at',
          'last_updated', op.record->>'last_updated'
        )
      ))::public.mutation_op;

      -- 2) asset_content_link only for put/patch
      if lower(op.op) in ('put','patch','update') then
        new_ops := new_ops || (row(
          'asset_content_link',
          'put',
          (
            op.record
            || jsonb_build_object(
                 'id', v_acl_id::text,
                 'asset_id', v_id::text,
                 'source_language_id', op.record->>'target_language_id'
               )
            - 'target_language_id'
            - 'asset_id'
            - 'creator_id'
            - 'visible'
          )
        ))::public.mutation_op;
      end if;

      out_ops := out_ops || new_ops;
      new_ops := '{}';
    else
      out_ops := out_ops || op;
    end if;
  end loop;
  return out_ops;
end;
$$;

-- Replace RPC to accept client metadata and run transform before generic DML
create or replace function public.apply_table_mutation(
  p_op text,
  p_table_name text,
  p_record jsonb,
  p_client_meta jsonb default '{}'::jsonb
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_schema_name text := 'public';
  v_logs text := '';
  v_meta text := coalesce(p_client_meta->>'metadata', '');
  v_version_is_v1 boolean := (v_meta = '1') or (v_meta like '1.%');
  ops public.mutation_op[] := ARRAY[(row(p_table_name, lower(p_op), p_record))::public.mutation_op];
  final_ops public.mutation_op[];
  t text; o text; r jsonb;
begin
  -- Validate required inputs
  if p_op is null or p_table_name is null then
    raise exception 'apply_table_mutation: op and table_name are required';
  end if;

  p_op := lower(p_op);

  -- Log input
  v_logs := v_logs || format('[input] op=%s table=%s meta=%s record=%s\n', p_op, p_table_name, v_meta, p_record::text);
  v_logs := v_logs || format('[debug] v_is_v1=%s lower(table)=%s\n', case when v_version_is_v1 then 'true' else 'false' end, lower(p_table_name));

  -- Chain transforms based on client version
  if v_version_is_v1 then
    ops := public.v1_to_v2(ops, p_client_meta);
    v_logs := v_logs || '[transform] v1_to_v2 applied\n';
  end if;

  final_ops := ops;

  -- Execute each resulting op
  foreach t, o, r in array (
    select (x).table_name, (x).op, (x).record from unnest(final_ops) as x
  ) loop
    v_logs := v_logs || format('[exec] %s %s %s\n', o, t, r::text);
    perform public._apply_single_json_dml(o, t, r);
  end loop;

  return v_logs;
end;
$$;

grant execute on function public.apply_table_mutation(text, text, jsonb, jsonb) to authenticated;

-- 2) Generic DML helper used by the mutator
create or replace function public._apply_single_json_dml(p_op text, p_table text, p_record jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  target regclass;
  primary_key_columns text[];
  all_table_columns text[];
  columns_to_update text[];
  where_primary_key_clause_sql text;
  update_set_assignments_sql text;
  dynamic_sql text;
begin
  select (quote_ident('public') || '.' || quote_ident(p_table))::regclass into target;

  select coalesce(array_agg(quote_ident(pg_attribute.attname) order by pg_attribute.attnum), '{}')
    into primary_key_columns
  from pg_index
  join pg_attribute on pg_attribute.attrelid = pg_index.indrelid
                   and pg_attribute.attnum = any(pg_index.indkey)
  where pg_index.indrelid = target
    and pg_index.indisprimary;

  if array_length(primary_key_columns, 1) is null then
    raise exception 'apply_table_mutation: table % has no primary key; unsupported', p_table;
  end if;

  select array_agg(quote_ident(column_name) order by ordinal_position)
    into all_table_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = p_table;

  select coalesce(array_agg(column_identifier), '{}')
    into columns_to_update
  from (
    select column_identifier
    from unnest(all_table_columns) as all_columns(column_identifier)
    where p_record ? replace(column_identifier, '"', '')
      and not (column_identifier = any(primary_key_columns))
  ) as selectable_columns;

  select string_agg(format('%s = input_values.%s', pk, pk), ' and ')
    into where_primary_key_clause_sql
  from unnest(primary_key_columns) as primary_key(pk);

  if lower(p_op) = 'put' then
    if array_length(columns_to_update, 1) is not null then
      select string_agg(format('%s = excluded.%s', column_identifier, column_identifier), ', ')
        into update_set_assignments_sql
      from unnest(columns_to_update) as update_columns(column_identifier);

      dynamic_sql := format(
        'insert into %s select (jsonb_populate_record(null::%s, $1)).* on conflict (%s) do update set %s',
        target::text,
        target::text,
        array_to_string(primary_key_columns, ', '),
        update_set_assignments_sql
      );
    else
      dynamic_sql := format(
        'insert into %s select (jsonb_populate_record(null::%s, $1)).* on conflict (%s) do nothing',
        target::text,
        target::text,
        array_to_string(primary_key_columns, ', ')
      );
    end if;
    execute dynamic_sql using p_record;
  elsif lower(p_op) in ('patch','update') then
    if array_length(columns_to_update, 1) is null then
      return;
    end if;
    select string_agg(format('%s = input_values.%s', column_identifier, column_identifier), ', ')
      into update_set_assignments_sql
    from unnest(columns_to_update) as update_columns(column_identifier);
    dynamic_sql := format(
      'update %s as t set %s from (select (jsonb_populate_record(null::%s, $1)).*) as input_values where %s',
      target::text,
      update_set_assignments_sql,
      target::text,
      where_primary_key_clause_sql
    );
    execute dynamic_sql using p_record;
  elsif lower(p_op) = 'delete' then
    dynamic_sql := format(
      'delete from %s as t using (select (jsonb_populate_record(null::%s, $1)).*) as input_values where %s',
      target::text,
      target::text,
      where_primary_key_clause_sql
    );
    execute dynamic_sql using p_record;
  else
    raise exception 'apply_table_mutation: unsupported op %', p_op;
  end if;
end;
$$;


