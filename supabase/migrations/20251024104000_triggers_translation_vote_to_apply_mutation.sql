-- Migration: Triggers for translation and vote to route legacy writes via apply_table_mutation
-- Purpose:
-- - BEFORE INSERT/UPDATE/DELETE on legacy tables, build a v0 op and call apply_table_mutation
-- - Prevent direct writes by returning NULL (operation handled by RPC)
-- - This ensures consistent server-side migrations and DML

set search_path = public;

create or replace function public.route_translation_via_mutation()
returns trigger
language plpgsql
security invoker
as $$
declare
  v_op text;
  v_record jsonb;
  v_logs text;
begin
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

  -- Call orchestrator with v0 metadata
  select public.apply_table_mutation(v_op, 'translation', v_record, jsonb_build_object('metadata','0.0')) into v_logs;
  -- Optionally log server-side
  perform pg_notify('apply_table_mutation', coalesce(v_logs, ''));

  -- Block the original DML; it has been re-applied through the orchestrator
  if tg_op = 'DELETE' then
    return old;
  else
    return null;
  end if;
end;
$$;

drop trigger if exists before_translation_mutation on public.translation;
create trigger before_translation_mutation
before insert or update or delete on public.translation
for each row execute function public.route_translation_via_mutation();

create or replace function public.route_vote_via_mutation()
returns trigger
language plpgsql
security invoker
as $$
declare
  v_op text;
  v_record jsonb;
  v_logs text;
begin
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

  -- Call orchestrator with v0 metadata
  select public.apply_table_mutation(v_op, 'vote', v_record, jsonb_build_object('metadata','0.0')) into v_logs;
  perform pg_notify('apply_table_mutation', coalesce(v_logs, ''));

  if tg_op = 'DELETE' then
    return old;
  else
    return null;
  end if;
end;
$$;

drop trigger if exists before_vote_mutation on public.vote;
create trigger before_vote_mutation
before insert or update or delete on public.vote
for each row execute function public.route_vote_via_mutation();


