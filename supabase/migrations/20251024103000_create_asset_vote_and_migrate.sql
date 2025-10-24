-- Migration: Create asset_vote and migrate existing votes
-- Purpose:
-- - Introduce asset_vote table linked to asset(id)
-- - Migrate rows from legacy vote table (likely linked to translation) into asset_vote
-- - Keep legacy table intact (no drop) for safety; can be removed in a later migration
-- - Add RLS and indexes, and include table in PowerSync publication

set check_function_bodies = off;
set search_path = public;

-- 1) Create new table public.asset_vote (structure mirrors desired vote schema with asset_id FK)
create table if not exists public.asset_vote (
  id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  last_updated timestamptz not null default now(),
  asset_id uuid not null,
  polarity text not null,
  comment text null,
  creator_id uuid null,
  active boolean not null default true,
  download_profiles uuid[] null,
  ingest_batch_id uuid null,
  constraint asset_vote_pkey primary key (id),
  constraint asset_vote_asset_id_fkey foreign key (asset_id) references public.asset (id),
  constraint asset_vote_creator_id_fkey foreign key (creator_id) references public.profile (id) on delete set null
);

-- 2) Indexes
create index if not exists idx_asset_vote_download_profiles on public.asset_vote using gin (download_profiles);
create index if not exists asset_vote_asset_id_idx on public.asset_vote using btree (asset_id);
create index if not exists asset_vote_creator_id_idx on public.asset_vote using btree (creator_id);

-- 3) Trigger function: copy download_profiles from linked asset to new vote
create or replace function public.copy_asset_download_profiles_to_asset_vote()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- Copy download_profiles from the linked asset to the new vote
  select a.download_profiles
    into new.download_profiles
  from public.asset a
  where a.id = new.asset_id;

  return new;
end;
$$;

-- Create trigger to call the new function
do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trigger_copy_asset_download_profiles_to_asset_vote'
  ) then
    create trigger trigger_copy_asset_download_profiles_to_asset_vote
    before insert on public.asset_vote
    for each row
    execute function public.copy_asset_download_profiles_to_asset_vote();
  end if;
end;
$$;

-- 4) Enable RLS and policies
alter table public.asset_vote enable row level security;

do $$
begin
  -- Read for all users
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='asset_vote' and policyname='Enable read access for all users'
  ) then
    create policy "Enable read access for all users"
      on public.asset_vote for select
      using (true);
  end if;

  -- Insert only by creator
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='asset_vote' and policyname='Enable vote insert only by creator'
  ) then
    create policy "Enable vote insert only by creator"
      on public.asset_vote for insert
      with check ((creator_id = auth.uid()));
  end if;

  -- Update only by creator
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='asset_vote' and policyname='Enable vote update only by vote creator'
  ) then
    create policy "Enable vote update only by vote creator"
      on public.asset_vote for update
      using ((creator_id = auth.uid()))
      with check ((creator_id = auth.uid()));
  end if;
end;
$$;

-- 5) Migrate data from legacy vote table to asset_vote
-- Assumptions:
-- - Legacy public.vote has translation_id referencing public.translation(id)
-- - New variant assets may exist with id = translation.id; if not, fall back to translation.asset_id
-- - If neither mapping yields a valid asset, row will be skipped to preserve referential integrity

insert into public.asset_vote (
  id,
  created_at,
  last_updated,
  asset_id,
  polarity,
  comment,
  creator_id,
  active,
  download_profiles,
  ingest_batch_id
)
select
  v.id,
  coalesce(v.created_at, now()),
  coalesce(v.last_updated, now()),
  coalesce(a_variant.id, t.asset_id) as asset_id,
  v.polarity,
  v.comment,
  v.creator_id,
  coalesce(v.active, true),
  v.download_profiles,
  v.ingest_batch_id
from public.vote v
left join public.translation t on t.id = v.translation_id
left join public.asset a_variant on a_variant.id = t.id
where coalesce(a_variant.id, t.asset_id) is not null
on conflict (id) do nothing;

-- 6) Add to PowerSync publication
alter publication "powersync" add table only public.asset_vote;


