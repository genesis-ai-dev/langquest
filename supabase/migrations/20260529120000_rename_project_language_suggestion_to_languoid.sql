-- ============================================================================
-- Rename project_language_suggestion → project_languoid_suggestion
-- ============================================================================
-- Aligns naming with languoid_link_suggestion (suggests a languoid, not a
-- generic "language"). Also renames RPCs and the pending helper view.

-- Table + indexes + constraint
alter table public.project_language_suggestion
  rename to project_languoid_suggestion;

alter table public.project_languoid_suggestion
  rename constraint unique_project_language_suggestion
  to unique_project_languoid_suggestion;

alter index if exists idx_project_language_suggestion_project
  rename to idx_project_languoid_suggestion_project;

alter index if exists idx_project_language_suggestion_pending
  rename to idx_project_languoid_suggestion_pending;

comment on table public.project_languoid_suggestion is
  'Suggestions to switch a project''s linked languoid when the project name '
  'strongly matches a different languoid (Event 1 of the languoid suggestion split). '
  'At most one pending suggestion per (project, current_languoid, language_type).';

-- RLS policy names (expressions follow the renamed table automatically)
alter policy "Project owners can view project language suggestions"
  on public.project_languoid_suggestion
  rename to "Project owners can view project languoid suggestions";

alter policy "Project owners can update project language suggestions"
  on public.project_languoid_suggestion
  rename to "Project owners can update project languoid suggestions";

-- Helper view
drop view if exists public.pending_project_language_suggestions;

create or replace view public.pending_project_languoid_suggestions as
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
from public.project_languoid_suggestion pls
inner join public.project p on p.id = pls.project_id
inner join public.languoid cl on cl.id = pls.current_languoid_id
inner join public.languoid sl on sl.id = pls.suggested_languoid_id
where pls.status = 'pending'
  and pls.active = true
  and p.active = true;

comment on view public.pending_project_languoid_suggestions is
  'Pending project_languoid_suggestion rows joined with project + languoid '
  'names for client display.';

grant select on public.pending_project_languoid_suggestions to authenticated;

-- Scoring function (latest tuned body; new name)
create or replace function public.create_project_languoid_suggestion(
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

  if v_runner_up_score >= v_score_floor
     and (v_best_score - v_runner_up_score) < v_min_score_gap then
    return false;
  end if;

  if v_current_score > 0
     and (v_best_score - v_current_score) < v_min_score_gap then
    return false;
  end if;

  insert into public.project_languoid_suggestion (
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

grant execute on function public.create_project_languoid_suggestion(uuid, uuid, text)
  to authenticated;

comment on function public.create_project_languoid_suggestion is
  'Analyses a project name against the languoid corpus and inserts ONE '
  'project_languoid_suggestion if a candidate dominates (a) the score floor, '
  '(b) a >=2pt gap over runner-up, and (c) a >=2pt gap over the current languoid. '
  'Event 1 of the languoid suggestion split.';

-- Trigger: call renamed create function
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
    perform public.create_project_languoid_suggestion(
      new.project_id,
      new.languoid_id,
      new.language_type
    );
  end if;

  return new;
end;
$$;

comment on function public.trigger_suggest_project_language is
  'Trigger function that fires create_project_languoid_suggestion on '
  'project_language_link inserts where language_type=target.';

-- Accept / dismiss RPCs
create or replace function public.accept_project_languoid_suggestion(
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
  from public.project_languoid_suggestion
  where id = p_suggestion_id
    and status = 'pending'
    and active = true;

  if v_suggestion is null then
    raise exception 'Suggestion not found, not pending, or inactive';
  end if;

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

  update public.project_languoid_suggestion
  set status = 'accepted', last_updated = now()
  where id = p_suggestion_id;

  update public.project_languoid_suggestion
  set status = 'withdrawn', last_updated = now()
  where project_id = v_suggestion.project_id
    and current_languoid_id = v_suggestion.current_languoid_id
    and language_type = v_suggestion.language_type
    and id != p_suggestion_id
    and status = 'pending';

  return true;
end;
$$;

grant execute on function public.accept_project_languoid_suggestion(uuid)
  to authenticated;

comment on function public.accept_project_languoid_suggestion is
  'Accepts a project_languoid_suggestion: swaps the project_language_link to '
  'use the suggested languoid and marks the suggestion as accepted. '
  'RLS gates ownership.';

create or replace function public.dismiss_project_languoid_suggestion(
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

  update public.project_languoid_suggestion
  set status = 'declined', last_updated = now()
  where id = p_suggestion_id
    and status = 'pending'
    and active = true;

  return found;
end;
$$;

grant execute on function public.dismiss_project_languoid_suggestion(uuid)
  to authenticated;

comment on function public.dismiss_project_languoid_suggestion is
  'Marks a project_languoid_suggestion as declined. RLS gates ownership.';

-- PowerSync publication (if the table was published under the old name)
do $$
begin
  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'powersync'
      and schemaname = 'public'
      and tablename = 'project_language_suggestion'
  ) then
    alter publication powersync drop table public.project_language_suggestion;
    alter publication powersync add table only public.project_languoid_suggestion;
  elsif not exists (
    select 1
    from pg_publication_tables
    where pubname = 'powersync'
      and schemaname = 'public'
      and tablename = 'project_languoid_suggestion'
  ) then
    alter publication powersync add table only public.project_languoid_suggestion;
  end if;
end;
$$;

-- Drop legacy function names
drop function if exists public.create_project_language_suggestion(uuid, uuid, text);
drop function if exists public.accept_project_language_suggestion(uuid);
drop function if exists public.dismiss_project_language_suggestion(uuid);

-- Schema version bump (table rename requires client sync rules update)
create or replace function public.get_schema_info()
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'schema_version', '2.5',
    'min_required_schema_version', '2.4',
    'notes', 'Renamed project_language_suggestion to project_languoid_suggestion. Clients <2.4 cannot sync this table.'
  );
$$;
