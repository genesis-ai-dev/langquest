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
set search_path = 'public'
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
set search_path = 'public'
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
    v_meta := coalesce(op_client_meta->>'schema_version', '0');

    if op_table is null or op_name = '' then
      raise exception 'apply_table_mutation_transaction: each elem requires table_name and op';
    end if;

    -- build a single mutation_op
    staged_ops := array_append(
      staged_ops,
      (row(op_table, op_name, op_record))::public.mutation_op
    );

    -- v0 transform only when indicated by metadata
    if (v_meta = '0') or (v_meta like '0.%') then
      -- reuse existing v0_to_v1 on a single-element array
      final_ops := final_ops || public.v0_to_v1(ARRAY[(row(op_table, op_name, op_record))::public.mutation_op], op_client_meta);
      v_logs := v_logs || format('[transform] v0_to_v1 applied for %s %s\n', op_table, op_name);
    else
      final_ops := final_ops || (row(op_table, op_name, op_record))::public.mutation_op;
    end if;
  end loop;

  v_op_count := array_length(final_ops, 1);
  v_logs := v_logs || format('[summary] total_ops=%s\n', coalesce(v_op_count, 0));

  -- execute in a sub-transaction to allow catching and classifying errors
  begin
    for t, o, r in
      select (x::public.mutation_op).table_name, (x::public.mutation_op).op, (x::public.mutation_op).record 
      from unnest(final_ops) as x
    loop
      v_logs := v_logs || format('[exec] %s %s %s\n', o, t, r::text);
      v_failed_op := jsonb_build_object('op', o, 'table', t, 'record', r);
      perform public._apply_single_json_dml(o, t, r);
      v_failed_op := null; -- clear on success
    end loop;
    v_status := '2xx';
  exception when others then
    get stacked diagnostics 
      v_sqlstate = returned_sqlstate,
      v_error_message = message_text;
    v_error_code := v_sqlstate;

    -- classify
    if (v_sqlstate ~ '^22...$') or (v_sqlstate ~ '^23...$') or (v_sqlstate = '42501') or (v_sqlstate = '23505') then
      v_status := '4xx';
    else
      v_status := '5xx';
    end if;

    v_logs := v_logs || format('[error] sqlstate=%s message=%s\n', v_sqlstate, coalesce(v_error_message, ''));

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
    'error_code', v_error_code,
    'error_message', v_error_message,
    'failed_op', v_failed_op,
    'op_count', v_op_count,
    'ops_summary', (
      select jsonb_agg(
        jsonb_build_object(
          'table', op_elem->>'table_name',
          'op', op_elem->>'op',
          'has_record', (op_elem ? 'record')
        )
      )
      from jsonb_array_elements(p_ops) as op_elem
    )
  );
end;
$$;


