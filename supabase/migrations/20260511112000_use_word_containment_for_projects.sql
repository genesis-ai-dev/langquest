-- ============================================================================
-- Migration: Use Word Containment Operator for Project Name Matching
-- ============================================================================
--
-- PURPOSE:
-- Updates create_languoid_link_suggestions to use the pg_trgm <% (word
-- containment) operator for matching languoid names within project names.
-- The previous word_similarity approach calculated phrase similarity which
-- didn't correctly match 'Santhali' within 'Being Santhali'.
--
-- CHANGES:
-- - Replaces word_similarity with <% operator for project name matching
-- - <% returns true when left operand is a word contained in right operand
-- - E.g., 'Santhali' <% 'Being Santhali' = true
-- - Keeps word_similarity for languoid name fuzzy matching (Phase 2)
--
-- ============================================================================

-- ============================================================================
-- 1. Update the create_languoid_link_suggestions function with word containment
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

  -- Get project names associated with this languoid through project_language_link
  select array_agg(distinct p.name order by p.name)
  into v_project_names
  from public.project_language_link pll
  inner join public.project p on p.id = pll.project_id
  where pll.languoid_id = p_languoid_id
    and p.active = true;

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
    match_source text
  ) on commit drop;

  -- ========================================================================
  -- PHASE 1: Project names - word containment matches (ranks 1-4)
  -- ========================================================================
  -- Use the <% (word containment) operator to find languoids whose names
  -- appear as words within project names. This correctly matches:
  --   'Santhali' <% 'Being Santhali' = true
  --   'English' <% 'English Translation Project' = true
  if v_project_names is not null then
    -- Find languoid names contained within project names
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
      -- Rank based on similarity score for ordering
      case
        when max(similarity(lower(l.name), lower(pn.name))) >= 0.5 then 1
        when max(similarity(lower(l.name), lower(pn.name))) >= 0.3 then 2
        else 3
      end as search_rank,
      (array_agg(pn.name order by similarity(lower(l.name), lower(pn.name)) desc))[1] as search_term,
      true as is_project_match,
      'project_containment' as match_source
    from public.languoid l
    cross join unnest(v_project_names) as pn(name)
    left join public.languoid_source ls
      on ls.languoid_id = l.id
      and lower(ls.name) = 'iso639-3'
      and ls.active = true
    where l.active = true
      and l.id != p_languoid_id
      and (l.creator_id is null or l.creator_id != p_profile_id)
      -- Use <% operator: true when l.name is a word contained within pn.name
      and lower(l.name) <% lower(pn.name)
    group by l.id, l.name, ls.unique_identifier;

    -- Also check project name containment against languoid aliases
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
        when max(similarity(lower(la.name), lower(pn.name))) >= 0.5 then 2
        when max(similarity(lower(la.name), lower(pn.name))) >= 0.3 then 3
        else 4
      end as search_rank,
      (array_agg(pn.name order by similarity(lower(la.name), lower(pn.name)) desc))[1] as search_term,
      true as is_project_match,
      'project_alias_containment' as match_source
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
      -- Use <% operator for word containment
      and lower(la.name) <% lower(pn.name)
      -- Exclude languoids already found
      and l.id not in (
        select ts.suggested_id from temp_suggestions ts where ts.suggested_id is not null
      )
    group by l.id, l.name, la.name, la.alias_type, ls.unique_identifier;
  end if;

  -- ========================================================================
  -- PHASE 2: Languoid name - word_similarity matches (ranks 5-7)
  -- ========================================================================
  -- Use word_similarity to catch cases like "Modern English 3" → "Modern English"
  -- word_similarity ignores extra words, so "Modern English 3" matches "Modern English" well
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
    -- Only include matches with reasonable word_similarity
    and word_similarity(lower(l.name), lower(v_languoid_name)) >= 0.3
    -- Exclude matches already found by project name search
    and l.id not in (
      select ts.suggested_id from temp_suggestions ts where ts.suggested_id is not null
    );

  -- Also check aliases with word_similarity
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
    -- Rank alias matches lower than direct name matches
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
-- 2. Update function comment
-- ============================================================================

comment on function public.create_languoid_link_suggestions is
  'Creates suggestions for linking user-created languoids to existing languoids. '
  'Uses <% (word containment) operator for project names (ranks 1-4) to find '
  'languoid names that appear as words within project names '
  '(e.g., "Santhali" <% "Being Santhali" = true). '
  'Also uses word_similarity on languoid names for cases like '
  '"Modern English 3" → "Modern English" (ranks 5-10).';
