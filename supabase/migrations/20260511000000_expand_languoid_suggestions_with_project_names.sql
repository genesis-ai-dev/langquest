-- ============================================================================
-- Migration: Expand Languoid Suggestions to Include Project Names
-- ============================================================================
--
-- PURPOSE:
-- Updates the create_languoid_link_suggestions function to also search
-- project names when finding matches. This addresses the issue where users
-- create projects with language names in the title (e.g., "Santhali OMT Bible")
-- but select generic languages like "English".
--
-- CHANGES:
-- - Modified create_languoid_link_suggestions() to JOIN against
--   project_language_link and project tables to get associated project names
-- - Project name matches are ranked 4-6 (below languoid name matches 1-3)
-- - Results are deduplicated, keeping the best match rank per suggested languoid
--
-- ============================================================================

-- ============================================================================
-- 1. Update the create_languoid_link_suggestions function
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
  v_project_names text[];
  v_all_search_terms text[];
  v_suggestion_count integer := 0;
  v_match record;
  v_term text;
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

  -- Build array of search terms: languoid name first, then project names
  -- Languoid name gets priority (will be searched first for rank 1-3 matches)
  v_all_search_terms := array[v_languoid_name];

  -- Get project names associated with this languoid through project_language_link
  select array_agg(distinct p.name order by p.name)
  into v_project_names
  from public.project_language_link pll
  inner join public.project p on p.id = pll.project_id
  where pll.languoid_id = p_languoid_id
    and p.active = true;

  -- Add project names to search terms (for rank 4-6 matches)
  if v_project_names is not null then
    v_all_search_terms := v_all_search_terms || v_project_names;
  end if;

  -- Create a temporary table to hold all potential matches with their best rank
  create temporary table temp_suggestions (
    suggested_id uuid,
    suggested_name text,
    matched_alias_name text,
    matched_alias_type text,
    iso_code text,
    search_rank integer,
    search_term text,
    is_project_match boolean
  ) on commit drop;

  -- Search for each term and collect matches
  foreach v_term in array v_all_search_terms loop
    -- Skip empty terms
    if trim(v_term) = '' then
      continue;
    end if;

    -- Insert exact/substring matches from search_languoids
    insert into temp_suggestions (
      suggested_id,
      suggested_name,
      matched_alias_name,
      matched_alias_type,
      iso_code,
      search_rank,
      search_term,
      is_project_match
    )
    select
      s.id as suggested_id,
      s.name as suggested_name,
      s.matched_alias_name,
      s.matched_alias_type,
      s.iso_code,
      -- Rank based on whether this is the languoid name (first term) or project name
      case
        when v_term = v_languoid_name then s.search_rank  -- 1-3 for languoid name
        else s.search_rank + 3  -- 4-6 for project names
      end as search_rank,
      v_term as search_term,
      v_term != v_languoid_name as is_project_match
    from public.search_languoids(v_term, p_max_suggestions * 2, false) s
    where s.id != p_languoid_id
      -- Exclude languoids also created by this user
      and s.id not in (
        select l.id from public.languoid l
        where l.creator_id = p_profile_id
      );

    -- Insert fuzzy matches using trigram similarity (for typos/misspellings)
    insert into temp_suggestions (
      suggested_id,
      suggested_name,
      matched_alias_name,
      matched_alias_type,
      iso_code,
      search_rank,
      search_term,
      is_project_match
    )
    select distinct on (l.id)
      l.id as suggested_id,
      l.name as suggested_name,
      null::text as matched_alias_name,
      null::text as matched_alias_type,
      ls.unique_identifier as iso_code,
      -- Rank based on similarity and whether this is languoid name or project name
      case
        when v_term = v_languoid_name then
          case
            when similarity(lower(l.name), lower(v_term)) >= 0.5 then 4
            when similarity(lower(l.name), lower(v_term)) >= 0.4 then 5
            else 6
          end
        else
          case
            when similarity(lower(l.name), lower(v_term)) >= 0.5 then 7
            when similarity(lower(l.name), lower(v_term)) >= 0.4 then 8
            else 9
          end
      end as search_rank,
      v_term as search_term,
      v_term != v_languoid_name as is_project_match
    from public.languoid l
    left join public.languoid_source ls
      on ls.languoid_id = l.id
      and lower(ls.name) = 'iso639-3'
      and ls.active = true
    where l.active = true
      and l.id != p_languoid_id
      -- Exclude languoids created by this user
      and (l.creator_id is null or l.creator_id != p_profile_id)
      -- Only include fuzzy matches with reasonable similarity
      and similarity(lower(l.name), lower(v_term)) >= 0.3
      -- Exclude matches already found by search_languoids for this term
      and l.id not in (
        select s.id from public.search_languoids(v_term, p_max_suggestions * 2, false) s
      );
  end loop;

  -- Insert the best-ranked suggestions (deduplicated by suggested_id)
  for v_match in
    select distinct on (suggested_id)
      suggested_id,
      suggested_name,
      matched_alias_name,
      matched_alias_type,
      iso_code,
      search_rank
    from temp_suggestions
    -- Exclude already suggested matches
    where suggested_id not in (
      select suggested_languoid_id
      from public.languoid_link_suggestion
      where languoid_id = p_languoid_id
    )
    order by suggested_id, search_rank, suggested_name
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

  -- Clean up temporary table
  drop table if exists temp_suggestions;

  return v_suggestion_count;
end;
$$;

-- Grant execute permission
grant execute on function public.create_languoid_link_suggestions(uuid, uuid, integer)
  to authenticated;

-- ============================================================================
-- 2. Add comment explaining the expanded functionality
-- ============================================================================

comment on function public.create_languoid_link_suggestions is
  'Creates suggestions for linking user-created languoids to existing languoids. '
  'Searches both the languoid name and associated project names to find matches. '
  'Languoid name matches are prioritized (ranks 1-6) over project name matches (ranks 4-9). ';

