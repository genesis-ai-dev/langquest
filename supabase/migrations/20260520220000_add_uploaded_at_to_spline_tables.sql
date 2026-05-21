-- ============================================================================
-- Migration: Add uploaded_at to remaining spline tables
-- ============================================================================
--
-- PURPOSE:
-- Complete uploaded_at coverage across the PowerSync spline hierarchy:
--   project → quest → asset ↔ quest_asset_link
--                      ↳ asset_content_link, vote
--
-- TABLES ADDED (this migration):
--   - project
--   - quest
--   - quest_asset_link
--
-- ALREADY COVERED (prior migrations):
--   - asset, asset_content_link (20260505180000, 20260505230727)
--   - vote (20260505180000)
--
-- DESIGN:
--   - Nullable column, no backfill for existing rows
--   - BEFORE INSERT trigger sets uploaded_at = now() on server receipt
--   - Clients must not write this column in mutation payloads
--
-- ============================================================================

set search_path = public;

-- ============================================================================
-- project
-- ============================================================================

alter table public.project add column if not exists uploaded_at timestamptz;

create or replace function public.set_project_uploaded_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    new.uploaded_at = now();
    return new;
end;
$$;

drop trigger if exists trigger_set_project_uploaded_at on public.project;

create trigger trigger_set_project_uploaded_at
    before insert on public.project
    for each row
    execute function public.set_project_uploaded_at();

comment on column public.project.uploaded_at is
  'Server-confirmed upload time. Set by trigger on INSERT. Clients must not write this column.';

-- ============================================================================
-- quest
-- ============================================================================

alter table public.quest add column if not exists uploaded_at timestamptz;

create or replace function public.set_quest_uploaded_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    new.uploaded_at = now();
    return new;
end;
$$;

drop trigger if exists trigger_set_quest_uploaded_at on public.quest;

create trigger trigger_set_quest_uploaded_at
    before insert on public.quest
    for each row
    execute function public.set_quest_uploaded_at();

comment on column public.quest.uploaded_at is
  'Server-confirmed upload time. Set by trigger on INSERT. Clients must not write this column.';

-- ============================================================================
-- quest_asset_link
-- ============================================================================

alter table public.quest_asset_link add column if not exists uploaded_at timestamptz;

create or replace function public.set_quest_asset_link_uploaded_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    new.uploaded_at = now();
    return new;
end;
$$;

drop trigger if exists trigger_set_quest_asset_link_uploaded_at on public.quest_asset_link;

create trigger trigger_set_quest_asset_link_uploaded_at
    before insert on public.quest_asset_link
    for each row
    execute function public.set_quest_asset_link_uploaded_at();

comment on column public.quest_asset_link.uploaded_at is
  'Server-confirmed upload time. Set by trigger on INSERT. Clients must not write this column.';

-- ============================================================================
-- vote (drizzle parity; column may already exist from 20260505180000)
-- ============================================================================

alter table public.vote add column if not exists uploaded_at timestamptz;

create or replace function public.set_vote_uploaded_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    new.uploaded_at = now();
    return new;
end;
$$;

drop trigger if exists trigger_set_vote_uploaded_at on public.vote;

create trigger trigger_set_vote_uploaded_at
    before insert on public.vote
    for each row
    execute function public.set_vote_uploaded_at();

comment on column public.vote.uploaded_at is
  'Server-confirmed upload time. Set by trigger on INSERT. Clients must not write this column.';
