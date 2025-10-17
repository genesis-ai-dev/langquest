-- Migration: Modernize schema structure
-- Purpose: Update database schema to match new drizzleSchemaColumns.ts structure
-- Affected tables: Multiple tables - restructuring relationships and data types
-- Special considerations: This is a major schema restructuring with breaking changes

-- Note: Source column is handled at the application level for local/synced/cloud data tracking
-- and is not stored in the Supabase database. It's used only in the local SQLite schema.

-- Update project table structure
-- Add template column for project type
alter table project add column if not exists template text check (template in ('unstructured', 'bible') or template is null) default 'unstructured';

-- Remove source_language_id from project table (projects only have target language now)
-- Note: project_language_link table handles source languages separately
alter table project drop column if exists source_language_id;

-- Update membership column in profile_project_link to use enum constraint
-- Ensure membership values are restricted to 'owner' or 'member'

alter table profile_project_link drop constraint if exists profile_project_link_membership_check;
alter table profile_project_link add constraint profile_project_link_membership_check check (membership in ('owner', 'member'));

-- Update existing membership values to conform to new enum
update profile_project_link set membership = 'member' where membership is null or membership not in ('owner', 'member');
alter table profile_project_link alter column membership set default 'member';
alter table profile_project_link alter column membership set not null;

-- Modify asset table structure
-- Remove not null constraint from source_language_id (assets may not have source language)
-- Add new columns: project_id, source_asset_id, order_index

alter table asset alter column source_language_id drop not null;

alter table asset add column if not exists project_id uuid references project(id);

alter table asset add column if not exists source_asset_id uuid references asset(id);

alter table asset add column if not exists order_index integer not null default 0;

-- Create index for new asset source_asset_id column
-- Note: asset_project_id_idx already exists from migration 20250919000000_enable_vfs_nesting.sql
create index if not exists asset_source_asset_id_idx on asset(source_asset_id);

create index if not exists idx_asset_order_index on public.asset(order_index);

create index if not exists idx_asset_project_order on public.asset(project_id, order_index) 
where project_id is not null;

comment on column public.asset.order_index is 
'Defines the display order of assets within a quest. Lower values appear first. Default is 0.';

-- Backfill: set asset.project_id for existing rows using first linked quest
-- Chooses the earliest quest_asset_link per asset (by qal.created_at when available)
update asset a
set project_id = src.project_id
from (
  select distinct on (qal.asset_id)
    qal.asset_id,
    q.project_id
  from quest_asset_link qal
  join quest q on q.id = qal.quest_id
  where qal.active = true
  order by qal.asset_id, qal.created_at nulls last
) as src
where a.id = src.asset_id
  and a.project_id is null;

-- rls: allow authenticated project owners or members to insert assets for a project
create policy "Asset insert limited to owners and members"
on public.asset
as permissive
for insert
to authenticated
with check (
  asset.creator_id = (select auth.uid())
  and (
    exists (
      select 1
      from profile_project_link ppl
      where ppl.profile_id = (select auth.uid())
        and ppl.active = true
        and ppl.membership in ('owner', 'member')
        and ppl.project_id = asset.project_id
    )
    or exists (
      select 1
      from project p
      where p.id = asset.project_id
        and p.creator_id = (select auth.uid())
    )
  )
);

-- Optimize and complete existing UPDATE policies from prior migrations
-- Avoid joins where possible
alter policy "Enable asset updates only by project owners"
on public.asset
using (
  exists (
    select 1
    from public.profile_project_link ppl
    where ppl.profile_id = (select auth.uid())
      and ppl.project_id = asset.project_id
      and ppl.membership = 'owner'
      and ppl.active = true
  )
);

alter policy "Enable updates only for project owners"
on public.quest_asset_link
using (
  exists (
    select 1
    from public.profile_project_link ppl
    where ppl.profile_id = (select auth.uid())
      and ppl.membership = 'owner'
      and ppl.active = true
      and ppl.project_id = (
        select q.project_id from public.quest q where q.id = quest_asset_link.quest_id
      )
  )
);

-- rls: allow authenticated project owners or members to insert quest_asset_link rows
create policy "Quest asset link insert limited to owners and members"
on public.quest_asset_link
as permissive
for insert
to authenticated
with check (
  exists (
    select 1
    from profile_project_link ppl
    where ppl.profile_id = (select auth.uid())
      and ppl.membership in ('owner', 'member')
      and ppl.active = true
      and ppl.project_id = (
        select q.project_id from quest q where q.id = quest_asset_link.quest_id
      )
  )
  or (
    not exists (
      select 1
      from profile_project_link ppl2
      where ppl2.profile_id = (select auth.uid())
        and ppl2.active = true
        and ppl2.project_id = (
          select q.project_id from quest q where q.id = quest_asset_link.quest_id
        )
    )
    and exists (
      select 1 from project p
      where p.id = (
        select q.project_id from quest q where q.id = quest_asset_link.quest_id
      )
        and p.creator_id = (select auth.uid())
    )
  )
);

-- rls: allow authenticated project owners or members to insert asset_content_link rows
-- Uses asset.project_id directly since all assets now have project_id (backfilled in this migration)
create policy "Asset content insert limited to owners and members"
on public.asset_content_link
as permissive
for insert
to authenticated
with check (
  -- Check via asset → project (simple and direct)
  exists (
    select 1
    from asset a
    join profile_project_link ppl on ppl.project_id = a.project_id
    where a.id = asset_content_link.asset_id
      and ppl.profile_id = (select auth.uid())
      and ppl.membership in ('owner', 'member')
      and ppl.active = true
  )
  or (
    -- Creator can insert even without profile_project_link if it doesn't exist yet
    exists (
      select 1
      from asset a
      join project p on p.id = a.project_id
      where a.id = asset_content_link.asset_id
        and p.creator_id = (select auth.uid())
    )
    and not exists (
      select 1
      from asset a
      join profile_project_link ppl2 on ppl2.project_id = a.project_id
      where a.id = asset_content_link.asset_id
        and ppl2.profile_id = (select auth.uid())
        and ppl2.active = true
    )
  )
);

-- rls: allow authenticated project owners or members to update asset_content_link rows
-- This is required for upsert operations (INSERT ... ON CONFLICT DO UPDATE)
create policy "Asset content update limited to owners and members"
on public.asset_content_link
as permissive
for update
to authenticated
using (
  -- Check via asset → project (simple and direct)
  exists (
    select 1
    from asset a
    join profile_project_link ppl on ppl.project_id = a.project_id
    where a.id = asset_content_link.asset_id
      and ppl.profile_id = (select auth.uid())
      and ppl.membership in ('owner', 'member')
      and ppl.active = true
  )
  or (
    -- Creator can update even without profile_project_link if it doesn't exist yet
    exists (
      select 1
      from asset a
      join project p on p.id = a.project_id
      where a.id = asset_content_link.asset_id
        and p.creator_id = (select auth.uid())
    )
    and not exists (
      select 1
      from asset a
      join profile_project_link ppl2 on ppl2.project_id = a.project_id
      where a.id = asset_content_link.asset_id
        and ppl2.profile_id = (select auth.uid())
        and ppl2.active = true
    )
  )
);

-- rls: allow authenticated project owners or members to insert quests
create policy "Quest insert limited to owners and members"
on public.quest
as permissive
for insert
to authenticated
with check (
  (
    exists (
      select 1
      from profile_project_link ppl
      where ppl.profile_id = (select auth.uid())
        and ppl.project_id = quest.project_id
        and ppl.membership in ('owner', 'member')
        and ppl.active = true
    )
    or (
      not exists (
        select 1
        from profile_project_link ppl2
        where ppl2.profile_id = (select auth.uid())
          and ppl2.project_id = quest.project_id
          and ppl2.active = true
      )
      and exists (
        select 1
        from project p
        where p.id = quest.project_id
          and p.creator_id = (select auth.uid())
      )
    )
  )
  and quest.creator_id = (select auth.uid())
);
-- rls: allow authenticated project owners or members to insert tags
-- Requires project_id to be NOT NULL (global tags should only be created by service role)
create policy "Tag insert limited to owners and members"
on public.tag
as permissive
for insert
to authenticated
with check (
  tag.project_id is not null
  and exists (
    select 1
    from public.profile_project_link ppl
    where ppl.profile_id = (select auth.uid())
      and ppl.project_id = tag.project_id
      and ppl.active = true
      and ppl.membership in ('owner', 'member')
  )
  or (
    tag.project_id is not null
    and not exists (
      select 1
      from public.profile_project_link ppl2
      where ppl2.profile_id = (select auth.uid())
        and ppl2.project_id = tag.project_id
        and ppl2.active = true
    )
    and exists (
      select 1
      from public.project p
      where p.id = tag.project_id
        and p.creator_id = (select auth.uid())
    )
  )
);

-- rls: allow authenticated project owners or members to update tags
-- This is required for upsert operations (INSERT ... ON CONFLICT DO UPDATE)
-- Users can only update tags belonging to their projects
create policy "Tag update limited to owners and members"
on public.tag
as permissive
for update
to authenticated
using (
  tag.project_id is not null
  and (
    exists (
      select 1
      from public.profile_project_link ppl
      where ppl.profile_id = (select auth.uid())
        and ppl.project_id = tag.project_id
        and ppl.active = true
        and ppl.membership in ('owner', 'member')
    )
    or (
      not exists (
        select 1
        from public.profile_project_link ppl2
        where ppl2.profile_id = (select auth.uid())
          and ppl2.project_id = tag.project_id
          and ppl2.active = true
      )
      and exists (
        select 1
        from public.project p
        where p.id = tag.project_id
          and p.creator_id = (select auth.uid())
      )
    )
  )
);

-- rls: allow authenticated project owners or members to insert quest_tag_link rows
create policy "Quest tag link insert limited to owners and members"
on public.quest_tag_link
as permissive
for insert
to authenticated
with check (
  exists (
    select 1
    from public.quest q
    join public.profile_project_link ppl on ppl.project_id = q.project_id
    where q.id = quest_tag_link.quest_id
      and ppl.profile_id = (select auth.uid())
      and ppl.active = true
      and ppl.membership in ('owner', 'member')
  )
  or (
    not exists (
      select 1
      from public.quest q
      join public.profile_project_link ppl2 on ppl2.project_id = q.project_id
      where q.id = quest_tag_link.quest_id
        and ppl2.profile_id = (select auth.uid())
        and ppl2.active = true
    )
    and exists (
      select 1
      from public.quest q
      join public.project p on p.id = q.project_id
      where q.id = quest_tag_link.quest_id
        and p.creator_id = (select auth.uid())
    )
  )
);

-- rls: allow authenticated project owners or members to update quest_tag_link rows
-- This is required for upsert operations (INSERT ... ON CONFLICT DO UPDATE)
create policy "Quest tag link update limited to owners and members"
on public.quest_tag_link
as permissive
for update
to authenticated
using (
  exists (
    select 1
    from public.quest q
    join public.profile_project_link ppl on ppl.project_id = q.project_id
    where q.id = quest_tag_link.quest_id
      and ppl.profile_id = (select auth.uid())
      and ppl.active = true
      and ppl.membership in ('owner', 'member')
  )
  or (
    not exists (
      select 1
      from public.quest q
      join public.profile_project_link ppl2 on ppl2.project_id = q.project_id
      where q.id = quest_tag_link.quest_id
        and ppl2.profile_id = (select auth.uid())
        and ppl2.active = true
    )
    and exists (
      select 1
      from public.quest q
      join public.project p on p.id = q.project_id
      where q.id = quest_tag_link.quest_id
        and p.creator_id = (select auth.uid())
    )
  )
);

-- rls: allow authenticated project owners or members to insert asset_tag_link rows
create policy "Asset tag link insert limited to owners and members"
on public.asset_tag_link
as permissive
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profile_project_link ppl
    where ppl.profile_id = (select auth.uid())
      and ppl.active = true
      and ppl.membership in ('owner', 'member')
      and ppl.project_id = (
        select a.project_id from public.asset a where a.id = asset_tag_link.asset_id
      )
  )
  or (
    not exists (
      select 1
      from public.profile_project_link ppl2
      where ppl2.profile_id = (select auth.uid())
        and ppl2.active = true
        and ppl2.project_id = (
          select a2.project_id from public.asset a2 where a2.id = asset_tag_link.asset_id
        )
    )
    and exists (
      select 1 from public.project p
      where p.id = (
        select a3.project_id from public.asset a3 where a3.id = asset_tag_link.asset_id
      )
        and p.creator_id = (select auth.uid())
    )
  )
);

-- Modify vote table to reference assets instead of translations
-- This is a breaking change - votes now apply to assets rather than translations

-- First, create a backup of existing vote data if needed
-- Note: This migration assumes translation table will be removed

-- Drop existing foreign key constraint and index
alter table vote drop constraint if exists vote_translation_id_fkey;
drop index if exists vote_translation_id_idx;
drop index if exists vote_translation_id_creator_id_idx;

-- Rename translation_id to asset_id and update references
alter table vote rename column translation_id to asset_id;

-- Add foreign key constraint to asset table
alter table vote add constraint vote_asset_id_fkey foreign key (asset_id) references asset(id);

-- Recreate indexes with new column name
create index if not exists vote_asset_id_idx on vote(asset_id);
create index if not exists vote_creator_id_idx on vote(creator_id);

-- Modify asset_content_link table
-- Change audio_id (single text) to audio (json array)
-- Make text column nullable

-- Add new audio array column
alter table asset_content_link add column if not exists audio jsonb;

-- Migrate existing audio_id data to audio array
-- If audio_id exists and is not null, create array with single element
-- If audio_id is null or empty, set audio to empty array
update asset_content_link set 
  audio = case 
    when audio_id is not null and trim(audio_id) != '' then 
      jsonb_build_array(audio_id)
    else 
      '[]'::jsonb
  end
where audio is null;

-- Handle any remaining null values (safety check)
update asset_content_link set audio = '[]'::jsonb where audio is null;

-- Drop the old audio_id column after migration
alter table asset_content_link drop column if exists audio_id;

-- Make text column nullable
alter table asset_content_link alter column text drop not null;

-- Modify tag table structure
-- Replace single 'name' column with 'key' and 'value' columns for structured tagging
-- Transform existing data by splitting 'name' on ':' delimiter
-- Add project_id to scope tags to projects (nullable for global tags)

-- First, drop materialized views that depend on tag.name column
drop materialized view if exists asset_tag_categories cascade;
drop materialized view if exists quest_tag_categories cascade;

alter table tag add column if not exists key text;
alter table tag add column if not exists value text;
alter table tag add column if not exists project_id uuid references project(id) on delete cascade;

-- Migrate existing name data by splitting on ':' delimiter
-- If name contains ':', split into key and value
-- If name doesn't contain ':', use entire name as key and empty string as value
update tag set 
  key = case 
    when position(':' in name) > 0 then 
      trim(substring(name from 1 for position(':' in name) - 1))
    else 
      trim(name)
  end,
  value = case 
    when position(':' in name) > 0 then 
      trim(substring(name from position(':' in name) + 1))
    else 
      ''
  end
where key is null and name is not null;

-- Handle any remaining null values (shouldn't happen, but safety check)
update tag set key = coalesce(key, '') where key is null;
update tag set value = coalesce(value, '') where value is null;

-- Make key and value columns required
alter table tag alter column key set not null;
alter table tag alter column value set not null;

-- Drop the old name column after migration
alter table tag drop column if exists name;

-- Drop the old unique constraint on (key, value) if it exists
drop index if exists tag_key_value_unique;

-- Create new unique index on (key, value, project_id) to allow same key-value pairs across different projects
-- and to allow global tags (project_id = null) to coexist with project-scoped tags
create unique index if not exists tag_key_value_project_unique on tag(key, value, project_id);

-- Create index on project_id for query performance
create index if not exists tag_project_id_idx on tag(project_id);

-- Make asset name column nullable (translations don't need names)
alter table asset alter column name drop not null;

-- Ensure all legacy translation RLS policies are removed before migrating/dropping the table
-- These may still exist in some environments and can block data movement
drop policy if exists "Enable translation updates only by translation creator" on public.translation;
drop policy if exists "Enable translation insert only by creator" on public.translation;
drop policy if exists "Enable read access for all users" on public.translation;

-- Migrate existing translations to new asset-based structure
-- This converts translation records into assets with asset_content_links
-- Each translation becomes:
-- 1. A new asset with source_asset_id pointing to the original asset
-- 2. An asset_content_link containing the translation text/audio
-- 3. Quest_asset_links to maintain quest relationships

-- Step 1: Create new assets for each translation
insert into asset (
  id,
  active,
  created_at,
  last_updated,
  name,
  source_language_id,
  project_id,
  source_asset_id,
  creator_id,
  order_index,
  download_profiles
)
select 
  t.id as id,  -- Use translation ID as new asset ID
  t.active,
  t.created_at,
  t.last_updated,
  null as name,  -- Translations don't need names
  t.target_language_id as source_language_id,  -- Translation language becomes source language
  a.project_id,  -- Inherit project from source asset
  t.asset_id as source_asset_id,  -- Point to original asset
  t.creator_id,
  0 as order_index,  -- Default order
  case 
    when t.creator_id is not null then array[t.creator_id]
    else array[]::uuid[]
  end as download_profiles
from translation t
join asset a on t.asset_id = a.id
where t.active = true;

-- Step 2: Create asset_content_links for translation content
insert into asset_content_link (
  id,
  active,
  created_at,
  last_updated,
  asset_id,
  source_language_id,
  text,
  audio,
  download_profiles
)
select 
  gen_random_uuid() as id,  -- Generate unique UUID for asset_content_link
  t.active,
  t.created_at,
  t.last_updated,
  t.id as asset_id,  -- Link to the new asset we just created
  t.target_language_id as source_language_id,  -- Translation language
  t.text,
  case 
    when t.audio is not null and trim(t.audio) != '' then 
      jsonb_build_array(t.audio)
    else 
      '[]'::jsonb
  end as audio,
  case 
    when t.creator_id is not null then array[t.creator_id]
    else array[]::uuid[]
  end as download_profiles
from translation t
where t.active = true;

-- Step 3: Create quest_asset_links to maintain quest relationships
-- Find which quests the original assets belonged to and link the new translation assets
-- Note: quest_asset_link uses composite primary key (quest_id, asset_id), no separate id column needed
insert into quest_asset_link (
  active,
  created_at,
  last_updated,
  quest_id,
  asset_id,
  visible,
  download_profiles
)
select
  t.active,
  t.created_at,
  t.last_updated,
  qal.quest_id,
  t.id as asset_id,  -- Link to the new translation asset
  qal.visible,
  case 
    when t.creator_id is not null then array[t.creator_id]
    else array[]::uuid[]
  end as download_profiles
from translation t
join quest_asset_link qal on qal.asset_id = t.asset_id
where t.active = true and qal.active = true;

-- Note: Vote table column was already renamed from translation_id to asset_id earlier (line 56)
-- The rename operation preserves the data, so votes now correctly reference assets
-- Since we're reusing translation IDs as asset IDs (Step 1), the references remain valid

-- Step 4: Clean up - Remove translation table entirely
-- This is a major breaking change - all translation functionality now handled through assets
drop table if exists translation cascade;

-- Update reports table to ensure reporter_id is not null
alter table reports alter column reporter_id set not null;

-- Add comment explaining the major schema changes
comment on table profile is 'User profiles for the offline-first architecture';
comment on table project is 'Projects with template support for structured content';
comment on table asset is 'Assets with flexible language assignment and hierarchical structure';
comment on table vote is 'Votes now reference assets directly instead of translations';
comment on table tag is 'Structured tags with key-value pairs for better categorization';

-- Note: RLS policies are already comprehensively defined in previous migrations
-- (20250820015134_firm_up_rls_policies.sql, 20250807000001_add_project_language_link_table.sql, 
--  20250903190000_update_profile_visibility.sql, and others)
-- This migration focuses only on schema structure changes.

-- Recreate materialized views with new tag.key column structure
-- These views were dropped earlier to allow tag.name column removal

-- Recreate asset_tag_categories materialized view
-- This view extracts distinct tag categories (using new 'key' column) for each quest via asset tags
create materialized view asset_tag_categories as
select
  q.id as quest_id,
  array_agg(distinct t.key) as tag_categories
from
  quest q
  join quest_asset_link qal on q.id = qal.quest_id
  join asset a on qal.asset_id = a.id
  join asset_tag_link atl on a.id = atl.asset_id
  join tag t on atl.tag_id = t.id
group by
  q.id
order by
  q.id;

-- Recreate quest_tag_categories materialized view
-- This view extracts distinct tag categories for all quests in each project
create materialized view quest_tag_categories as
select
  p.id as project_id,
  array_agg(distinct t.key) as tag_categories
from 
  project p
  join quest q on q.project_id = p.id
  join quest_asset_link qal on q.id = qal.quest_id
  join asset a on qal.asset_id = a.id
  join asset_tag_link atl on a.id = atl.asset_id
  join tag t on atl.tag_id = t.id
group by
  p.id
order by
  p.id;

-- Recreate refresh functions
create or replace function refresh_asset_tag_categories()
returns trigger as $$
begin
  refresh materialized view concurrently asset_tag_categories;
  return null;
end;
$$ language plpgsql;

create or replace function refresh_quest_tag_categories()
returns trigger as $$
begin
  refresh materialized view concurrently quest_tag_categories;
  return null;
end;
$$ language plpgsql;

-- Replace language array functions to remove dependency on dropped translation table
-- Quest language arrays are now computed from asset_content_link joined via quest_asset_link
create or replace function public.update_quest_language_arrays(quest_id_param uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.quest_closure qc
  set source_language_ids = (
    select coalesce(
      jsonb_agg(distinct acl.source_language_id::text)
        filter (where acl.source_language_id is not null),
      '[]'::jsonb
    )
    from public.quest_asset_link qal
    join public.asset a on a.id = qal.asset_id and qal.active = true
    join public.asset_content_link acl on acl.asset_id = a.id and acl.active = true
    where qal.quest_id = quest_id_param
      and (a.source_asset_id is null)
  ),
  target_language_ids = (
    select coalesce(
      jsonb_agg(distinct acl.source_language_id::text)
        filter (where acl.source_language_id is not null),
      '[]'::jsonb
    )
    from public.quest_asset_link qal
    join public.asset a on a.id = qal.asset_id and qal.active = true
    join public.asset_content_link acl on acl.asset_id = a.id and acl.active = true
    where qal.quest_id = quest_id_param
      and (a.source_asset_id is not null)
  ),
  last_updated = now()
  where qc.quest_id = quest_id_param;
end;
$$;

create or replace function public.update_project_language_arrays(project_id_param uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.project_closure pc
  set source_language_ids = (
    select coalesce(
      jsonb_agg(distinct acl.source_language_id::text)
        filter (where acl.source_language_id is not null),
      '[]'::jsonb
    )
    from public.quest q
    join public.quest_asset_link qal on qal.quest_id = q.id and qal.active = true
    join public.asset a on a.id = qal.asset_id
    join public.asset_content_link acl on acl.asset_id = a.id and acl.active = true
    where q.project_id = project_id_param
      and (a.source_asset_id is null)
  ),
  target_language_ids = (
    select coalesce(
      jsonb_agg(distinct acl.source_language_id::text)
        filter (where acl.source_language_id is not null),
      '[]'::jsonb
    )
    from public.quest q
    join public.quest_asset_link qal on qal.quest_id = q.id and qal.active = true
    join public.asset a on a.id = qal.asset_id
    join public.asset_content_link acl on acl.asset_id = a.id and acl.active = true
    where q.project_id = project_id_param
      and (a.source_asset_id is not null)
  ),
  last_updated = now()
  where pc.project_id = project_id_param;
end;
$$;

-- Add CASCADE delete behavior to foreign key constraints
-- This allows automatic cleanup of related records when parent records are deleted

-- Update project_closure foreign key to cascade deletes
alter table project_closure drop constraint if exists project_closure_project_id_fkey;
alter table project_closure add constraint project_closure_project_id_fkey 
  foreign key (project_id) references project(id) on delete cascade;

-- Update quest_closure foreign key to cascade deletes
alter table quest_closure drop constraint if exists quest_closure_project_id_fkey;
alter table quest_closure add constraint quest_closure_project_id_fkey 
  foreign key (project_id) references project(id) on delete cascade;

-- Update quest_aggregates foreign key to cascade deletes (if table exists)
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'quest_aggregates') then
    alter table quest_aggregates drop constraint if exists quest_aggregates_project_id_fkey;
    alter table quest_aggregates add constraint quest_aggregates_project_id_fkey 
      foreign key (project_id) references project(id) on delete cascade;
  end if;
end $$;

-- Update asset.project_id foreign key to cascade deletes (added in this migration)
alter table asset drop constraint if exists asset_project_id_fkey;
alter table asset add constraint asset_project_id_fkey 
  foreign key (project_id) references project(id) on delete cascade;
