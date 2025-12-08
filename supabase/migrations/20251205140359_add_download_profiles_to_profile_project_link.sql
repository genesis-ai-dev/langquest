-- Migration: Add download_profiles support to profile_project_link
-- Purpose:
-- - Add download_profiles column to profile_project_link table
-- - download_profiles contains OTHER active members' profile_ids (not self)
-- - This enables the co_member_profiles sync stream to sync team members' profiles
-- - When a member joins: add their profile_id to all OTHER members' ppl records
-- - When a member leaves: remove their profile_id from all ppl records

-- Add download_profiles column to profile_project_link
alter table public.profile_project_link 
add column if not exists download_profiles uuid[] default null;

-- Create GIN index for efficient querying
create index if not exists idx_profile_project_link_download_profiles 
on public.profile_project_link using gin (download_profiles);

-- ============================================================================
-- BEFORE INSERT OR UPDATE trigger: Populate download_profiles with OTHER active members
-- When joining/rejoining, set download_profiles to other active members (not self)
-- ============================================================================
create or replace function public.ppl_populate_download_profiles_before()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    -- When becoming active, populate with other active members
    if new.active = true and (tg_op = 'INSERT' or old.active is distinct from true) then
        select coalesce(array_agg(ppl.profile_id), '{}')
        into new.download_profiles
        from public.profile_project_link ppl
        where ppl.project_id = new.project_id
          and ppl.active = true;
    end if;
    
    -- Always ensure self is never in download_profiles (safeguard against seeds/manual inserts)
    new.download_profiles := array_remove(coalesce(new.download_profiles, '{}'), new.profile_id);
    
    return new;
end;
$$;

-- Drop trigger if exists (idempotency)
drop trigger if exists trigger_ppl_populate_download_profiles_before on public.profile_project_link;

-- Create BEFORE INSERT OR UPDATE trigger
create trigger trigger_ppl_populate_download_profiles_before
before insert or update on public.profile_project_link
for each row
execute function public.ppl_populate_download_profiles_before();

-- ============================================================================
-- AFTER INSERT OR UPDATE trigger: Add self to OTHER members' ppl records
-- This allows other members to sync the new member's profile
-- ============================================================================
create or replace function public.ppl_propagate_member_after()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    -- If this record became active, add this member to all OTHER ppl records
    if new.active = true and (tg_op = 'INSERT' or old.active is distinct from true) then
        update public.profile_project_link 
        set download_profiles = array_append(coalesce(download_profiles, '{}'), new.profile_id)
        where project_id = new.project_id
          and profile_id != new.profile_id
          and not (download_profiles @> array[new.profile_id]);
    end if;
    
    return new;
end;
$$;

-- Drop trigger if exists (idempotency)
drop trigger if exists trigger_ppl_propagate_member_after on public.profile_project_link;

-- Create AFTER INSERT OR UPDATE trigger
create trigger trigger_ppl_propagate_member_after
after insert or update on public.profile_project_link
for each row
execute function public.ppl_propagate_member_after();

-- ============================================================================
-- AFTER UPDATE OR DELETE trigger: Remove self from all ppl records when leaving
-- ============================================================================
create or replace function public.ppl_remove_member_after()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    leaving_id uuid;
    proj_id uuid;
begin
    if tg_op = 'DELETE' then
        leaving_id := old.profile_id;
        proj_id := old.project_id;
    elsif tg_op = 'UPDATE' and old.active = true and new.active is distinct from true then
        leaving_id := old.profile_id;
        proj_id := old.project_id;
    else
        return coalesce(new, old);
    end if;
    
    -- Remove this member from ALL ppl records for this project
    update public.profile_project_link 
    set download_profiles = array_remove(coalesce(download_profiles, '{}'), leaving_id)
    where project_id = proj_id;
    
    return coalesce(new, old);
end;
$$;

-- Drop trigger if exists (idempotency)
drop trigger if exists trigger_ppl_remove_member_after on public.profile_project_link;

-- Create AFTER UPDATE OR DELETE trigger
create trigger trigger_ppl_remove_member_after
after update or delete on public.profile_project_link
for each row
execute function public.ppl_remove_member_after();

-- ============================================================================
-- Backfill: Set download_profiles to OTHER active members for each record
-- ============================================================================
update public.profile_project_link ppl
set download_profiles = (
    select coalesce(array_agg(other.profile_id), '{}')
    from public.profile_project_link other
    where other.project_id = ppl.project_id
      and other.active = true
      and other.profile_id != ppl.profile_id
)
where ppl.active = true;

