-- migration: transactional upload rpc and inbox table
-- purpose: add a new rpc to accept and execute a transaction of ops atomically,
--          return structured json status, and on client (4xx) errors store ops
--          in an upload_inbox table for later inspection.
-- affects: public.upload_inbox table, public.apply_table_mutation_transaction function
-- notes:
--  - function runs with security invoker and sets search_path to ''
--  - v0 transforms reuse existing public.v0_to_v1; future v1_to_v2 can be added later

-- create table to store client-error ops
create table if not exists public.upload_inbox (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null, -- raw json of the op as received (one row per op)
  logs text not null, -- detailed logs of what went wrong
  error_code text not null, -- exact sqlstate (e.g., 23505)
  ref_code text not null, -- shared 6-digit code for all ops in a failed transaction
  created_at timestamptz not null default now(),
  last_updated timestamptz not null default now()
);

comment on table public.upload_inbox is 'Inbox for upload ops that failed with client/request (4xx) errors during transactional RPC execution.';

-- keep timestamps fresh on update
create or replace function public._upload_inbox_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.last_updated := now();
  return new;
end;
$$;

drop trigger if exists upload_inbox_set_updated_at on public.upload_inbox;
create trigger upload_inbox_set_updated_at
before update on public.upload_inbox
for each row
execute function public._upload_inbox_set_updated_at();

-- rls
alter table public.upload_inbox enable row level security;

-- allow authenticated inserts (service-role will bypass rls as usual)
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'upload_inbox' and policyname = 'Allow authenticated insert'
  ) then
    create policy "Allow authenticated insert"
    on public.upload_inbox
    for insert
    to authenticated
    with check ( true );
  end if;
end $$;

-- helpful index for triage by reference code
create index if not exists upload_inbox_ref_code_idx on public.upload_inbox (ref_code);

-- transactional rpc
create or replace function public.apply_table_mutation_transaction(
  p_ops jsonb,
  p_default_meta jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
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
  -- helpers
  v_meta text;
  elem jsonb;
  op_table text;
  op_name text;
  op_record jsonb;
  op_client_meta jsonb;
  v_major int;
  v_start_major int;
  v_funcname text;
  v_exists boolean;
  v_missing_first boolean := false;
  cur_ops public.mutation_op[];
begin
  if p_ops is null or jsonb_typeof(p_ops) <> 'array' then
    raise exception 'apply_table_mutation_transaction: p_ops must be a json array';
  end if;

  -- stage inbound ops in order
  for elem in select jsonb_array_elements(p_ops)
  loop
    inbound_ops := array_append(inbound_ops, elem);
  end loop;

  -- transform/build final ops list
  foreach elem in array inbound_ops
  loop
    op_table := coalesce(elem->>'table_name', elem->>'table');
    op_name := lower(coalesce(elem->>'op', ''));
    op_record := coalesce(elem->'record', '{}'::jsonb);
    op_client_meta := coalesce(elem->'client_meta', p_default_meta);
    v_meta := coalesce(op_client_meta->>'metadata', '');

    if op_table is null or op_name = '' then
      raise exception 'apply_table_mutation_transaction: each elem requires table_name and op';
    end if;

    -- parse major version from metadata (default to -1 if not numeric)
    begin
      v_major := (regexp_matches(v_meta, '^(\\d+)'))[1]::int;
    exception when others then
      v_major := -1;
    end;
    v_start_major := v_major;

    -- start with the single op
    staged_ops := array_append(
      staged_ops,
      (row(op_table, op_name, op_record))::public.mutation_op
    );
    cur_ops := ARRAY[(row(op_table, op_name, op_record))::public.mutation_op];

    -- dynamically run vN_to_(N+1) while it exists
    loop
      if v_major < 0 then
        exit; -- unknown/empty metadata → passthrough
      end if;

      v_funcname := format('public.v%1$s_to_%2$s', v_major, v_major + 1);

      -- check existence of function public.vN_to_(N+1)(public.mutation_op[], jsonb)
      select exists (
        select 1
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname = format('v%1$s_to_%2$s', v_major, v_major + 1)
          and p.prorettype = 'public.mutation_op[]'::regtype
          and p.pronargs = 2
          and p.proargtypes[0] = 'public.mutation_op[]'::regtype::oid
          and p.proargtypes[1] = 'jsonb'::regtype::oid
      ) into v_exists;

      if not v_exists then
        -- if we’re at the first link and it’s missing, treat as client/request error later
        if v_major = v_start_major then
          v_missing_first := true;
        end if;
        exit;
      end if;

      v_logs := v_logs || format('[transform] %s applied for %s %s\n', v_funcname, op_table, op_name);

      execute format('select %s($1, $2)', v_funcname)
        into cur_ops
        using cur_ops, op_client_meta;

      v_major := v_major + 1;
    end loop;

    final_ops := final_ops || cur_ops;
  end loop;

  -- if any op required a first-hop transform that doesn’t exist, classify as 4xx and persist
  if v_missing_first then
    v_status := '4xx';
    v_error_code := '42883'; -- undefined_function
    v_logs := v_logs || '[error] missing first transform function for at least one op\n';
    v_ref_code := lpad((floor(random()*1000000))::int::text, 6, '0');

    foreach elem in array inbound_ops loop
      insert into public.upload_inbox (data, logs, error_code, ref_code)
      values (elem, v_logs, v_error_code, v_ref_code);
    end loop;

    return jsonb_build_object(
      'status', v_status,
      'logs', v_logs,
      'ref_code', v_ref_code,
      'error_code', v_error_code
    );
  end if;

  -- execute in a sub-transaction to allow catching and classifying errors
  begin
    for t, o, r in
      select (x).table_name, (x).op, (x).record from unnest(final_ops) as x
    loop
      v_logs := v_logs || format('[exec] %s %s %s\n', o, t, r::text);
      perform public._apply_single_json_dml(o, t, r);
    end loop;
    v_status := '2xx';
  exception when others then
    get stacked diagnostics v_sqlstate = returned_sqlstate;
    v_error_code := v_sqlstate;

    -- classify
    if (v_sqlstate ~ '^22...$') or (v_sqlstate ~ '^23...$') or (v_sqlstate = '42501') or (v_sqlstate = '23505') then
      v_status := '4xx';
    else
      v_status := '5xx';
    end if;

    v_logs := v_logs || format('[error] sqlstate=%s\n', v_sqlstate);

    if v_status = '4xx' then
      -- generate 6-digit ref code
      v_ref_code := lpad((floor(random()*1000000))::int::text, 6, '0');

      -- persist each ORIGINAL inbound op (not transformed) to inbox
      foreach elem in array inbound_ops
      loop
        insert into public.upload_inbox (data, logs, error_code, ref_code)
        values (elem, v_logs, v_error_code, v_ref_code);
      end loop;
    end if;
  end;

  return jsonb_build_object(
    'status', v_status,
    'logs', v_logs,
    'ref_code', v_ref_code,
    'error_code', v_error_code
  );
end;
$$;


