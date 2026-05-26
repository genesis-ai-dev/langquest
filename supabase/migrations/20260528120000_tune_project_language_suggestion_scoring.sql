-- ============================================================================
-- Tune project language suggestion scoring (Event 1)
-- ============================================================================
--
-- PROBLEM:
--   For "Santhali Gospel Recording" + target English, Santali scored ~104.4
--   but Nthali/Santalic scored ~103.8 via the 0.7 Levenshtein path on
--   "santhali". The 1.5× dominance gate then suppressed the suggestion:
--     104.375 < 1.5 * 103.75  →  no row inserted.
--
-- FIX:
--   1. Raise v_lev_threshold 0.7 → 0.86 so near-miss languages (Nthali, etc.)
--      drop out while santhali→Santali (~0.875) still matches.
--   2. Replace the 1.5× ratio dominance gate with a minimum score gap of 2.0
--      points between #1 and #2 (only when runner-up cleared the score floor).
--      Ratio gates are too harsh when all candidates cluster around 100–105.
-- ============================================================================

create or replace function public.create_project_language_suggestion(
  p_project_id uuid,
  p_current_languoid_id uuid,
  p_language_type text default 'target'
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_trgm
as $$
declare
  v_project_name text;
  v_distinctness_k constant integer := 10;
  v_score_floor constant float := 100;
  v_min_score_gap constant float := 2.0;
  v_min_word_length constant integer := 3;
  v_min_field_length constant integer := 4;
  v_lev_threshold constant float := 0.86;
  v_exact_threshold constant float := 0.7;

  v_best_candidate_id uuid;
  v_best_score float;
  v_best_matched_value text;
  v_runner_up_score float;
  v_current_score float;
begin
  select name into v_project_name
  from public.project
  where id = p_project_id
    and active = true;

  if v_project_name is null or trim(v_project_name) = '' then
    return false;
  end if;

  with
  project_words as (
    select distinct w.word
    from (
      select regexp_split_to_table(
        lower(trim(v_project_name)),
        '[\s()\[\]{}.\-_/]+'
      ) as word
    ) w
    where length(w.word) >= v_min_word_length
      and w.word !~ '^[0-9]+$'
  ),
  candidate_fields as (
    select
      l.id as candidate_id,
      lower(l.name) as field_text,
      l.name as original_field_text,
      1.0::float as field_weight,
      true as is_primary
    from public.languoid l
    where l.active = true
      and length(l.name) >= v_min_field_length

    union all

    select distinct on (la.subject_languoid_id, lower(la.name))
      la.subject_languoid_id as candidate_id,
      lower(la.name) as field_text,
      la.name as original_field_text,
      0.85::float as field_weight,
      false as is_primary
    from public.languoid_alias la
    inner join public.languoid l on l.id = la.subject_languoid_id
    where la.active = true
      and l.active = true
      and length(la.name) >= v_min_field_length
  ),
  raw_matches as (
    select
      pw.word,
      cf.candidate_id,
      cf.field_text,
      cf.original_field_text,
      cf.field_weight,
      cf.is_primary,
      case
        when pw.word <% cf.field_text
             and strict_word_similarity(pw.word, cf.field_text) >= v_exact_threshold
          then 1.0::float
        when public._lev_sim(pw.word, cf.field_text) >= v_lev_threshold
          then public._lev_sim(pw.word, cf.field_text)
        else 0::float
      end as strength
    from project_words pw
    cross join candidate_fields cf
    where pw.word <% cf.field_text
       or pw.word % cf.field_text
  ),
  positive_matches as (
    select * from raw_matches where strength > 0
  ),
  word_distinctness as (
    select word, count(distinct candidate_id) as cand_match_count
    from positive_matches
    group by word
  ),
  distinctive_words as (
    select word from word_distinctness where cand_match_count <= v_distinctness_k
  ),
  filtered_matches as (
    select pm.*
    from positive_matches pm
    inner join distinctive_words dw on dw.word = pm.word
  ),
  field_scores as (
    select
      candidate_id,
      original_field_text,
      is_primary,
      field_weight,
      count(distinct word) as matched_word_count,
      sum(100.0 * field_weight) as base_score,
      sum(strength * 5.0) as strength_bonus,
      sum(100.0 * field_weight) + sum(strength * 5.0) as field_score
    from filtered_matches
    group by candidate_id, original_field_text, is_primary, field_weight
  ),
  candidate_best_field as (
    select distinct on (candidate_id)
      candidate_id,
      original_field_text,
      is_primary,
      field_score as candidate_score
    from field_scores
    order by
      candidate_id,
      field_score desc,
      is_primary desc,
      original_field_text asc
  ),
  ranked_candidates as (
    select
      candidate_id,
      original_field_text,
      is_primary,
      candidate_score,
      row_number() over (
        order by candidate_score desc, original_field_text asc, candidate_id asc
      ) as rnk
    from candidate_best_field
    where candidate_id != p_current_languoid_id
      and candidate_score >= v_score_floor
  )
  select
    t.candidate_id,
    t.candidate_score,
    t.original_field_text,
    coalesce(r.candidate_score, 0)::float,
    coalesce(c.candidate_score, 0)::float
  into
    v_best_candidate_id,
    v_best_score,
    v_best_matched_value,
    v_runner_up_score,
    v_current_score
  from ranked_candidates t
  left join ranked_candidates r on r.rnk = 2
  left join candidate_best_field c on c.candidate_id = p_current_languoid_id
  where t.rnk = 1;

  if v_best_candidate_id is null then
    return false;
  end if;

  -- Dominance vs runner-up: require a clear lead, not a 1.5× ratio on ~100pt scores.
  if v_runner_up_score >= v_score_floor
     and (v_best_score - v_runner_up_score) < v_min_score_gap then
    return false;
  end if;

  -- Dominance vs current languoid (unchanged intent: name must favor the suggestion)
  if v_current_score > 0
     and (v_best_score - v_current_score) < v_min_score_gap then
    return false;
  end if;

  insert into public.project_language_suggestion (
    project_id,
    current_languoid_id,
    suggested_languoid_id,
    language_type,
    matched_value,
    status,
    active
  ) values (
    p_project_id,
    p_current_languoid_id,
    v_best_candidate_id,
    p_language_type,
    v_best_matched_value,
    'pending',
    true
  )
  on conflict (project_id, current_languoid_id, suggested_languoid_id, language_type)
    do nothing;

  return true;
end;
$$;

comment on function public.create_project_language_suggestion is
  'Analyses a project name against the languoid corpus and inserts ONE '
  'project_language_suggestion if a candidate dominates (a) the score floor, '
  '(b) a >=2pt gap over runner-up, and (c) a >=2pt gap over the current languoid. '
  'Event 1 of the languoid suggestion split.';
