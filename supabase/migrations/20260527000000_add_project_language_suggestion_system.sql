-- ============================================================================
-- Migration: Add Project Language Suggestion System (Event 1)
-- ============================================================================
--
-- PURPOSE:
-- When a project is created and its target language link is set, this system
-- analyses the project's name and suggests switching the target languoid if
-- the name strongly aligns with a *different* languoid (e.g., a project named
-- "Santhali omt bible" with target languoid "English" should be suggested to
-- switch to "Santali").
--
-- This is intentionally NARROW (single, confident suggestion) and DISTINCT from
-- the languoid-merge suggestion system (`languoid_link_suggestion`). That system
-- suggests merging duplicate languoids; THIS system suggests fixing a project's
-- language assignment.
--
-- BEHAVIORAL CONTRACT (locked in this design):
--   * Trigger: on insert into `project_language_link` where language_type='target'
--   * Output: at most ONE suggestion, suppressed on ambiguity
--   * Score formula (Option B):
--       score(candidate, field) = sum over matched_words of (100 * field_weight)
--                                + sum over matched_words of (strength * 5)
--   * Stop-word filtering: distinctness gate -- a project word is dropped if it
--     matches more than K=10 candidate languoid fields (so generic words like
--     `bible`, `bahasa`, `test` auto-filter without a hand-curated stop list).
--   * Dominance gates (BOTH must hold for a suggestion to fire):
--       - top.score >= 100 (absolute floor)
--       - top.score >= 1.5 * runner_up.score
--       - top.score >= 1.5 * current_languoid.score
--   * Visibility: project owners only (via RLS against profile_project_link)
--
-- AFFECTED OBJECTS:
--   * Creates table: public.project_language_suggestion
--   * Creates function: public._lev_sim(text, text) -- Levenshtein similarity helper
--   * Creates function: public.create_project_language_suggestion(uuid, uuid, text)
--   * Creates function: public.trigger_suggest_project_language()
--   * Creates function: public.accept_project_language_suggestion(uuid)
--   * Creates function: public.dismiss_project_language_suggestion(uuid)
--   * Creates trigger: suggest_project_language_trigger on project_language_link
--
-- DEPENDENCIES:
--   * pg_trgm (for `<%`, `%`, `strict_word_similarity`)
--   * fuzzystrmatch (for `levenshtein`)
--   * idx_languoid_name_lower_trgm + idx_languoid_alias_name_lower_trgm (already
--     created by 20260511190000_replace_languoid_suggestion_scoring.sql)
--
-- NOTE: A sync-rules.yml entry must be added separately for client sync of the
-- new table. See `supabase/config/sync-rules.yml` and the
-- `languoid_link_suggestion` entry as a template.
-- ============================================================================

-- ============================================================================
-- 1. Required extensions
-- ============================================================================
create extension if not exists pg_trgm;
create extension if not exists fuzzystrmatch;

-- ============================================================================
-- 2. Levenshtein similarity helper
-- ============================================================================
-- Returns 1 - normalized Levenshtein distance, capped at 0 if either side is
-- too long for Postgres `levenshtein` (>255 chars). Matches the lev_sim
-- definition from the v6 behavioral contract.

create or replace function public._lev_sim(a text, b text)
returns float
language sql
immutable
parallel safe
set search_path = public, extensions
as $$
  select case
    when a is null or b is null then 0::float
    when length(a) > 255 or length(b) > 255 then 0::float
    when greatest(length(a), length(b)) = 0 then 0::float
    else 1.0 - levenshtein(a, b)::float / greatest(length(a), length(b))::float
  end;
$$;

comment on function public._lev_sim(text, text) is
  'Normalized Levenshtein similarity in [0, 1]. Returns 0 for nulls or strings '
  'exceeding the 255-char Postgres levenshtein cap. Used by the project '
  'language suggestion scoring (Event 1).';

-- ============================================================================
-- 3. project_language_suggestion table
-- ============================================================================

create table if not exists public.project_language_suggestion (
  id uuid primary key default gen_random_uuid(),

  -- The project this suggestion is for
  project_id uuid not null references public.project(id) on delete cascade,

  -- The languoid currently linked to the project (the one we're suggesting to switch)
  current_languoid_id uuid not null references public.languoid(id) on delete cascade,

  -- The languoid we suggest switching to
  suggested_languoid_id uuid not null references public.languoid(id) on delete cascade,

  -- Which link type this suggestion is for (currently only 'target' fires)
  language_type text not null default 'target'
    check (language_type in ('source', 'target')),

  -- The project name that triggered the match (denormalised for display)
  matched_value text,

  -- pending | accepted | declined  (matches constants.ts statusOptions where applicable)
  status text not null default 'pending',

  -- Soft delete
  active boolean not null default true,

  created_at timestamptz not null default now(),
  last_updated timestamptz not null default now(),

  -- Prevent duplicate suggestions for the same (project, current, suggested, type) tuple
  constraint unique_project_language_suggestion
    unique (project_id, current_languoid_id, suggested_languoid_id, language_type)
);

comment on table public.project_language_suggestion is
  'Suggestions to switch a project''s linked languoid when the project name '
  'strongly matches a different languoid (Event 1 of the languoid suggestion split). '
  'At most one pending suggestion per (project, current_languoid, language_type).';

-- ============================================================================
-- 4. Indexes
-- ============================================================================

create index if not exists idx_project_language_suggestion_project
  on public.project_language_suggestion(project_id)
  where active = true;

create index if not exists idx_project_language_suggestion_pending
  on public.project_language_suggestion(project_id, language_type)
  where active = true and status = 'pending';

-- ============================================================================
-- 5. Row Level Security
-- ============================================================================

alter table public.project_language_suggestion enable row level security;

-- Read: any owner of the linked project can see the suggestion
drop policy if exists "Project owners can view project language suggestions"
  on public.project_language_suggestion;
create policy "Project owners can view project language suggestions"
  on public.project_language_suggestion
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profile_project_link ppl
      where ppl.project_id = project_language_suggestion.project_id
        and ppl.profile_id = auth.uid()
        and ppl.membership = 'owner'
        and ppl.active = true
    )
  );

-- Update: any owner can accept/decline (status flips and active toggle)
drop policy if exists "Project owners can update project language suggestions"
  on public.project_language_suggestion;
create policy "Project owners can update project language suggestions"
  on public.project_language_suggestion
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profile_project_link ppl
      where ppl.project_id = project_language_suggestion.project_id
        and ppl.profile_id = auth.uid()
        and ppl.membership = 'owner'
        and ppl.active = true
    )
  )
  with check (
    exists (
      select 1 from public.profile_project_link ppl
      where ppl.project_id = project_language_suggestion.project_id
        and ppl.profile_id = auth.uid()
        and ppl.membership = 'owner'
        and ppl.active = true
    )
  );

-- Note: No INSERT or DELETE policy. All inserts go through
-- create_project_language_suggestion (SECURITY DEFINER). Deletes are not exposed.

-- ============================================================================
-- 6. Scoring + insertion function
-- ============================================================================
-- Inputs:
--   p_project_id          The project that just got a new language link
--   p_current_languoid_id The languoid currently linked (the one being potentially replaced)
--   p_language_type       'target' (currently the only fired type)
--
-- Returns: true if a suggestion was inserted, false otherwise.
--
-- Algorithm (matches the locked behavioral contract above).

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
  -- Tuning constants (intentionally local to make later tweaks obvious)
  v_distinctness_k constant integer := 10;
  v_score_floor constant float := 100;
  v_dominance_margin constant float := 1.5;
  v_min_word_length constant integer := 3;
  v_min_field_length constant integer := 4;
  v_lev_threshold constant float := 0.7;
  v_exact_threshold constant float := 0.7;

  v_best_candidate_id uuid;
  v_best_score float;
  v_best_matched_value text;
  v_runner_up_score float;
  v_current_score float;
begin
  -- Bail early on a missing project or empty name
  select name into v_project_name
  from public.project
  where id = p_project_id
    and active = true;

  if v_project_name is null or trim(v_project_name) = '' then
    return false;
  end if;

  -- Single big CTE chain that drives the whole pipeline.
  with
  -- Step 1: extract distinct words from the project name
  -- Wrap regexp_split_to_table in a subquery so `word` is a stable column
  -- reference (matches the pattern used by create_languoid_link_suggestions).
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

  -- Step 2: build the candidate field set
  --   * primary names (weight 1.0)
  --   * distinct active aliases per candidate (weight 0.85)
  -- Distinct alias rule: collapse duplicate (candidate_id, lower(name)) so that
  -- identical strings registered as both endonym and exonym don't double-score.
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

  -- Step 3: find all (word, field) match candidates via trigram pre-filter.
  -- Strength is set by the first matching path (exact > spelling).
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

  -- Step 4: keep only positive-strength matches
  positive_matches as (
    select * from raw_matches where strength > 0
  ),

  -- Step 5: distinctness gate -- count distinct candidate matches per word.
  -- A word is "distinctive" only if it matches <= K candidates.
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

  -- Step 6: per-(candidate, field) score using Option B formula
  --   score = sum over matched_words of (100 * field_weight + strength * 5)
  -- (de-duplicated by word per field, so a repeated word never scores twice)
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

  -- Step 7: pick the single highest-scoring field per candidate
  -- Tiebreakers: primary > alias, then lexicographic ASC on field text
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

  -- Step 8: rank candidates, EXCLUDING the current languoid so it can never
  -- be ranked as top/runner-up. The current languoid's score is looked up
  -- separately for the dominance gate.
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

  -- Pull out top, runner-up, and current's score in one query.
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

  -- No candidate cleared the floor
  if v_best_candidate_id is null then
    return false;
  end if;

  -- Dominance gate vs runner-up
  -- (runner-up may be 0 if there's no second candidate, which trivially passes)
  if v_runner_up_score > 0
     and v_best_score < v_dominance_margin * v_runner_up_score then
    return false;
  end if;

  -- Dominance gate vs current languoid
  -- (current may be 0 if the project name doesn't lexically resemble it at all)
  if v_current_score > 0
     and v_best_score < v_dominance_margin * v_current_score then
    return false;
  end if;

  -- All gates passed: insert the suggestion
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

grant execute on function public.create_project_language_suggestion(uuid, uuid, text)
  to authenticated;

comment on function public.create_project_language_suggestion is
  'Analyses a project name against the languoid corpus and inserts ONE '
  'project_language_suggestion if a candidate dominates (a) the score floor, '
  '(b) the runner-up, and (c) the current languoid. Event 1 of the languoid '
  'suggestion split.';

-- ============================================================================
-- 7. Trigger function
-- ============================================================================
-- Fires on project_language_link insert. Only acts when language_type='target'
-- and the row is active with a languoid_id set.

create or replace function public.trigger_suggest_project_language()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.language_type = 'target'
     and new.languoid_id is not null
     and coalesce(new.active, true) = true then
    perform public.create_project_language_suggestion(
      new.project_id,
      new.languoid_id,
      new.language_type
    );
  end if;

  return new;
end;
$$;

drop trigger if exists suggest_project_language_trigger on public.project_language_link;

create trigger suggest_project_language_trigger
  after insert on public.project_language_link
  for each row
  execute function public.trigger_suggest_project_language();

comment on function public.trigger_suggest_project_language is
  'Trigger function that fires create_project_language_suggestion on '
  'project_language_link inserts where language_type=target.';

-- ============================================================================
-- 8. Accept function
-- ============================================================================
-- When a user accepts: swap the project_language_link's languoid_id to the
-- suggested one, mark this suggestion accepted, withdraw other pending
-- suggestions for the same (project, current, language_type) tuple.
--
-- The project_language_link PK is (project_id, languoid_id, language_type),
-- so we delete-then-insert rather than update.

create or replace function public.accept_project_language_suggestion(
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
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_suggestion
  from public.project_language_suggestion
  where id = p_suggestion_id
    and status = 'pending'
    and active = true;

  if v_suggestion is null then
    raise exception 'Suggestion not found, not pending, or inactive';
  end if;

  -- RLS guarantees the user is an owner of this project; the SELECT above
  -- will return null otherwise.

  -- Swap the link: delete old, insert new
  delete from public.project_language_link
  where project_id = v_suggestion.project_id
    and languoid_id = v_suggestion.current_languoid_id
    and language_type = v_suggestion.language_type;

  insert into public.project_language_link (
    project_id,
    languoid_id,
    language_type,
    active,
    last_updated
  ) values (
    v_suggestion.project_id,
    v_suggestion.suggested_languoid_id,
    v_suggestion.language_type,
    true,
    now()
  )
  on conflict (project_id, languoid_id, language_type)
    do update set active = true, last_updated = now();

  -- Mark this suggestion accepted
  update public.project_language_suggestion
  set status = 'accepted', last_updated = now()
  where id = p_suggestion_id;

  -- Withdraw any other pending suggestions for the same (project, current, type)
  -- (Shouldn't happen given the dominance/single-winner design, but defensive.)
  update public.project_language_suggestion
  set status = 'withdrawn', last_updated = now()
  where project_id = v_suggestion.project_id
    and current_languoid_id = v_suggestion.current_languoid_id
    and language_type = v_suggestion.language_type
    and id != p_suggestion_id
    and status = 'pending';

  return true;
end;
$$;

grant execute on function public.accept_project_language_suggestion(uuid)
  to authenticated;

comment on function public.accept_project_language_suggestion is
  'Accepts a project_language_suggestion: swaps the project_language_link to '
  'use the suggested languoid and marks the suggestion as accepted. '
  'RLS gates ownership.';

-- ============================================================================
-- 9. Dismiss function
-- ============================================================================

create or replace function public.dismiss_project_language_suggestion(
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
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  update public.project_language_suggestion
  set status = 'declined', last_updated = now()
  where id = p_suggestion_id
    and status = 'pending'
    and active = true;

  return found;
end;
$$;

grant execute on function public.dismiss_project_language_suggestion(uuid)
  to authenticated;

comment on function public.dismiss_project_language_suggestion is
  'Marks a project_language_suggestion as declined. RLS gates ownership.';

-- ============================================================================
-- 10. Helper view: pending suggestions with details (parallel to
--     pending_languoid_link_suggestions)
-- ============================================================================

create or replace view public.pending_project_language_suggestions as
select
  pls.id as suggestion_id,
  pls.project_id,
  p.name as project_name,
  pls.current_languoid_id,
  cl.name as current_languoid_name,
  pls.suggested_languoid_id,
  sl.name as suggested_languoid_name,
  pls.language_type,
  pls.matched_value,
  pls.created_at
from public.project_language_suggestion pls
inner join public.project p on p.id = pls.project_id
inner join public.languoid cl on cl.id = pls.current_languoid_id
inner join public.languoid sl on sl.id = pls.suggested_languoid_id
where pls.status = 'pending'
  and pls.active = true
  and p.active = true;

comment on view public.pending_project_language_suggestions is
  'Pending project_language_suggestion rows joined with project + languoid '
  'names for client display.';

grant select on public.pending_project_language_suggestions to authenticated;
