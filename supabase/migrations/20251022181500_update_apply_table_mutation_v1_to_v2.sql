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

-- Version-aware transformer: returns the (possibly) updated table name and record
create or replace function public.ps_transform_v1_to_v2(
  p_table_name text,
  p_op text,
  p_record jsonb,
  p_client_meta jsonb
)
returns table (
  out_table_name text,
  out_record jsonb
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_meta text := coalesce(p_client_meta->>'metadata', '');
  v_version_is_v1 boolean := (v_meta = '1') or (v_meta like '1.%');
  v_tmp jsonb;
  v_active_bool boolean;
  v_id uuid;
  v_parent_id uuid;
  v_name text;
  v_images text[]; -- images are file paths; use text[] to match column type
  v_visible_bool boolean;
  v_download_profiles uuid[];
  v_created_at timestamptz;
  v_last_updated timestamptz;
  v_acl_id uuid;
begin
  out_table_name := p_table_name;
  out_record := p_record;

  if v_version_is_v1 and lower(p_table_name) = 'translation' then
    -- Extract base identifiers and values from translation payload
    begin v_id := (p_record->>'id')::uuid; exception when others then v_id := null; end;
    begin v_parent_id := (p_record->>'asset_id')::uuid; exception when others then v_parent_id := null; end;

    -- Visible / Active booleans (visible defaults to true)
    begin v_visible_bool := coalesce((p_record->>'visible')::int, 1) = 1; exception when others then v_visible_bool := true; end;
    -- active: prefer explicit active, else derive from visible
    begin v_active_bool := (p_record->>'active')::boolean; exception when others then v_active_bool := v_visible_bool; end;

    -- Timestamps (best-effort)
    begin v_created_at := (p_record->>'created_at')::timestamptz; exception when others then v_created_at := now(); end;
    begin v_last_updated := (p_record->>'last_updated')::timestamptz; exception when others then v_last_updated := now(); end;

    -- Download profiles (uuid[])
    select coalesce(array_agg((x)::uuid), '{}')
      into v_download_profiles
    from jsonb_array_elements_text(coalesce(p_record->'download_profiles', '[]'::jsonb)) as t(x);

    -- Derive name/images from parent asset if present
    select
      case when a.name is not null then a.name || ' (variant)'
           else 'Translation ' || left(coalesce(v_id::text, '00000000'), 8) end,
      a.images
      into v_name, v_images
    from public.asset a
    where a.id = v_parent_id;

    -- Generate a fresh id for the new asset_content_link record
    v_acl_id := gen_random_uuid();

    -- Upsert new/variant asset that represents the translation
    insert into public.asset (
      id,
      created_at,
      last_updated,
      name,
      images,
      active,
      creator_id,
      visible,
      download_profiles,
      source_asset_id
    )
    values (
      v_id,
      v_created_at,
      v_last_updated,
      v_name,
      v_images,
      v_active_bool,
      (p_record->>'creator_id')::uuid,
      v_visible_bool,
      v_download_profiles,
      v_parent_id
    )
    on conflict (id) do update set
      last_updated      = excluded.last_updated,
      name              = excluded.name,
      images            = excluded.images,
      active            = excluded.active,
      visible           = excluded.visible,
      download_profiles = excluded.download_profiles,
      source_asset_id   = excluded.source_asset_id;

    -- Now remap to asset_content_link for generic DML
    out_table_name := 'asset_content_link';
    v_tmp := p_record;

    -- Set asset_id to the newly upserted asset id (the translation id)
    v_tmp := (v_tmp - 'asset_id') || jsonb_build_object('asset_id', coalesce(v_id::text, null));
    -- Ensure ACL id is set to a fresh UUID
    v_tmp := (v_tmp - 'id') || jsonb_build_object('id', v_acl_id::text);

    -- target_language_id -> source_language_id
    if p_record ? 'target_language_id' then
      v_tmp := (v_tmp - 'target_language_id') || jsonb_build_object('source_language_id', p_record->>'target_language_id');
    end if;

    -- audio -> audio_id
    if p_record ? 'audio' then
      v_tmp := (v_tmp - 'audio') || jsonb_build_object('audio_id', p_record->>'audio');
    end if;

    -- visible -> active (only if active not provided)
    if not (p_record ? 'active') then
      v_tmp := (v_tmp - 'visible') || jsonb_build_object('active', v_active_bool);
    else
      -- remove visible if present to avoid column mismatch
      if p_record ? 'visible' then
        v_tmp := (v_tmp - 'visible');
      end if;
    end if;

    -- Remove creator_id (no equivalent on asset_content_link)
    if p_record ? 'creator_id' then
      v_tmp := (v_tmp - 'creator_id');
    end if;

    out_record := v_tmp;

    -- If DELETE op on translation, switch delete to asset by id (key-preserving)
    if lower(p_op) = 'delete' then
      out_table_name := 'asset';
      out_record := jsonb_build_object('id', coalesce(v_id::text, null));
    end if;
  end if;

  return next;
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
  target_relation regclass; -- schema-qualified table as regclass
  primary_key_columns text[];
  all_table_columns text[];
  columns_to_update text[];
  update_set_assignments_sql text;
  where_primary_key_clause_sql text;
  dynamic_sql text;
  v_new_table text;
  v_new_record jsonb;
  v_logs text := '';
  v_meta text := coalesce(p_client_meta->>'metadata', '');
  v_version_is_v1 boolean := (v_meta = '1') or (v_meta like '1.%');
begin
  -- Validate required inputs
  if p_op is null or p_table_name is null then
    raise exception 'apply_table_mutation: op and table_name are required';
  end if;

  p_op := lower(p_op);

  -- Log input
  v_logs := v_logs || format('[input] op=%s table=%s meta=%s record=%s\n', p_op, p_table_name, v_meta, p_record::text);
  v_logs := v_logs || format('[debug] v_is_v1=%s lower(table)=%s\n', case when v_version_is_v1 then 'true' else 'false' end, lower(p_table_name));

  -- Apply version-aware transform (table and record may be changed)
  select out_table_name, out_record
    into v_new_table, v_new_record
  from public.ps_transform_v1_to_v2(p_table_name, p_op, p_record, p_client_meta);

  v_logs := v_logs || format('[transform] out_table=%s out_record=%s\n', v_new_table, v_new_record::text);

  p_table_name := v_new_table;
  p_record := v_new_record;

  -- Resolve target relation (schema-qualified table) from provided name
  begin
    select (quote_ident(target_schema_name) || '.' || quote_ident(p_table_name))::regclass
      into target_relation;
  exception when undefined_table then
    raise exception 'apply_table_mutation: table %.% does not exist', target_schema_name, p_table_name;
  end;

  -- Identify primary key columns for the target table
  select coalesce(array_agg(quote_ident(pg_attribute.attname) order by pg_attribute.attnum), '{}')
    into primary_key_columns
  from pg_index
  join pg_attribute on pg_attribute.attrelid = pg_index.indrelid
                   and pg_attribute.attnum = any(pg_index.indkey)
  where pg_index.indrelid = target_relation
    and pg_index.indisprimary;

  if array_length(primary_key_columns, 1) is null then
    raise exception 'apply_table_mutation: table % has no primary key; unsupported', p_table_name;
  end if;

  -- Collect all column names for the target table
  select array_agg(quote_ident(column_name) order by ordinal_position)
    into all_table_columns
  from information_schema.columns
  where table_schema = target_schema_name
    and table_name = p_table_name;

  -- Determine which columns appear in the input JSON (excluding PK columns)
  select coalesce(array_agg(column_identifier), '{}')
    into columns_to_update
  from (
    select column_identifier
    from unnest(all_table_columns) as all_columns(column_identifier)
    where p_record ? replace(column_identifier, '"', '')
      and not (column_identifier = any(primary_key_columns))
  ) as selectable_columns;

  v_logs := v_logs || format('[columns] pk=%s all=%s update=%s\n', array_to_string(primary_key_columns, ','), array_to_string(all_table_columns, ','), array_to_string(columns_to_update, ','));

  -- Build WHERE clause on primary key(s)
  select string_agg(format('%s = input_values.%s', pk, pk), ' and ')
    into where_primary_key_clause_sql
  from unnest(primary_key_columns) as primary_key(pk);

  if p_op in ('put') then
    if array_length(columns_to_update, 1) is not null then
      select string_agg(format('%s = excluded.%s', column_identifier, column_identifier), ', ')
        into update_set_assignments_sql
      from unnest(columns_to_update) as update_columns(column_identifier);

      dynamic_sql := format(
        'insert into %s select (jsonb_populate_record(null::%s, $1)).* on conflict (%s) do update set %s',
        target_relation::text,
        target_relation::text,
        array_to_string(primary_key_columns, ', '),
        update_set_assignments_sql
      );
    else
      dynamic_sql := format(
        'insert into %s select (jsonb_populate_record(null::%s, $1)).* on conflict (%s) do nothing',
        target_relation::text,
        target_relation::text,
        array_to_string(primary_key_columns, ', ')
      );
    end if;

    v_logs := v_logs || format('[sql-put] %s\n', dynamic_sql);
    execute dynamic_sql using p_record;
    v_logs := v_logs || '[result] put ok\n';
    return v_logs;
  elsif p_op in ('patch', 'update') then
    if array_length(columns_to_update, 1) is null then
      v_logs := v_logs || '[result] patch no columns to update\n';
      return v_logs;
    end if;

    select string_agg(format('%s = input_values.%s', column_identifier, column_identifier), ', ')
      into update_set_assignments_sql
    from unnest(columns_to_update) as update_columns(column_identifier);

    dynamic_sql := format(
      'update %s as t set %s from (select (jsonb_populate_record(null::%s, $1)).*) as input_values where %s',
      target_relation::text,
      update_set_assignments_sql,
      target_relation::text,
      where_primary_key_clause_sql
    );
    v_logs := v_logs || format('[sql-patch] %s\n', dynamic_sql);
    execute dynamic_sql using p_record;
    v_logs := v_logs || '[result] patch ok\n';
    return v_logs;
  elsif p_op = 'delete' then
    dynamic_sql := format(
      'delete from %s as t using (select (jsonb_populate_record(null::%s, $1)).*) as input_values where %s',
      target_relation::text,
      target_relation::text,
      where_primary_key_clause_sql
    );
    v_logs := v_logs || format('[sql-delete] %s\n', dynamic_sql);
    execute dynamic_sql using p_record;
    v_logs := v_logs || '[result] delete ok\n';
    return v_logs;
  else
    raise exception 'apply_table_mutation: unsupported op %', p_op;
  end if;
end;
$$;

grant execute on function public.apply_table_mutation(text, text, jsonb, jsonb) to authenticated;


