-- Migration: Triggers for translation and vote to route legacy writes via apply_table_mutation
-- Purpose:
-- - BEFORE INSERT/UPDATE/DELETE on legacy tables, build a v0 op and call apply_table_mutation
-- - Prevent direct writes by returning NULL (operation handled by RPC)
-- - This ensures consistent server-side migrations and DML

set search_path = public;

-- legacy translation table and related triggers/rls (for routing via apply_table_mutation)
-- creates the legacy table shape used by clients and hooks it into existing orchestration
-- this is intentionally minimal and routes writes via BEFORE triggers below in this file

create table if not exists public.translation (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  last_updated timestamp with time zone not null default now(),
  asset_id uuid not null,
  target_language_id uuid not null,
  text text null,
  audio text null,
  creator_id uuid null,
  active boolean not null default true,
  visible boolean null default true,
  download_profiles uuid[] null,
  ingest_batch_id uuid null,
  constraint translations_pkey primary key (id),
  constraint translations_asset_id_fkey foreign key (asset_id) references public.asset (id) on delete cascade,
  constraint translations_creator_id_fkey foreign key (creator_id) references public.profile (id) on delete set null,
  constraint translations_target_language_id_fkey foreign key (target_language_id) references public.language (id) on delete restrict
);

ALTER PUBLICATION "powersync" ADD TABLE ONLY "public"."translation";

create index if not exists idx_translation_download_profiles on public.translation using gin (download_profiles);

-- functions used by translation triggers
create or replace function public.trigger_translation_refresh_languages_del()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_setting('app.clone_mode', true) = 'on' then
    return old;
  end if;
  perform public.refresh_languages_for_asset(old.asset_id);
  return old;
end;
$$;

create or replace function public.trigger_translation_refresh_languages_ins_upd()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_setting('app.clone_mode', true) = 'on' then
    return new;
  end if;
  perform public.refresh_languages_for_asset(new.asset_id);
  return new;
end;
$$;

create or replace function public.copy_asset_download_profiles()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  select download_profiles
  into new.download_profiles
  from public.asset
  where id = new.asset_id;

  return new;
end;
$$;

-- triggers for translation (batch-safe via ingest_batch_id)
drop trigger if exists trg_translation_refresh_languages_del on public.translation;
create trigger trg_translation_refresh_languages_del
after delete on public.translation
for each row
when (old.ingest_batch_id is null)
execute function public.trigger_translation_refresh_languages_del();

drop trigger if exists trg_translation_refresh_languages_ins on public.translation;
create trigger trg_translation_refresh_languages_ins
after insert on public.translation
for each row
when (new.ingest_batch_id is null)
execute function public.trigger_translation_refresh_languages_ins_upd();

drop trigger if exists trg_translation_refresh_languages_upd on public.translation;
create trigger trg_translation_refresh_languages_upd
after update of asset_id, target_language_id, active on public.translation
for each row
when (new.ingest_batch_id is null)
execute function public.trigger_translation_refresh_languages_ins_upd();

drop trigger if exists trigger_copy_asset_download_profiles on public.translation;
create trigger trigger_copy_asset_download_profiles
before insert on public.translation
for each row
execute function public.copy_asset_download_profiles();

-- rls and policies for translation
alter table public.translation enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'translation' and policyname = 'Enable read access for all users'
  ) then
    create policy "Enable read access for all users"
    on public.translation
    for select
    using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'translation' and policyname = 'Enable translation updates only by translation creator'
  ) then
    create policy "Enable translation updates only by translation creator"
    on public.translation
    for update
    to authenticated
    using ((creator_id = auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'translation' and policyname = 'Enable translation insert only by creator'
  ) then
    create policy "Enable translation insert only by creator"
    on public.translation
    for insert
    to authenticated
    with check ((creator_id = auth.uid()));
  end if;
end
$$;

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


