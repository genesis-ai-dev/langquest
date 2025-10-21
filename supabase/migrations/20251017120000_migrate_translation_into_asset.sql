-- Migration: Migrate translation rows into asset and asset_content_link; drop translation table
-- Notes:
-- - Adds public.asset.source_asset_id (self-referential FK)
-- - Moves columns from public.translation to public.asset and public.asset_content_link
-- - Removes legacy public.asset.source_language_id
-- - Drops public.translation and related FK constraints

set check_function_bodies = off;

do $$ begin
  -- 1) Add source_asset_id to asset (nullable) and index + FK
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'asset' and column_name = 'source_asset_id'
  ) then
    alter table public.asset add column source_asset_id uuid;
  end if;

  -- Add FK if missing
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid and t.relname = 'asset'
    where c.conname = 'asset_source_asset_id_fkey'
  ) then
    alter table public.asset
      add constraint asset_source_asset_id_fkey
      foreign key (source_asset_id) references public.asset(id) on delete set null;
  end if;

  -- Helpful index for lookups
  create index if not exists asset_source_asset_id_idx on public.asset(source_asset_id);
end $$;

-- 2) Migration helpers: create temp table to map old translation.id -> new asset.id
drop table if exists public._tmp_translation_asset_map;
create temporary table _tmp_translation_asset_map (
  translation_id uuid primary key,
  new_asset_id uuid not null
) on commit drop;

-- 3) Insert a new asset row for each translation
--    Carry over: id, created_at, last_updated, active, visible, creator_id, download_profiles
--    Map translation.asset_id -> asset.source_asset_id (the parent/original asset)
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
  ingest_batch_id,
  source_asset_id
)
select
  t.id,
  t.created_at,
  coalesce(t.last_updated, now()),
  -- Name: if parent asset exists, prefix with parent's name; else fallback
  coalesce(
    case when a.name is not null then a.name || ' (variant)'
         else null end,
    'Translation ' || left(t.id::text, 8)
  ) as name,
  a.images, -- inherit images from parent asset if present
  coalesce(t.active, true),
  t.creator_id,
  coalesce(t.visible, true),
  coalesce(t.download_profiles, '{}')::uuid[],
  t.ingest_batch_id,
  t.asset_id as source_asset_id
from public.translation t
left join public.asset a on a.id = t.asset_id
on conflict (id) do nothing;

-- 3b) Record mapping for follow-on inserts
insert into _tmp_translation_asset_map (translation_id, new_asset_id)
select t.id, t.id from public.translation t
on conflict do nothing;

--    Generate new asset_content_link rows with fresh IDs and record mapping to translation
drop table if exists public._tmp_translation_acl_map;
create temporary table _tmp_translation_acl_map (
  translation_id uuid primary key,
  acl_id uuid not null
) on commit drop;

with src as (
  select
    t.id as translation_id,
    m.new_asset_id as asset_id,
    t.audio as audio_id,
    t.text,
    t.target_language_id as source_language_id,
    coalesce(t.active, true) as active,
    coalesce(t.download_profiles, '{}')::uuid[] as download_profiles,
    t.ingest_batch_id,
    gen_random_uuid() as new_acl_id
  from public.translation t
  join _tmp_translation_asset_map m on m.translation_id = t.id
), ins as (
  insert into public.asset_content_link (
    id,
    asset_id,
    audio_id,
    text,
    source_language_id,
    active,
    download_profiles,
    ingest_batch_id
  )
  select
    s.new_acl_id,
    s.asset_id,
    s.audio_id,
    s.text,
    s.source_language_id,
    s.active,
    s.download_profiles,
    s.ingest_batch_id
  from src s
  on conflict do nothing
  returning id
)
insert into _tmp_translation_acl_map (translation_id, acl_id)
select s.translation_id, s.new_acl_id from src s
on conflict do nothing;

-- 5) Drop FK from vote.translation_id if it exists, so translation table can be dropped
do $$ begin
  if exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    where t.relname = 'vote' and c.conname = 'votes_translation_id_fkey'
  ) then
    alter table public.vote drop constraint votes_translation_id_fkey;
  end if;
end $$;

-- 5b) Add vote.asset_link_id, backfill from translation_id (which equals new asset_content_link.id), add FK and index
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'vote' and column_name = 'asset_link_id'
  ) then
    alter table public.vote add column asset_link_id uuid;
  end if;
end $$;

-- Backfill vote.asset_link_id using translation -> asset_content_link mapping
update public.vote v
set asset_link_id = m.acl_id
from _tmp_translation_acl_map m
where v.asset_link_id is null and v.translation_id = m.translation_id;

-- Add FK to asset_content_link(id) and supporting index
do $$ begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid and t.relname = 'vote'
    where c.conname = 'votes_asset_link_id_fkey'
  ) then
    alter table public.vote
      add constraint votes_asset_link_id_fkey
      foreign key (asset_link_id) references public.asset_content_link(id) on delete cascade;
  end if;
end $$;

create index if not exists vote_asset_link_id_idx on public.vote(asset_link_id);

-- 5c) Replace old vote triggers that referenced translation with asset-based equivalents
-- Drop legacy triggers if they exist
drop trigger if exists trigger_copy_asset_download_profiles_to_vote on public.vote;
drop trigger if exists update_quest_closure_on_vote_trigger on public.vote;

-- New: copy download_profiles from asset via asset_content_link BEFORE INSERT
create or replace function public.copy_asset_download_profiles_to_vote_v2() returns trigger as $$
begin
  select a.download_profiles into new.download_profiles
  from public.asset a
  join public.asset_content_link acl on acl.asset_id = a.id
  where acl.id = new.asset_link_id;
  return new;
end; $$ language plpgsql;

create or replace trigger trigger_copy_asset_download_profiles_to_vote_v2
before insert on public.vote for each row
execute function public.copy_asset_download_profiles_to_vote_v2();

-- New: refresh language aggregates when votes change
create or replace function public.trigger_vote_refresh_languages_ins_upd() returns trigger
language plpgsql as $$
declare v_asset_id uuid; begin
  select asset_id into v_asset_id from public.asset_content_link where id = new.asset_link_id;
  if v_asset_id is not null then
    perform public.refresh_languages_for_asset(v_asset_id);
  end if;
  return new;
end; $$;

create or replace function public.trigger_vote_refresh_languages_del() returns trigger
language plpgsql as $$
declare v_asset_id uuid; begin
  select asset_id into v_asset_id from public.asset_content_link where id = old.asset_link_id;
  if v_asset_id is not null then
    perform public.refresh_languages_for_asset(v_asset_id);
  end if;
  return old;
end; $$;

drop trigger if exists trg_vote_refresh_languages_ins on public.vote;
create trigger trg_vote_refresh_languages_ins
after insert on public.vote
for each row
when (new.ingest_batch_id is null)
execute function public.trigger_vote_refresh_languages_ins_upd();

drop trigger if exists trg_vote_refresh_languages_upd on public.vote;
create trigger trg_vote_refresh_languages_upd
after update of asset_link_id, polarity, active on public.vote
for each row
when (new.ingest_batch_id is null)
execute function public.trigger_vote_refresh_languages_ins_upd();

drop trigger if exists trg_vote_refresh_languages_del on public.vote;
create trigger trg_vote_refresh_languages_del
after delete on public.vote
for each row
when (old.ingest_batch_id is null)
execute function public.trigger_vote_refresh_languages_del();

-- 5d) Remove legacy vote.translation_id column
-- do $$ begin
--   if exists (
--     select 1 from information_schema.columns
--     where table_schema = 'public' and table_name = 'vote' and column_name = 'translation_id'
--   ) then
--     alter table public.vote drop column translation_id;
--   end if;
-- end $$;

-- 6) Remove legacy asset.source_language_id now that language lives on asset_content_link
-- do $$ begin
--   if exists (
--     select 1 from information_schema.columns
--     where table_schema = 'public' and table_name = 'asset' and column_name = 'source_language_id'
--   ) then
--     -- Drop dependent objects first if any FK exists
--     if exists (
--       select 1 from pg_constraint c
--       join pg_class t on t.oid = c.conrelid
--       where t.relname = 'asset' and c.conname = 'assets_source_language_id_fkey'
--     ) then
--       alter table public.asset drop constraint assets_source_language_id_fkey;
--     end if;
--     alter table public.asset drop column source_language_id;
--   end if;
-- end $$;

-- 7) Finally drop translation table (and any triggers referencing it were already created in older migrations)
-- do $$ begin
--   if exists (
--     select 1 from information_schema.tables
--     where table_schema = 'public' and table_name = 'translation'
--   ) then
--     drop table public.translation cascade;
--   end if;
-- end $$;

-- Publishing tweaks for PowerSync (if needed)
-- Note: If translation was part of publication, nothing to do after drop; assets/asset_content_link already published.


