-- ============================================================================
-- Migration: Add Languoid Link Suggestion System
-- ============================================================================
-- 
-- PURPOSE:
-- Creates infrastructure for suggesting links between user-created languoids
-- and existing languoids in the database. When users create custom languoids
-- offline (while creating projects), this system helps them find and link
-- to existing languoids once they're back online.
--
-- AFFECTED TABLES:
-- - Creates: languoid_link_suggestion (new table for storing match suggestions)
--
-- TRIGGERS:
-- - Creates: suggest_languoid_links_trigger on languoid table
--
-- SPECIAL CONSIDERATIONS:
-- - Uses pg_trgm for fuzzy text matching (already enabled)
-- - Leverages existing search_languoids RPC function
-- - Integrates with existing notification system
--
-- ============================================================================

-- ============================================================================
-- 1. Create languoid_link_suggestion table
-- ============================================================================
-- Stores suggestions for linking user-created languoids to existing ones

create table if not exists public.languoid_link_suggestion (
  id uuid primary key default gen_random_uuid(),
  
  -- The user-created languoid that needs linking
  languoid_id uuid not null references public.languoid(id) on delete cascade,
  
  -- The suggested existing languoid to link to
  suggested_languoid_id uuid not null references public.languoid(id) on delete cascade,
  
  -- The user who created the custom languoid (receives the notification)
  profile_id uuid not null references public.profile(id) on delete cascade,
  
  -- Match quality: 1=exact, 2=starts-with, 3=contains
  match_rank integer not null default 3,
  
  -- Additional context about the match
  matched_on text, -- 'name', 'alias', 'iso_code'
  matched_value text, -- The actual value that matched
  
  -- Status: pending, accepted, declined, withdrawn, expired (matches constants.ts statusOptions)
  status text not null default 'pending',
  
  -- Soft delete
  active boolean not null default true,
  
  -- Timestamps
  created_at timestamptz not null default now(),
  last_updated timestamptz not null default now(),
  
  -- Ensure we don't create duplicate suggestions
  constraint unique_languoid_suggestion unique (languoid_id, suggested_languoid_id)
);

-- Add comment describing the table
comment on table public.languoid_link_suggestion is 
  'Stores suggestions for linking user-created languoids to existing languoids. '
  'When users create custom languoids offline, this table helps them find matches '
  'to existing languoids once they sync.';

-- Enable Row Level Security
alter table public.languoid_link_suggestion enable row level security;

-- ============================================================================
-- 2. Create indexes for performance
-- ============================================================================

-- Index for finding suggestions by user languoid
create index if not exists idx_languoid_link_suggestion_user_languoid 
  on public.languoid_link_suggestion(languoid_id) 
  where active = true;

-- Index for finding suggestions by creator profile (for notifications)
create index if not exists idx_languoid_link_suggestion_creator 
  on public.languoid_link_suggestion(profile_id) 
  where active = true and status = 'pending';

-- Index for finding suggestions by status
create index if not exists idx_languoid_link_suggestion_status 
  on public.languoid_link_suggestion(status) 
  where active = true;

-- ============================================================================
-- 3. Create RLS Policies
-- ============================================================================

-- Policy: Users can update their own languoids (needed for accept_languoid_link_suggestion)
-- This allows users to deactivate their own languoids when accepting suggestions
drop policy if exists "Users can update their own languoids" on public.languoid;
create policy "Users can update their own languoids"
  on public.languoid
  for update
  to authenticated
  using (creator_id = auth.uid())
  with check (creator_id = auth.uid());

-- Policy: Users can view their own suggestions
create policy "Users can view their own languoid link suggestions"
  on public.languoid_link_suggestion
  for select
  to authenticated
  using (profile_id = auth.uid());

-- Policy: Users can update their own suggestions (to accept/reject)
create policy "Users can update their own languoid link suggestions"
  on public.languoid_link_suggestion
  for update
  to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Policy: System can insert suggestions (via trigger/function)
-- Using security definer functions for inserts
create policy "Service role can insert languoid link suggestions"
  on public.languoid_link_suggestion
  for insert
  to service_role
  with check (true);

-- Policy: Authenticated users can insert their own suggestions
create policy "Users can insert their own languoid link suggestions"
  on public.languoid_link_suggestion
  for insert
  to authenticated
  with check (profile_id = auth.uid());

-- ============================================================================
-- 4. Create function to find and create languoid link suggestions
-- ============================================================================

create or replace function public.create_languoid_link_suggestions(
  p_languoid_id uuid,
  p_profile_id uuid,
  p_max_suggestions integer default 5
)
returns integer
language plpgsql
security definer
set search_path = public, pg_trgm
as $$
declare
  v_languoid_name text;
  v_suggestion_count integer := 0;
  v_match record;
begin
  -- Get the user-created languoid name
  select name into v_languoid_name
  from public.languoid
  where id = p_languoid_id
    and active = true;
  
  -- If languoid not found or has no name, return
  if v_languoid_name is null or trim(v_languoid_name) = '' then
    return 0;
  end if;
  
  -- Find matching languoids using both search_languoids (exact/substring) and trigram similarity (fuzzy)
  -- Combine results from both methods, prioritizing exact matches, then fuzzy matches
  for v_match in
    (
      -- First, get exact/substring matches from search_languoids
      select 
        s.id as suggested_id,
        s.name as suggested_name,
        s.matched_alias_name,
        s.matched_alias_type,
        s.iso_code,
        s.search_rank
      from public.search_languoids(v_languoid_name, p_max_suggestions * 2, false) s
      where s.id != p_languoid_id
        -- Exclude languoids also created by this user
        and s.id not in (
          select l.id from public.languoid l 
          where l.creator_id = p_profile_id
        )
        -- Exclude already suggested matches
        and s.id not in (
          select suggested_languoid_id 
          from public.languoid_link_suggestion 
          where languoid_id = p_languoid_id
        )
    )
    union
    (
      -- Then, get fuzzy matches using trigram similarity (for typos/misspellings)
      select distinct on (l.id)
        l.id as suggested_id,
        l.name as suggested_name,
        null::text as matched_alias_name,
        null::text as matched_alias_type,
        ls.unique_identifier as iso_code,
        -- Use similarity score as rank (higher = better match)
        -- Rank 4-6 for fuzzy matches (exact matches are 1-3)
        case
          when similarity(lower(l.name), lower(v_languoid_name)) >= 0.5 then 4  -- High similarity
          when similarity(lower(l.name), lower(v_languoid_name)) >= 0.4 then 5  -- Medium similarity
          else 6  -- Lower similarity
        end as search_rank
      from public.languoid l
      left join public.languoid_source ls 
        on ls.languoid_id = l.id 
        and lower(ls.name) = 'iso639-3'
        and ls.active = true
      where l.active = true
        and l.id != p_languoid_id
        -- Exclude languoids created by this user
        and (l.creator_id is null or l.creator_id != p_profile_id)
        -- Only include fuzzy matches with reasonable similarity (>= 0.3)
        and similarity(lower(l.name), lower(v_languoid_name)) >= 0.3
        -- Exclude already suggested matches
        and l.id not in (
          select suggested_languoid_id
          from public.languoid_link_suggestion 
          where languoid_id = p_languoid_id
        )
        -- Exclude matches already found by search_languoids
        and l.id not in (
          select s.id
          from public.search_languoids(v_languoid_name, p_max_suggestions * 2, false) s
        )
      order by l.id, similarity(lower(l.name), lower(v_languoid_name)) desc
    )
    order by search_rank, suggested_name
    limit p_max_suggestions
  loop
    -- Insert the suggestion
    insert into public.languoid_link_suggestion (
      languoid_id,
      suggested_languoid_id,
      profile_id,
      match_rank,
      matched_on,
      matched_value,
      status,
      active
    ) values (
      p_languoid_id,
      v_match.suggested_id::uuid,
      p_profile_id,
      v_match.search_rank,
      case 
        when v_match.matched_alias_name is not null then 'alias'
        when v_match.iso_code is not null then 'iso_code'
        else 'name'
      end,
      coalesce(v_match.matched_alias_name, v_match.iso_code, v_match.suggested_name),
      'pending',
      true
    )
    on conflict (languoid_id, suggested_languoid_id) do nothing;
    
    v_suggestion_count := v_suggestion_count + 1;
  end loop;
  
  return v_suggestion_count;
end;
$$;

-- Grant execute permission
grant execute on function public.create_languoid_link_suggestions(uuid, uuid, integer) 
  to authenticated;

-- ============================================================================
-- 5. Create trigger function to automatically suggest links
-- ============================================================================
-- This trigger fires when a user-created languoid is inserted or updated

create or replace function public.trigger_suggest_languoid_links()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Only process user-created languoids (creator_id is not null)
  -- and only when the languoid has a name
  if new.creator_id is not null 
     and new.name is not null 
     and trim(new.name) != ''
     and new.active = true then
    
    -- Create suggestions asynchronously (don't block the insert)
    perform public.create_languoid_link_suggestions(
      new.id,
      new.creator_id,
      5  -- Max 5 suggestions per languoid
    );
  end if;
  
  return new;
end;
$$;

-- Drop existing trigger if it exists
drop trigger if exists suggest_languoid_links_trigger on public.languoid;

-- Create the trigger
create trigger suggest_languoid_links_trigger
  after insert on public.languoid
  for each row
  execute function public.trigger_suggest_languoid_links();

-- ============================================================================
-- 6. Create function to accept a languoid link suggestion
-- ============================================================================
-- When a user accepts a suggestion, this function:
-- 1. Updates all references from languoid to suggested_languoid
-- 2. Marks the user languoid as inactive
-- 3. Updates the suggestion status

create or replace function public.accept_languoid_link_suggestion(
  p_suggestion_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_suggestion record;
  v_user_id uuid;
begin
  -- Get current user
  v_user_id := auth.uid();
  
  -- Get the suggestion
  select * into v_suggestion
  from public.languoid_link_suggestion
  where id = p_suggestion_id
    and profile_id = v_user_id
    and status = 'pending'
    and active = true;
  
  if v_suggestion is null then
    raise exception 'Suggestion not found or not authorized';
  end if;
  
  -- Update project_language_link references
  update public.project_language_link
  set languoid_id = v_suggestion.suggested_languoid_id,
      last_updated = now()
  where languoid_id = v_suggestion.languoid_id;
  
  -- Update profile ui_languoid_id if it references the user languoid
  update public.profile
  set ui_languoid_id = v_suggestion.suggested_languoid_id,
      last_updated = now()
  where ui_languoid_id = v_suggestion.languoid_id;
  
  -- Mark the user-created languoid as inactive
  update public.languoid
  set active = false,
      last_updated = now()
  where id = v_suggestion.languoid_id
    and creator_id = v_user_id;
  
  -- Update the suggestion status
  update public.languoid_link_suggestion
  set status = 'accepted',
      last_updated = now()
  where id = p_suggestion_id;
  
  -- Withdraw all other pending suggestions for this user languoid
  update public.languoid_link_suggestion
  set status = 'withdrawn',
      last_updated = now()
  where languoid_id = v_suggestion.languoid_id
    and id != p_suggestion_id
    and status = 'pending';
  
  return true;
end;
$$;

-- Grant execute permission
grant execute on function public.accept_languoid_link_suggestion(uuid) 
  to authenticated;

-- ============================================================================
-- 7. Create function to reject/dismiss a suggestion
-- ============================================================================

create or replace function public.reject_languoid_link_suggestion(
  p_suggestion_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  -- Get current user
  v_user_id := auth.uid();
  
  -- Update the suggestion status to 'declined' (matches constants.ts)
  update public.languoid_link_suggestion
  set status = 'declined',
      last_updated = now()
  where id = p_suggestion_id
    and profile_id = v_user_id
    and status = 'pending'
    and active = true;
  
  if not found then
    raise exception 'Suggestion not found or not authorized';
  end if;
  
  return true;
end;
$$;

-- Grant execute permission
grant execute on function public.reject_languoid_link_suggestion(uuid) 
  to authenticated;

-- ============================================================================
-- 8. Create function to dismiss all suggestions for a languoid
-- ============================================================================
-- Called when user decides to keep their custom languoid

create or replace function public.keep_custom_languoid(
  p_languoid_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  -- Get current user
  v_user_id := auth.uid();
  
  -- Verify the user owns this languoid
  if not exists (
    select 1 from public.languoid 
    where id = p_languoid_id 
      and creator_id = v_user_id
      and active = true
  ) then
    raise exception 'Languoid not found or not authorized';
  end if;
  
  -- Withdraw all pending suggestions for this languoid (matches constants.ts)
  update public.languoid_link_suggestion
  set status = 'withdrawn',
      last_updated = now()
  where languoid_id = p_languoid_id
    and profile_id = v_user_id
    and status = 'pending';
  
  return true;
end;
$$;

-- Grant execute permission
grant execute on function public.keep_custom_languoid(uuid) 
  to authenticated;

-- ============================================================================
-- 9. Add sync rule for languoid_link_suggestion
-- ============================================================================
-- Note: This needs to be added to sync-rules.yml manually
-- The table will be synced via the user_profile bucket based on profile_id

-- ============================================================================
-- 10. Create helper view for pending suggestions with languoid details
-- ============================================================================

create or replace view public.pending_languoid_link_suggestions as
select 
  lls.id as suggestion_id,
  lls.languoid_id,
  ul.name as languoid_name,
  lls.suggested_languoid_id,
  sl.name as suggested_languoid_name,
  sl.level as suggested_languoid_level,
  sl.ui_ready as suggested_languoid_ui_ready,
  lls.match_rank,
  lls.matched_on,
  lls.matched_value,
  lls.profile_id,
  lls.created_at,
  -- Get ISO code for suggested languoid
  (
    select ls.unique_identifier 
    from public.languoid_source ls 
    where ls.languoid_id = sl.id 
      and lower(ls.name) = 'iso639-3'
      and ls.active = true
    limit 1
  ) as suggested_iso_code
from public.languoid_link_suggestion lls
inner join public.languoid ul on ul.id = lls.languoid_id
inner join public.languoid sl on sl.id = lls.suggested_languoid_id
where lls.status = 'pending'
  and lls.active = true
  and ul.active = true
  and sl.active = true;

comment on view public.pending_languoid_link_suggestions is 
  'View showing pending languoid link suggestions with full languoid details.';

-- Grant access to the view
grant select on public.pending_languoid_link_suggestions to authenticated;

