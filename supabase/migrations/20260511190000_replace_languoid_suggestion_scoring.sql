-- ============================================================================
-- Migration: Languoid Suggestion Ranking — Behavioral Contract v5
-- ============================================================================
--
-- PURPOSE:
-- Replaces the prior heuristic-based create_languoid_link_suggestions function
-- with the deterministic scoring algorithm described in the v5 behavioral
-- contract.
--
-- ALGORITHM:
--   Step 1 — Word extraction (per name):
--     1. Split on  [\s()\[\]{}]+
--     2. Lowercase each token
--     3. Keep tokens with length >= 3 that are not purely numeric
--
--   Step 2 — Word match (per word w against a candidate field f):
--     - length(f) >= 4 AND length(w) >= 3
--     - Exact:    w <% lower(f) AND strict_word_similarity(w, lower(f)) >= 0.7
--                 → strength = 1.0
--     - Spelling: lev_sim(w, lower(f)) >= 0.7
--                 → strength = lev_sim
--                 where lev_sim = 1 - levenshtein(w, lower(f))
--                                 / greatest(length(w), length(lower(f)))
--     - The trigram `<%` / `%` operators serve only as the index-friendly
--       pre-filter on the cross join. The strength itself is computed from
--       Levenshtein because trigram similarity rewards shared substrings
--       rather than edit distance, so e.g. similarity('santhani','santali')
--       = 0.444 (below threshold) while lev_sim = 1 - 2/8 = 0.75 (correctly
--       identifies "santhani" as a 2-edit misspelling of "santali"), and
--       similarity('santhani','sani') = 0.555 (false positive) while
--       lev_sim = 1 - 4/8 = 0.5 (correctly demoted).
--     - The 0.7 threshold = "at most ~30% of the longer word changed". This
--       admits genuine variants (`santhali`/`santali` lev_sim 0.875,
--       `santhani`/`santali` 0.75, `pashto`/`pashtu` 0.83) and rejects
--       substring/sound-alike noise (`santhani`/`salani` 0.625,
--       `santhani`/`shani` 0.625, `santhali`/`thali` 0.625).
--
--   Step 3 — Per-(candidate, field) score:
--     - field_weight = 1.0 if field is the candidate's primary name, else 0.85
--     - per_word_value = 50 + 50 * (matched_project_words / total_project_words)
--     - PROJECT contribution = sum_over_distinct_project_words(
--           per_word_value * field_weight + strength * 5)
--     - USER contribution    = sum_over_distinct_user_words(
--           (30 + strength * 3) * field_weight)
--                            + multi_word_bonus
--           where multi_word_bonus = 40 (>=3), 20 (=2), 0 (else)
--     - score(candidate, field) = PROJECT + USER
--
--   Step 4 — Candidate ranking:
--     - score(candidate) = max over fields (primary + each alias)
--                          of score(candidate, field)
--     - Primary preferred over alias for ties.
--     - Drop candidates with score < 25.
--     - Order by score DESC, primary_name ASC.
--
-- "All things were made by him; and without him was not any thing made that
--  was made." — John 1:3 (KJV). Soli Deo gloria.
-- ============================================================================

create extension if not exists pg_trgm;
create extension if not exists fuzzystrmatch;

-- ----------------------------------------------------------------------------
-- 1. Functional trigram indexes on lower(name)
-- ----------------------------------------------------------------------------
-- The scoring function compares user/project words against lower(name). A
-- trigram index on lower(name) lets the planner serve `<%` and `%` lookups
-- via index scans during the cross join.
-- ----------------------------------------------------------------------------

create index if not exists idx_languoid_name_lower_trgm
  on public.languoid using gin (lower(name) gin_trgm_ops);

create index if not exists idx_languoid_alias_name_lower_trgm
  on public.languoid_alias using gin (lower(name) gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- 2. Helper: contract-compliant word extraction
-- ----------------------------------------------------------------------------

create or replace function public._languoid_extract_words(p_text text)
returns text[]
language sql
immutable
parallel safe
as $$
  -- 1. Lowercase
  -- 2. Replace ()[]{} with spaces (translate is faster than regex_replace)
  -- 3. Split on whitespace
  -- 4. Keep length >= 3 and not purely numeric
  select coalesce(array_agg(distinct word), '{}'::text[])
  from (
    select regexp_split_to_table(
      lower(translate(coalesce(p_text, ''), '()[]{}', '      ')),
      '\s+'
    ) as word
  ) tokens
  where length(word) >= 3
    and word !~ '^[0-9]+$';
$$;

comment on function public._languoid_extract_words(text) is
  'Extracts scoring words for the languoid suggestion ranking contract: '
  'splits on whitespace and bracket characters, lowercases, and keeps tokens '
  'of length >= 3 that are not purely numeric.';

-- ----------------------------------------------------------------------------
-- 3. create_languoid_link_suggestions — v5 scoring
-- ----------------------------------------------------------------------------

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
  v_user_words text[];
  v_project_words text[];
  v_total_project_words integer;
  v_suggestion_count integer := 0;
  v_position integer := 0;
  v_match record;
begin
  -- Fetch the user-created languoid name
  select name into v_languoid_name
  from public.languoid
  where id = p_languoid_id and active = true;

  if v_languoid_name is null or trim(v_languoid_name) = '' then
    return 0;
  end if;

  -- Step 1: extract user-name words and project-name words
  v_user_words := public._languoid_extract_words(v_languoid_name);

  with project_word_set as (
    select distinct word
    from public.project_language_link pll
    inner join public.project p on p.id = pll.project_id
    cross join lateral unnest(public._languoid_extract_words(p.name)) as t(word)
    where pll.languoid_id = p_languoid_id and p.active = true
  )
  select coalesce(array_agg(word), '{}'::text[])
  into v_project_words
  from project_word_set;

  v_total_project_words := coalesce(array_length(v_project_words, 1), 0);

  -- Nothing to score against
  if coalesce(array_length(v_user_words, 1), 0) = 0
     and v_total_project_words = 0 then
    return 0;
  end if;

  -- Steps 2–4: score every (candidate, field) pair, collapse to the candidate's
  -- best field, then return the top N candidates above the 25-point threshold.
  for v_match in
    with
      all_words as (
        select word, 'user'::text as source
        from unnest(v_user_words) as t(word)
        union all
        select word, 'project'::text as source
        from unnest(v_project_words) as t(word)
      ),
      candidates as (
        select l.id, l.name as primary_name
        from public.languoid l
        where l.active = true
          and l.id <> p_languoid_id
          and (l.creator_id is null or l.creator_id <> p_profile_id)
      ),
      -- One row per evaluable field: the candidate's primary name plus each
      -- distinct alias name. We deduplicate identical alias *names* on the
      -- same languoid (e.g., "Santali" appearing as both an endonym and an
      -- exonym), because the contract defines per_word_value and word counts
      -- in terms of distinct words and fields, not raw row counts. Without
      -- the DISTINCT, duplicated alias rows inflate project_count beyond
      -- total_project_words and produce per_word_value > 100.
      fields as (
        select
          c.id as candidate_id,
          c.primary_name,
          c.primary_name as field_text,
          'primary'::text as field_type,
          1.0::numeric as field_weight
        from candidates c
        where length(c.primary_name) >= 4
        union all
        select distinct
          c.id,
          c.primary_name,
          la.name,
          'alias'::text,
          0.85::numeric
        from candidates c
        inner join public.languoid_alias la
          on la.subject_languoid_id = c.id and la.active = true
          and not ('hhbib_lgcode' = any(la.source_names))
        where length(la.name) >= 4
      ),
      -- Step 2: per-(field, word, source) match strength.
      -- The trigram operators (`<%` / `%`) act ONLY as the index-friendly
      -- pre-filter on the cross join: if a candidate field shares no
      -- meaningful trigram overlap with the word, it never reaches the
      -- strength computation. Strength itself uses two paths:
      --   1. Exact-word path (via `<%` AND strict_word_similarity >= 0.7),
      --      strength = 1.0 — this is what makes "english" inside
      --      "Modern English" score as a perfect word match.
      --   2. Spelling path (via Levenshtein-similarity >= 0.7),
      --      strength = lev_sim — captures real typos / spelling variants
      --      ("santhani" → "santali") in a way trigram similarity cannot.
      --      The 0.7 floor allows up to ~30% of the longer word to change,
      --      which is enough for transliteration variants while excluding
      --      substring noise like ("santhali" → "thali", lev_sim 0.625).
      field_word_match as (
        select
          f.candidate_id,
          f.primary_name,
          f.field_type,
          f.field_text,
          f.field_weight,
          aw.word,
          aw.source,
          case
            when aw.word <% lower(f.field_text)
                 and strict_word_similarity(aw.word, lower(f.field_text)) >= 0.7
              then 1.0::numeric
            when ls.lev_sim >= 0.7
              then ls.lev_sim
            else null
          end as strength
        from fields f
        cross join all_words aw
        cross join lateral (
          -- Compute Levenshtein-similarity exactly once per row.
          -- `levenshtein` is hard-capped at 255 chars per arg; clip
          -- defensively so a pathological description-style alias never
          -- aborts the whole query.
          select
            case
              when length(aw.word) <= 255
                   and length(lower(f.field_text)) <= 255
                then 1.0
                     - levenshtein(aw.word, lower(f.field_text))::numeric
                     / greatest(length(aw.word), length(lower(f.field_text)))
              else 0::numeric
            end as lev_sim
        ) ls
        where length(aw.word) >= 3
          and (
            aw.word <% lower(f.field_text)
            or aw.word % lower(f.field_text)
          )
      ),
      -- Step 3a: per-(candidate, field) aggregates.
      -- A (field, word, source) tuple is unique by construction, so count(*)
      -- is equivalent to count(distinct word) here.
      field_aggregate as (
        select
          candidate_id,
          primary_name,
          field_type,
          field_text,
          field_weight,
          count(*) filter (where source = 'user') as user_count,
          coalesce(
            sum(30 + strength * 3) filter (where source = 'user'),
            0
          ) as user_word_base_sum,
          count(*) filter (where source = 'project') as project_count,
          coalesce(
            sum(strength * 5) filter (where source = 'project'),
            0
          ) as project_strength_bonus
        from field_word_match
        where strength is not null
        group by candidate_id, primary_name, field_type, field_text, field_weight
      ),
      -- Step 3b: collapse the formula into a single per-field score.
      --   project_score = project_count
      --                   * (50 + 50 * project_count / total_project_words)
      --                   * field_weight
      --                   + sum(strength * 5)
      --   user_score    = field_weight * sum(30 + strength * 3)
      --                   + multi_word_bonus(user_count)
      field_scored as (
        select
          candidate_id,
          primary_name,
          field_type,
          field_text,
          user_count,
          project_count,
          (
            case
              when v_total_project_words > 0 and project_count > 0 then
                project_count
                  * (50.0 + 50.0 * project_count / v_total_project_words)
                  * field_weight
                + project_strength_bonus
              else 0
            end
          ) + (
            field_weight * user_word_base_sum
          ) + (
            case
              when user_count >= 3 then 40
              when user_count = 2 then 20
              else 0
            end
          ) as total_score
        from field_aggregate
      ),
      -- Step 4: per candidate, take the highest-scoring field. Primary breaks
      -- ties (case ordering puts 'primary' before 'alias'); field_text breaks
      -- alias-vs-alias ties so the result is deterministic.
      candidate_best as (
        select distinct on (candidate_id)
          candidate_id,
          primary_name,
          field_type,
          field_text,
          total_score
        from field_scored
        where total_score > 0
        order by
          candidate_id,
          total_score desc,
          case when field_type = 'primary' then 0 else 1 end,
          field_text
      )
    select
      cb.candidate_id,
      cb.primary_name,
      cb.field_type,
      cb.field_text,
      cb.total_score,
      ls.unique_identifier as iso_code
    from candidate_best cb
    left join public.languoid_source ls
      on ls.languoid_id = cb.candidate_id
      and lower(ls.name) = 'iso639-3'
      and ls.active = true
    where cb.total_score >= 25
      and not exists (
        select 1
        from public.languoid_link_suggestion existing
        where existing.languoid_id = p_languoid_id
          and existing.suggested_languoid_id = cb.candidate_id
      )
    order by cb.total_score desc, cb.primary_name asc
    limit greatest(p_max_suggestions, 0)
  loop
    v_position := v_position + 1;

    -- match_rank is the positional rank (1 = best). The existing UI treats
    -- match_rank = 1 as the "exact match" badge; storing scores here would
    -- break that contract, so we store the position instead.
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
      v_match.candidate_id::uuid,
      p_profile_id,
      v_position,
      case when v_match.field_type = 'primary' then 'name' else 'alias' end,
      case
        when v_match.field_type = 'alias' then v_match.field_text
        else v_match.primary_name
      end,
      'pending',
      true
    )
    on conflict (languoid_id, suggested_languoid_id) do nothing;

    v_suggestion_count := v_suggestion_count + 1;
  end loop;

  return v_suggestion_count;
end;
$$;

grant execute on function public.create_languoid_link_suggestions(uuid, uuid, integer)
  to authenticated;

comment on function public.create_languoid_link_suggestions is
  'Languoid suggestion ranking — behavioral contract v5. '
  'For each candidate languoid, evaluates the primary name and each active '
  'alias as separate "fields" using the user languoid name and any associated '
  'project name words. The candidate inherits its best-scoring field, with '
  'primary preferred over alias for ties. Combines a project-context score '
  '(per_word_value scaled by project completeness) with a user-intent score '
  '(plus a multi-word bonus). Strength uses pg_trgm `<%` + '
  'strict_word_similarity (>= 0.7) for the exact-word path (strength = 1.0) '
  'and Levenshtein-similarity (>= 0.7) for the spelling path; trigram `<%`/`%` '
  'operators are kept as the index-friendly cross-join pre-filter. Drops '
  'candidates below 25 points and stores the positional rank in match_rank '
  '(1 = top).';
