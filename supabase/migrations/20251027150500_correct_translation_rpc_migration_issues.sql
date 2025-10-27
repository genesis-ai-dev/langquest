create or replace function public.route_translation_via_mutation()
returns trigger
language plpgsql
as $$
declare
  v_op text;
  v_record jsonb;
  v_logs text;
begin
  -- Decide op + build record
  if tg_op = 'INSERT' then
    v_op := 'put';
    v_record := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    v_op := 'patch';
    v_record := to_jsonb(new);
  elsif tg_op = 'DELETE' then
    v_op := 'delete';
    v_record := jsonb_build_object('id', old.id::text);
  end if;

  -- Log trigger context
  raise log '[route_translation_via_mutation] fired: tg_op=%, table=%, v_op=%, new.id=%, old.id=%',
    tg_op,
    tg_table_name,
    v_op,
    coalesce(new.id::text, null),
    coalesce(old.id::text, null);

  raise log '[route_translation_via_mutation] record payload: %', v_record::text;

  -- Call orchestrator with v0 metadata
  select public.apply_table_mutation(
    v_op,
    'translation',
    v_record,
    jsonb_build_object('metadata','0.0')
  )
  into v_logs;

  -- Bubble up orchestrator logs for correlation
  raise log '[route_translation_via_mutation] apply_table_mutation logs: %', coalesce(v_logs, '');

  -- Optional async-ish channel notify (you already had this)
  perform pg_notify('apply_table_mutation', coalesce(v_logs, ''));

  -- Block the original DML; it has been re-applied through the orchestrator
  if tg_op = 'DELETE' then
    return old;
  else
    return null;
  end if;
end;
$$;

--------------

create or replace function public.apply_table_mutation(
  p_op text,
  p_table_name text,
  p_record jsonb,
  p_client_meta jsonb default '{}'::jsonb
)
returns text
language plpgsql
as $$
declare
  target_schema_name text := 'public';
  v_logs text := '';
  v_meta text := coalesce(p_client_meta->>'metadata', '');
  v_version_is_v0 boolean := (v_meta = '0') or (v_meta like '0.%');
  ops public.mutation_op[] := ARRAY[(row(p_table_name, lower(p_op), p_record))::public.mutation_op];
  final_ops public.mutation_op[];
  t text; o text; r jsonb;
begin
  -- Validate required inputs
  if p_op is null or p_table_name is null then
    raise exception 'apply_table_mutation: op and table_name are required';
  end if;

  p_op := lower(p_op);

  -- Log inputs
  raise log '[apply_table_mutation] input op=% table=% meta=% record=%',
    p_op, p_table_name, v_meta, p_record::text;

  raise log '[apply_table_mutation] v_is_v0=% full_meta=%',
    v_version_is_v0, v_meta;

  v_logs := v_logs
    || format('[input] op=%s table=%s meta=%s record=%s\n', p_op, p_table_name, v_meta, p_record::text)
    || format('[debug] v_is_v0=%s lower(table)=%s\n',
         case when v_version_is_v0 then 'true' else 'false' end,
         lower(p_table_name)
       );

  -- Versioned transform
  if v_version_is_v0 then
    ops := public.v0_to_v1(ops, p_client_meta);
    v_logs := v_logs || '[transform] v0_to_v1 applied\n';

    raise log '[apply_table_mutation] after v0_to_v1 transform ops=%',
      (select string_agg(format('(%s %s %s)', x.table_name, x.op, x.record::text), ' | ')
       from unnest(ops) x);
  end if;

  final_ops := ops;

  -- Execute each resulting op
  for t, o, r in
    select (x).table_name, (x).op, (x).record
    from unnest(final_ops) as x
  loop
    raise log '[apply_table_mutation] executing op=% table=% record=%', o, t, r::text;

    v_logs := v_logs || format('[exec] %s %s %s\n', o, t, r::text);

    perform public._apply_single_json_dml(o, t, r);
  end loop;

  raise log '[apply_table_mutation] complete. aggregated logs=%', v_logs;

  return v_logs;
end;
$$;

--------------------------------

create or replace function public.v0_to_v1(
  p_ops public.mutation_op[],
  p_meta jsonb
)
returns public.mutation_op[]
language plpgsql
as $$
declare
  out_ops public.mutation_op[] := '{}';
  op public.mutation_op;
  new_ops public.mutation_op[] := '{}';
  v_meta text := coalesce(p_meta->>'metadata', '');
  v_version_is_v0 boolean := (v_meta = '0') or (v_meta like '0.%');
  v_id uuid;
  v_parent_id uuid;
  v_acl_id uuid;
  v_active bool;
begin
  raise log '[v0_to_v1] start meta=% is_v0=% ops_count=%',
    v_meta,
    v_version_is_v0,
    coalesce(array_length(p_ops,1),0);

  foreach op in array p_ops loop
    raise log '[v0_to_v1] inbound op: table=% op=% record=%',
      op.table_name, op.op, op.record::text;

    if v_version_is_v0 and lower(op.table_name) = 'translation' then
      -- Gather IDs / derived fields
      begin v_id := (op.record->>'id')::uuid; exception when others then v_id := gen_random_uuid(); end;
      begin v_parent_id := (op.record->>'asset_id')::uuid; exception when others then v_parent_id := null; end;
      v_acl_id := gen_random_uuid();
      v_active := coalesce((op.record->>'active')::boolean, true);

      raise log '[v0_to_v1] translation map: new_variant_asset_id=% parent_asset_id=% acl_id=% active=%',
        v_id, v_parent_id, v_acl_id, v_active;

      -- 1) asset (variant row)
      new_ops := new_ops || (row(
        'asset',
        case when lower(op.op) = 'delete' then 'delete' else 'put' end,
        jsonb_build_object(
          'id', v_id,
          'source_asset_id', v_parent_id,
          'active', v_active,
          'visible', coalesce((op.record->>'visible')::boolean, true),
          'creator_id', (op.record->>'creator_id')::uuid,
          'download_profiles', coalesce(op.record->'download_profiles', '[]'::jsonb),
          'created_at', op.record->>'created_at',
          'last_updated', op.record->>'last_updated'
        )
      ))::public.mutation_op;

      -- 2) asset_content_link (text, lang binding) for put/patch
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

      raise log '[v0_to_v1] translation produced % ops',
        coalesce(array_length(new_ops,1),0);

      out_ops := out_ops || new_ops;
      new_ops := '{}';

    elsif v_version_is_v0 and lower(op.table_name) = 'vote' then
      -- Legacy vote -> asset_vote
      begin v_id := (op.record->>'id')::uuid; exception when others then v_id := gen_random_uuid(); end;

      raise log '[v0_to_v1] vote map: vote_id=% translation_id=%',
        v_id,
        op.record->>'translation_id';

      new_ops := new_ops || (
        with
        t as (
          select id, asset_id
          from public.translation
          where id = (op.record->>'translation_id')::uuid
        ),
        a_variant as (
          select a.id
          from public.asset a
          join t on a.id = t.id
        )
        select (row(
          'asset_vote',
          case when lower(op.op) = 'delete' then 'delete' else 'put' end,
          (
            op.record
            || jsonb_build_object(
                 'asset_id', coalesce(
                                (select id from a_variant),
                                (select asset_id from t)
                              )::text
               )
            - 'translation_id'
          )
        ))::public.mutation_op
      );

      raise log '[v0_to_v1] vote produced % ops',
        coalesce(array_length(new_ops,1),0);

      out_ops := out_ops || new_ops;
      new_ops := '{}';

    else
      -- passthrough
      out_ops := out_ops || op;
    end if;
  end loop;

  raise log '[v0_to_v1] end out_ops_count=%', coalesce(array_length(out_ops,1),0);

  return out_ops;
end;
$$;

--------------------------------

create or replace function public._apply_single_json_dml(
  p_op text,
  p_table text,
  p_record jsonb
)
returns void
language plpgsql
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
  raise log '[._apply_single_json_dml] start op=% table=% record=%',
    p_op, p_table, p_record::text;

  -- Resolve table regclass
  select (quote_ident('public') || '.' || quote_ident(p_table))::regclass
    into target;

  -- Primary key columns
  select coalesce(array_agg(quote_ident(pg_attribute.attname) order by pg_attribute.attnum), '{}')
    into primary_key_columns
  from pg_index
  join pg_attribute
    on pg_attribute.attrelid = pg_index.indrelid
   and pg_attribute.attnum = any(pg_index.indkey)
  where pg_index.indrelid = target
    and pg_index.indisprimary;

  if array_length(primary_key_columns, 1) is null then
    raise exception 'apply_table_mutation: table % has no primary key; unsupported', p_table;
  end if;

  -- All columns in table
  select array_agg(quote_ident(column_name) order by ordinal_position)
    into all_table_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = p_table;

  -- Which columns are present in the JSON and not PK
  select coalesce(array_agg(column_identifier), '{}')
    into columns_to_update
  from (
    select column_identifier
    from unnest(all_table_columns) as all_columns(column_identifier)
    where p_record ? replace(column_identifier, '"', '')
      and not (column_identifier = any(primary_key_columns))
  ) as selectable_columns;

  -- WHERE clause for PK
  select string_agg(format('%s = input_values.%s', pk, pk), ' and ')
    into where_primary_key_clause_sql
  from unnest(primary_key_columns) as primary_key(pk);

  -- Build dynamic SQL based on op
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

    raise log '[._apply_single_json_dml] PUT upsert SQL=%', dynamic_sql;
    execute dynamic_sql using p_record;

  elsif lower(p_op) in ('patch','update') then
    if array_length(columns_to_update, 1) is null then
      raise log '[._apply_single_json_dml] PATCH no non-PK cols present; skipping update';
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

    raise log '[._apply_single_json_dml] PATCH update SQL=%', dynamic_sql;
    execute dynamic_sql using p_record;

  elsif lower(p_op) = 'delete' then
    dynamic_sql := format(
      'delete from %s as t using (select (jsonb_populate_record(null::%s, $1)).*) as input_values where %s',
      target::text,
      target::text,
      where_primary_key_clause_sql
    );

    raise log '[._apply_single_json_dml] DELETE SQL=%', dynamic_sql;
    execute dynamic_sql using p_record;

  else
    raise exception 'apply_table_mutation: unsupported op %', p_op;
  end if;

  raise log '[._apply_single_json_dml] end op=% table=%', p_op, p_table;
end;
$$;

--------------------------------

-- 1. Add the column
ALTER TABLE public.vote
ADD COLUMN translation_id uuid NULL;

-- 2. Add the foreign key constraint
ALTER TABLE public.vote
ADD CONSTRAINT vote_translation_id_fkey
FOREIGN KEY (translation_id)
REFERENCES public.translation (id)
ON UPDATE CASCADE
ON DELETE SET NULL;

-- 3. Index it for lookups like WHERE translation_id = ANY(...)
CREATE INDEX IF NOT EXISTS vote_translation_id_idx
ON public.vote USING btree (translation_id);

--------------------------------

ALTER TABLE public.asset
ALTER COLUMN order_index DROP NOT NULL;

