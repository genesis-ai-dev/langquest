-- ============================================================================
-- Migration: Fix Word Containment Check for Languoid Name Matching
-- ============================================================================
--
-- PURPOSE:
-- Fixes the word-level containment check that was using similarity() instead
-- of the <% operator. similarity('english', 'modern duoxu') gives poor results,
-- but 'english' <% 'modern english' correctly returns true.
--
-- CHANGES:
-- - Replace similarity(word, full_name) with word <% lower(l.name)
-- - This correctly checks if extracted words are contained in languoid names
-- - e.g., 'english' <% 'modern english' = true, 'english' <% 'modern duoxu' = false
--
-- ============================================================================

-- ============================================================================
-- 1. Fix create_languoid_link_suggestions with correct word containment
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

  if v_languoid_name is null or trim(v_languoid_name) = '' then
    return 0;
  end if;

  -- Extract words from languoid name (filter out short words and numbers)
  select array_agg(word order by length(word) desc)
  into v_languoid_words
  from (
    select distinct regexp_split_to_table(lower(trim(v_languoid_name)), '\s+') as word
  ) w
  where length(word) >= 2
    and word !~ '^[0-9]+$';

  -- Get project names
  select array_agg(distinct p.name order by p.name)
  into v_project_names
  from public.project_language_link pll
  inner join public.project p on p.id = pll.project_id
  where pll.languoid_id = p_languoid_id
    and p.active = true;

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
  -- PHASE 1: Project name similarity (ranks 1-3)
  -- ========================================================================
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
      and similarity(lower(l.name), lower(pn.name)) >= 0.4
    group by l.id, l.name, ls.unique_identifier;
  end if;

  -- ========================================================================
  -- PHASE 2: Word-level containment (ranks 4-6)
  -- ========================================================================
  -- FIXED: Use <% operator to check if word is contained in languoid name
  if v_languoid_words is not null and array_length(v_languoid_words, 1) > 0 then
    insert into temp_suggestions (
      suggested_id, suggested_name, matched_alias_name, matched_alias_type,
      iso_code, search_rank, search_term, is_project_match, match_source
    )
    select distinct on (l.id)
      l.id, l.name, null::text, null::text, ls.unique_identifier,
      case
        -- Rank 4: 2+ words contained (e.g., "modern" + "english" in "Modern English")
        when count(distinct lw.word) filter (where lw.word <% lower(l.name)) >= 2 then 4
        -- Rank 5: 1 word contained with good similarity to full name
        when max(similarity(lower(l.name), lower(v_languoid_name))) >= 0.5 then 5
        -- Rank 6: 1 word contained but lower overall similarity
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
      -- FIXED: Use <% for word containment check
      and lw.word <% lower(l.name)
      -- Exclude already found
      and l.id not in (select ts.suggested_id from temp_suggestions ts where ts.suggested_id is not null)
    group by l.id, l.name, ls.unique_identifier, v_languoid_name
    -- Require at least one word to be contained
    having count(distinct lw.word) filter (where lw.word <% lower(l.name)) >= 1;
  end if;

  -- ========================================================================
  -- PHASE 3: Full phrase word_similarity fallback (ranks 7-9)
  -- ========================================================================
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
  'Phase 1: Project name similarity for spelling variations. '
  'Phase 2: Word-level containment using <% operator (e.g., "english" <% "modern english"). '
  'Phase 3: Full phrase word_similarity as fallback.';
