-- Redefine RPC with search_path set to public so triggers with unqualified table
-- references can resolve relations like quest_asset_link.
--
-- Naming notes:
-- - p_ prefix = function parameter (kept to preserve RPC API used by clients)
-- - v_ prefix = local variable (replaced below with explicit/descriptive names)

create or replace function public.apply_table_mutation(
  p_op text,
  p_table_name text,
  p_record jsonb
)
returns void
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
begin
  -- Validate required inputs
  if p_op is null or p_table_name is null then
    raise exception 'apply_table_mutation: op and table_name are required';
  end if;

  p_op := lower(p_op);

  -- Resolve target relation (schema-qualified table) from provided name (e.g., target_relation = "public.asset")
  begin
    select (quote_ident(target_schema_name) || '.' || quote_ident(p_table_name))::regclass
      into target_relation;
  exception when undefined_table then
    raise exception 'apply_table_mutation: table %.% does not exist', target_schema_name, p_table_name;
  end;

  -- Identify primary key columns for the target table (e.g., primary_key_columns = "{id}")
  -- Or, id target_relation is "public.quest_asset_link", primary_key_columns = "{quest_id, asset_id}"
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
  -- (e.g., all_table_columns = "{id, name, description, created_at, updated_at}")
  select array_agg(quote_ident(column_name) order by ordinal_position)
    into all_table_columns
  from information_schema.columns
  where table_schema = target_schema_name
    and table_name = p_table_name;

  -- Determine which columns appear in the input JSON (excluding primary key columns) 
  -- (e.g., columns_to_update = "{name, description}")
  -- Note: jsonb_populate_record will coerce JSON into the table's row type later
  select coalesce(array_agg(column_identifier), '{}')
    into columns_to_update
  from (
    select column_identifier
    from unnest(all_table_columns) as all_columns(column_identifier)
    where p_record ? replace(column_identifier, '"', '')
      and not (column_identifier = any(primary_key_columns))
  ) as selectable_columns;

  -- Build WHERE clause on primary key(s) using values from the JSON-derived row 
  -- (e.g., where_primary_key_clause_sql = "quest_id = input_values.quest_id and asset_id = input_values.asset_id")
  select string_agg(format('%s = input_values.%s', pk, pk), ' and ')
    into where_primary_key_clause_sql
  from unnest(primary_key_columns) as primary_key(pk);

  if p_op in ('put') then
    -- PUT (upsert): insert row built from JSON, updating non-PK fields if present 
    -- (e.g., insert into public.asset (name, description) values ('Test Asset', 'This is a test asset') on conflict (id) do update set name = excluded.name, description = excluded.description)
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
      -- If no non-PK fields are present in JSON, do nothing on conflict
      dynamic_sql := format(
        'insert into %s select (jsonb_populate_record(null::%s, $1)).* on conflict (%s) do nothing',
        target_relation::text,
        target_relation::text,
        array_to_string(primary_key_columns, ', ')
      );
    end if;

    execute dynamic_sql using p_record;
    return;
  elsif p_op in ('patch', 'update') then
    -- PATCH/UPDATE: update only the columns provided in the JSON 
    -- (e.g., update public.asset set name = 'Test Asset', description = 'This is a test asset' where id = '123')
    if array_length(columns_to_update, 1) is null then
      return;
    end if;

    select string_agg(format('%s = input_values.%s', column_identifier, column_identifier), ', ')
      into update_set_assignments_sql
    from unnest(columns_to_update) as update_columns(column_identifier);

    -- Compose UPDATE that joins current table rows to JSON-derived row values 
    -- (e.g., update public.asset set name = 'Test Asset', description = 'This is a test asset' where id = '123')
    dynamic_sql := format(
      'update %s as t set %s from (select (jsonb_populate_record(null::%s, $1)).*) as input_values where %s',
      target_relation::text,
      update_set_assignments_sql,
      target_relation::text,
      where_primary_key_clause_sql
    );
    execute dynamic_sql using p_record;
    return;
  elsif p_op = 'delete' then
    -- DELETE: delete rows whose primary key(s) match the JSON-derived row values 
    -- (e.g., delete from public.asset where id = '123')
    dynamic_sql := format(
      'delete from %s as t using (select (jsonb_populate_record(null::%s, $1)).*) as input_values where %s',
      target_relation::text,
      target_relation::text,
      where_primary_key_clause_sql
    );
    execute dynamic_sql using p_record;
    return;
  else
    raise exception 'apply_table_mutation: unsupported op %', p_op;
  end if;
end;
$$;

grant execute on function public.apply_table_mutation(text, text, jsonb) to authenticated;


