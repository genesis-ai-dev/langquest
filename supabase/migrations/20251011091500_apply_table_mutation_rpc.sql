-- Redefine RPC with search_path set to public so triggers with unqualified table
-- references can resolve relations like quest_asset_link.

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
  v_schema text := 'public';
  v_rel regclass;
  v_pk_cols text[];
  v_all_cols text[];
  v_update_cols text[];
  v_set_assignments text;
  v_where_pk_clause text;
  v_sql text;
begin
  if p_op is null or p_table_name is null then
    raise exception 'apply_table_mutation: op and table_name are required';
  end if;

  p_op := lower(p_op);

  begin
    select (quote_ident(v_schema) || '.' || quote_ident(p_table_name))::regclass into v_rel;
  exception when undefined_table then
    raise exception 'apply_table_mutation: table %.% does not exist', v_schema, p_table_name;
  end;

  select coalesce(array_agg(quote_ident(a.attname) order by a.attnum), '{}')
    into v_pk_cols
  from pg_index i
  join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
  where i.indrelid = v_rel and i.indisprimary;

  if array_length(v_pk_cols, 1) is null then
    raise exception 'apply_table_mutation: table % has no primary key; unsupported', p_table_name;
  end if;

  select array_agg(quote_ident(column_name) order by ordinal_position)
    into v_all_cols
  from information_schema.columns
  where table_schema = v_schema and table_name = p_table_name;

  select coalesce(array_agg(c), '{}')
    into v_update_cols
  from (
    select c
    from unnest(v_all_cols) as t(c)
    where p_record ? replace(c, '"', '')
      and not (c = any(v_pk_cols))
  ) s;

  select string_agg(format('%s = r.%s', pk, pk), ' and ')
    into v_where_pk_clause
  from unnest(v_pk_cols) as t(pk);

  if p_op in ('put') then
    if array_length(v_update_cols, 1) is not null then
      select string_agg(format('%s = excluded.%s', c, c), ', ') into v_set_assignments
      from unnest(v_update_cols) as t(c);

      v_sql := format(
        'insert into %s select (jsonb_populate_record(null::%s, $1)).* on conflict (%s) do update set %s',
        v_rel::text,
        v_rel::text,
        array_to_string(v_pk_cols, ', '),
        v_set_assignments
      );
    else
      v_sql := format(
        'insert into %s select (jsonb_populate_record(null::%s, $1)).* on conflict (%s) do nothing',
        v_rel::text,
        v_rel::text,
        array_to_string(v_pk_cols, ', ')
      );
    end if;

    execute v_sql using p_record;
    return;
  elsif p_op in ('patch', 'update') then
    if array_length(v_update_cols, 1) is null then
      return;
    end if;

    select string_agg(format('%s = r.%s', c, c), ', ') into v_set_assignments
    from unnest(v_update_cols) as t(c);

    v_sql := format(
      'update %s t set %s from (select (jsonb_populate_record(null::%s, $1)).*) as r where %s',
      v_rel::text,
      v_set_assignments,
      v_rel::text,
      v_where_pk_clause
    );
    execute v_sql using p_record;
    return;
  elsif p_op = 'delete' then
    v_sql := format(
      'delete from %s t using (select (jsonb_populate_record(null::%s, $1)).*) as r where %s',
      v_rel::text,
      v_rel::text,
      v_where_pk_clause
    );
    execute v_sql using p_record;
    return;
  else
    raise exception 'apply_table_mutation: unsupported op %', p_op;
  end if;
end;
$$;

grant execute on function public.apply_table_mutation(text, text, jsonb) to authenticated;


