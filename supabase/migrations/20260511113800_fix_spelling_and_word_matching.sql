-- ============================================================================
-- Migration: Fix Spelling Variations and Multi-Word Matching
-- ============================================================================
--
-- PURPOSE:
-- Fixes two issues with languoid link suggestions:
-- 1. Spelling variations like "Santhani" vs "Santhali" not caught by <% operator
-- 2. "Modern Duoxu" matching "modern english 5" because only "Modern" matched
--
-- CHANGES:
-- - Use similarity() >= 0.4 for project names to catch spelling variations
-- - For languoid names: extract individual words and check if they're contained
--   in existing languoid names (e.g., "English" from "modern english 5" → "Modern English")
-- - Require meaningful word overlap for languoid name matching
--
-- ============================================================================

-- ============================================================================
-- 1. Update create_languoid_link_suggestions with smarter matching
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
  v_languoid_words text[];
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

  -- Extract individual words from languoid name (for word-level matching)
  -- Filter out single characters and numbers
  select array_agg(word order by length(word) desc)
  into v_languoid_words
  from (
    select distinct regexp_split_to_table(lower(trim(v_languoid_name)), '\s+') as word
  ) w
  where length(word) >= 2
    and word !~ '^[0-9]+$';  -- Exclude pure numbers

  -- Get project names associated with this languoid
  select array_agg(distinct p.name order by p.name)
  into v_project_names
  from public.project_language_link pll
  inner join public.project p on p.id = pll.project_id
  where pll.languoid_id = p_languoid_id
    and p.active = true;

  -- Create temp table for suggestions
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
  -- PHASE 1: Project names - similarity matching (ranks 1-3)
  -- ========================================================================
  -- Use similarity() to catch spelling variations like "Santhani" vs "Santhali"
  if v_project_names is not null then
    insert into temp_suggestions (
      suggested_id, suggested_name, matched_alias_name, matched_alias_type,
      iso_code, search_rank, search_term, is_project_match, match_source
    )
    select distinct on (l.id)
      l.id, l.name, null::text, null::text, ls.unique_identifier,
      case
        when max(similarity(lower(l.name), lower(pn.name))) >= 0.6 then 1
        when max(similarity(lower(l.name), lower(pn.name))) >= 0.4 then 2
        else 3
      end,
      (array_agg(pn.name order by similarity(lower(l.name), lower(pn.name)) desc))[1],
      true,
      'project_similarity'
    from public.languoid l
    cross join unnest(v_project_names) as pn(name)
    left join public.languoid_source ls
      on ls.languoid_id = l.id and lower(ls.name) = 'iso639-3' and ls.active = true
    where l.active = true
      and l.id != p_languoid_id
      and (l.creator_id is null or l.creator_id != p_profile_id)
      -- Use similarity for spelling variations (>= 0.4 catches "Santhani" ~ "Santhali")
      and similarity(lower(l.name), lower(pn.name)) >= 0.4
    group by l.id, l.name, ls.unique_identifier;

    -- Also check project name similarity against aliases
    insert into temp_suggestions (
      suggested_id, suggested_name, matched_alias_name, matched_alias_type,
      iso_code, search_rank, search_term, is_project_match, match_source
    )
    select distinct on (l.id)
      l.id, l.name, la.name, la.alias_type::text, ls.unique_identifier,
      case
        when max(similarity(lower(la.name), lower(pn.name))) >= 0.6 then 2
        when max(similarity(lower(la.name), lower(pn.name))) >= 0.4 then 3
        else 4
      end,
      (array_agg(pn.name order by similarity(lower(la.name), lower(pn.name)) desc))[1],
      true,
      'project_alias_similarity'
    from public.languoid l
    inner join public.languoid_alias la on la.subject_languoid_id = l.id and la.active = true
    cross join unnest(v_project_names) as pn(name)
    left join public.languoid_source ls
      on ls.languoid_id = l.id and lower(ls.name) = 'iso639-3' and ls.active = true
    where l.active = true
      and l.id != p_languoid_id
      and (l.creator_id is null or l.creator_id != p_profile_id)
      and similarity(lower(la.name), lower(pn.name)) >= 0.4
      and l.id not in (select ts.suggested_id from temp_suggestions ts where ts.suggested_id is not null)
    group by l.id, l.name, la.name, la.alias_type, ls.unique_identifier;
  end if;

  -- ========================================================================
  -- PHASE 2: Word-level containment from languoid name (ranks 4-6)
  -- ========================================================================
  -- Check if words from user languoid name are contained in existing languoid names
  -- e.g., "English" from "modern english 5" contained in "Modern English"
  if v_languoid_words is not null and array_length(v_languoid_words, 1) > 0 then
    insert into temp_suggestions (
      suggested_id, suggested_name, matched_alias_name, matched_alias_type,
      iso_code, search_rank, search_term, is_project_match, match_source
    )
    select distinct on (l.id)
      l.id, l.name, null::text, null::text, ls.unique_identifier,
      case
        when count(distinct lw.word) >= 2 then 4  -- Multiple words match
        when max(similarity(lw.word, lower(l.name))) >= 0.6 then 5  -- Strong single word match
        else 6
      end,
      v_languoid_name,
      false,
      'word_containment'
    from public.languoid l
    cross join unnest(v_languoid_words) as lw(word)
    left join public.languoid_source ls
      on ls.languoid_id = l.id and lower(ls.name) = 'iso639-3' and ls.active = true
    where l.active = true
      and l.id != p_languoid_id
      and (l.creator_id is null or l.creator_id != p_profile_id)
      -- Check if word from user languoid is contained in existing languoid name
      and (lw.word <% lower(l.name) or similarity(lw.word, lower(l.name)) >= 0.5)
      -- Exclude already found
      and l.id not in (select ts.suggested_id from temp_suggestions ts where ts.suggested_id is not null)
    group by l.id, l.name, ls.unique_identifier
    having count(distinct lw.word) >= 1;  -- At least one word matches
  end if;

  -- ========================================================================
  -- PHASE 3: Full languoid name word_similarity (ranks 7-9)
  -- ========================================================================
  -- Fallback for overall phrase similarity
  insert into temp_suggestions (
    suggested_id, suggested_name, matched_alias_name, matched_alias_type,
    iso_code, search_rank, search_term, is_project_match, match_source
  )
  select distinct on (l.id)
    l.id, l.name, null::text, null::text, ls.unique_identifier,
    case
      when word_similarity(lower(l.name), lower(v_languoid_name)) >= 0.7 then 7
      when word_similarity(lower(l.name), lower(v_languoid_name)) >= 0.5 then 8
      when word_similarity(lower(l.name), lower(v_languoid_name)) >= 0.4 then 9
      else null
    end,
    v_languoid_name,
    false,
    'phrase_similarity'
  from public.languoid l
  left join public.languoid_source ls
    on ls.languoid_id = l.id and lower(ls.name) = 'iso639-3' and ls.active = true
  where l.active = true
    and l.id != p_languoid_id
    and (l.creator_id is null or l.creator_id != p_profile_id)
    and word_similarity(lower(l.name), lower(v_languoid_name)) >= 0.4
    and l.id not in (select ts.suggested_id from temp_suggestions ts where ts.suggested_id is not null);

  -- Insert final suggestions
  for v_match in
    select distinct on (suggested_id)
      suggested_id, suggested_name, matched_alias_name, matched_alias_type,
      iso_code, search_rank, match_source
    from temp_suggestions
    where search_rank is not null
      and suggested_id not in (
        select suggested_languoid_id from public.languoid_link_suggestion
        where languoid_id = p_languoid_id
      )
    order by suggested_id, search_rank, suggested_name
    limit p_max_suggestions
  loop
    insert into public.languoid_link_suggestion (
      languoid_id, suggested_languoid_id, profile_id, match_rank,
      matched_on, matched_value, status, active
    ) values (
      p_languoid_id, v_match.suggested_id::uuid, p_profile_id, v_match.search_rank,
      case
        when v_match.matched_alias_name is not null then 'alias'
        when v_match.iso_code is not null then 'iso_code'
        else 'name'
      end,
      coalesce(v_match.matched_alias_name, v_match.iso_code, v_match.suggested_name),
      'pending', true
    )
    on conflict (languoid_id, suggested_languoid_id) do nothing;

    v_suggestion_count := v_suggestion_count + 1;
  end loop;

  drop table if exists temp_suggestions;
  return v_suggestion_count;
end;
$$;

grant execute on function public.create_languoid_link_suggestions(uuid, uuid, integer)
  to authenticated;

comment on function public.create_languoid_link_suggestions is
  'Creates suggestions for linking user-created languoids to existing languoids. '
  'Uses similarity() for project names to catch spelling variations '
  '(e.g., "Santhani" ~ "Santhali"). '
  'Extracts individual words from languoid names and checks containment '
  '(e.g., "English" from "modern english 5" contained in "Modern English"). '
  'Falls back to word_similarity for phrase-level matching.';
