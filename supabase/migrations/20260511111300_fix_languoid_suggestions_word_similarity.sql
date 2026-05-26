-- ============================================================================
-- Migration: Improve Languoid Suggestions Ranking with word_similarity
-- ============================================================================
--
-- PURPOSE:
-- Fixes languoid link suggestions to prioritize project name matches over
-- languoid name fuzzy matches. Uses pg_trgm word_similarity for better
-- matching when user creates names like "Modern English 2".
--
-- CHANGES:
-- - Uses word_similarity for project names to find languoids whose names
--   are contained within project names (e.g., "Being Santhali" → "Santhali")
-- - Project name matches rank 1-4 (highest priority)
-- - Adds word_similarity for languoid names (e.g., "Modern English 3" → "Modern English")
-- - Languoid name word_similarity matches rank 5-7
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

  -- Get project names associated with this languoid through project_language_link
  -- Project names are PRIORITIZED - they more likely contain the real language name
  select array_agg(distinct p.name order by p.name)
  into v_project_names
  from public.project_language_link pll
  inner join public.project p on p.id = pll.project_id
  where pll.languoid_id = p_languoid_id
    and p.active = true;

  -- Build array of search terms: PROJECT NAMES FIRST (higher priority), then languoid name
  v_all_search_terms := '{}'::text[];

  -- Add project names first (will be searched for rank 1-3 matches)
  if v_project_names is not null then
    v_all_search_terms := v_all_search_terms || v_project_names;
  end if;

  -- Add languoid name last (will use word_similarity for rank 4-6 matches)
  v_all_search_terms := v_all_search_terms || array[v_languoid_name];

  -- Create a temporary table to hold all potential matches with their best rank
  create temporary table temp_suggestions (
    suggested_id uuid,
    suggested_name text,
    matched_alias_name text,
    matched_alias_type text,
    iso_code text,
    search_rank integer,
    search_term text,
    is_project_match boolean,
    match_source text  -- 'exact' or 'similarity'
  ) on commit drop;

  -- ========================================================================
  -- PHASE 1: Project names - word_similarity matches (ranks 1-3)
  -- ========================================================================
  -- NOTE: search_languoids looks for languoid names CONTAINING the search term.
  -- But project names like "Being Santhali" won't match "Santhali" that way.
  -- We use word_similarity to find languoid names that are SUBSTRINGS of project names.
  if v_project_names is not null then
    -- Use word_similarity to find languoids whose names match words in project names
    -- word_similarity('Santhali', 'Being Santhali') is high because "Santhali" is in the project name
    insert into temp_suggestions (
      suggested_id,
      suggested_name,
      matched_alias_name,
      matched_alias_type,
      iso_code,
      search_rank,
      search_term,
      is_project_match,
      match_source
    )
    select distinct on (l.id)
      l.id as suggested_id,
      l.name as suggested_name,
      null::text as matched_alias_name,
      null::text as matched_alias_type,
      ls.unique_identifier as iso_code,
      -- Rank based on word_similarity: project name matches get highest priority (ranks 1-3)
      case
        when max(word_similarity(lower(l.name), lower(pn.name))) >= 0.7 then 1
        when max(word_similarity(lower(l.name), lower(pn.name))) >= 0.5 then 2
        when max(word_similarity(lower(l.name), lower(pn.name))) >= 0.3 then 3
        else null
      end as search_rank,
      (array_agg(pn.name order by word_similarity(lower(l.name), lower(pn.name)) desc))[1] as search_term,
      true as is_project_match,
      'project_similarity' as match_source
    from public.languoid l
    cross join unnest(v_project_names) as pn(name)
    left join public.languoid_source ls
      on ls.languoid_id = l.id
      and lower(ls.name) = 'iso639-3'
      and ls.active = true
    where l.active = true
      and l.id != p_languoid_id
      and (l.creator_id is null or l.creator_id != p_profile_id)
      -- Only include matches where the languoid name has good word similarity to the project name
      and word_similarity(lower(l.name), lower(pn.name)) >= 0.3
    group by l.id, l.name, ls.unique_identifier
    having max(word_similarity(lower(l.name), lower(pn.name))) >= 0.3;

    -- Also check project name similarity against languoid aliases
    insert into temp_suggestions (
      suggested_id,
      suggested_name,
      matched_alias_name,
      matched_alias_type,
      iso_code,
      search_rank,
      search_term,
      is_project_match,
      match_source
    )
    select distinct on (l.id)
      l.id as suggested_id,
      l.name as suggested_name,
      la.name as matched_alias_name,
      la.alias_type::text as matched_alias_type,
      ls.unique_identifier as iso_code,
      -- Rank alias matches slightly lower than direct name matches
      case
        when max(word_similarity(lower(la.name), lower(pn.name))) >= 0.7 then 2
        when max(word_similarity(lower(la.name), lower(pn.name))) >= 0.5 then 3
        when max(word_similarity(lower(la.name), lower(pn.name))) >= 0.3 then 4
        else null
      end as search_rank,
      (array_agg(pn.name order by word_similarity(lower(la.name), lower(pn.name)) desc))[1] as search_term,
      true as is_project_match,
      'project_alias_similarity' as match_source
    from public.languoid l
    inner join public.languoid_alias la on la.subject_languoid_id = l.id and la.active = true
    cross join unnest(v_project_names) as pn(name)
    left join public.languoid_source ls
      on ls.languoid_id = l.id
      and lower(ls.name) = 'iso639-3'
      and ls.active = true
    where l.active = true
      and l.id != p_languoid_id
      and (l.creator_id is null or l.creator_id != p_profile_id)
      and word_similarity(lower(la.name), lower(pn.name)) >= 0.3
      -- Exclude languoids already found
      and l.id not in (
        select ts.suggested_id from temp_suggestions ts where ts.suggested_id is not null
      )
    group by l.id, l.name, la.name, la.alias_type, ls.unique_identifier
    having max(word_similarity(lower(la.name), lower(pn.name))) >= 0.3;
  end if;

  -- ========================================================================
  -- PHASE 2: Languoid name - word_similarity matches (ranks 5-7)
  -- ========================================================================
  -- Use word_similarity to catch cases like "Modern English 2" → "Modern English"
  -- word_similarity ignores extra words, so "Modern English 2" matches "Modern English" well
  insert into temp_suggestions (
    suggested_id,
    suggested_name,
    matched_alias_name,
    matched_alias_type,
    iso_code,
    search_rank,
    search_term,
    is_project_match,
    match_source
  )
  select distinct on (l.id)
    l.id as suggested_id,
    l.name as suggested_name,
    null::text as matched_alias_name,
    null::text as matched_alias_type,
    ls.unique_identifier as iso_code,
    -- Rank based on word_similarity score (after project name matches)
    case
      when word_similarity(lower(l.name), lower(v_languoid_name)) >= 0.7 then 5
      when word_similarity(lower(l.name), lower(v_languoid_name)) >= 0.5 then 6
      when word_similarity(lower(l.name), lower(v_languoid_name)) >= 0.3 then 7
      else null  -- Will be filtered out
    end as search_rank,
    v_languoid_name as search_term,
    false as is_project_match,
    'similarity' as match_source
  from public.languoid l
  left join public.languoid_source ls
    on ls.languoid_id = l.id
    and lower(ls.name) = 'iso639-3'
    and ls.active = true
  where l.active = true
    and l.id != p_languoid_id
    -- Exclude languoids created by this user
    and (l.creator_id is null or l.creator_id != p_profile_id)
    -- Only include matches with reasonable word_similarity (catches "Modern English 2" → "Modern English")
    and word_similarity(lower(l.name), lower(v_languoid_name)) >= 0.3
    -- Exclude matches already found by project name search
    and l.id not in (
      select ts.suggested_id from temp_suggestions ts where ts.suggested_id is not null
    );

  -- Also check aliases with word_similarity (for cases where user types a variant)
  insert into temp_suggestions (
    suggested_id,
    suggested_name,
    matched_alias_name,
    matched_alias_type,
    iso_code,
    search_rank,
    search_term,
    is_project_match,
    match_source
  )
  select distinct on (l.id)
    l.id as suggested_id,
    l.name as suggested_name,
    la.name as matched_alias_name,
    la.alias_type::text as matched_alias_type,
    ls.unique_identifier as iso_code,
    -- Rank alias matches lower than direct name matches (after languoid name similarity)
    case
      when word_similarity(lower(la.name), lower(v_languoid_name)) >= 0.7 then 8
      when word_similarity(lower(la.name), lower(v_languoid_name)) >= 0.5 then 9
      when word_similarity(lower(la.name), lower(v_languoid_name)) >= 0.3 then 10
      else null
    end as search_rank,
    v_languoid_name as search_term,
    false as is_project_match,
    'similarity_alias' as match_source
  from public.languoid l
  inner join public.languoid_alias la on la.subject_languoid_id = l.id and la.active = true
  left join public.languoid_source ls
    on ls.languoid_id = l.id
    and lower(ls.name) = 'iso639-3'
    and ls.active = true
  where l.active = true
    and l.id != p_languoid_id
    and (l.creator_id is null or l.creator_id != p_profile_id)
    and word_similarity(lower(la.name), lower(v_languoid_name)) >= 0.3
    -- Exclude languoids already found
    and l.id not in (
      select ts.suggested_id from temp_suggestions ts where ts.suggested_id is not null
    );

  -- Insert the best-ranked suggestions (deduplicated by suggested_id)
  for v_match in
    select distinct on (suggested_id)
      suggested_id,
      suggested_name,
      matched_alias_name,
      matched_alias_type,
      iso_code,
      search_rank,
      match_source
    from temp_suggestions
    where search_rank is not null
      -- Exclude already suggested matches
      and suggested_id not in (
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
        when v_match.match_source = 'similarity' then 'name'
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
-- 2. Add comment explaining the improved functionality
-- ============================================================================

comment on function public.create_languoid_link_suggestions is
  'Creates suggestions for linking user-created languoids to existing languoids. '
  'Uses word_similarity to match project names (ranks 1-4) since they typically '
  'contain the actual language name (e.g., "Being Santhali" → "Santhali"). '
  'Also uses word_similarity on languoid names for cases like '
  '"Modern English 3" → "Modern English" (ranks 5-10). '
  'Uses pg_trgm word_similarity to handle extra words gracefully.';

-- ============================================================================
-- 3. Ensure pg_trgm extension is available (idempotent)
-- ============================================================================

-- pg_trgm should already be enabled from previous migrations, but ensure it exists
create extension if not exists pg_trgm;
