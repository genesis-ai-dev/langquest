-- purpose: add batched project_closure rollup to avoid timeouts and integrate into clone step
-- notes:
-- - introduces progress table public.project_rollup_progress to track per-project batching
-- - adds function public.rebuild_project_closure_batch(project_id, limit) returning int rows_processed
-- - adds function public.finalize_project_closure(project_id) to coalesce arrays and totals
-- - updates perform_clone_step recompute_closures stage to call batcher until 0, then finalize

set check_function_bodies = off;

-- lightweight progress table to resume batching without reprocessing
create table if not exists public.project_rollup_progress (
  project_id uuid primary key references public.project(id) on delete cascade,
  last_seen_quest_created_at timestamptz,
  last_seen_quest_id uuid,
  updated_at timestamptz not null default now()
);

alter table public.project_rollup_progress enable row level security;

-- permissive read/write for service-side operations (clone runs as definer)
do $$ begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' and tablename = 'project_rollup_progress' and policyname = 'read progress'
  ) then
    create policy "read progress" on public.project_rollup_progress for select using ( true );
  end if;
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' and tablename = 'project_rollup_progress' and policyname = 'write progress'
  ) then
    create policy "write progress" on public.project_rollup_progress for insert with check ( true );
  end if;
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' and tablename = 'project_rollup_progress' and policyname = 'update progress'
  ) then
    create policy "update progress" on public.project_rollup_progress for update using ( true ) with check ( true );
  end if;
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' and tablename = 'project_rollup_progress' and policyname = 'delete progress'
  ) then
    create policy "delete progress" on public.project_rollup_progress for delete using ( true );
  end if;
end $$;

-- batch worker: merges a window of quest_closure into project_closure deterministically by created_at, id
create or replace function public.rebuild_project_closure_batch(p_project_id uuid, p_limit int default 200)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows int := 0;
  v_last_seen_at timestamptz;
  v_last_seen_id uuid;
begin
  -- ensure closure row exists
  insert into public.project_closure(project_id)
  values (p_project_id) on conflict do nothing;

  -- read progress
  select last_seen_quest_created_at, last_seen_quest_id
  into v_last_seen_at, v_last_seen_id
  from public.project_rollup_progress where project_id = p_project_id;

  -- process a stable window of quest_closure rows
  with batch as (
    select qc.*, q.created_at
    from public.quest_closure qc
    join public.quest q on q.id = qc.quest_id
    where qc.project_id = p_project_id and q.active = true
      and (
        v_last_seen_at is null
        or (q.created_at > v_last_seen_at)
        or (q.created_at = v_last_seen_at and qc.quest_id > v_last_seen_id)
      )
    order by q.created_at, qc.quest_id
    limit greatest(coalesce(p_limit, 50), 1)
  )
  update public.project_closure pc
  set
    quest_ids = coalesce(pc.quest_ids, '[]'::jsonb) || coalesce(
      (select jsonb_agg(distinct b.quest_id) from batch b), '[]'::jsonb
    ),
    asset_ids = coalesce(pc.asset_ids, '[]'::jsonb) || coalesce(
      (select jsonb_agg(distinct (jsonb_array_elements_text(b.asset_ids))::uuid) from batch b), '[]'::jsonb
    ),
    translation_ids = coalesce(pc.translation_ids, '[]'::jsonb) || coalesce(
      (select jsonb_agg(distinct (jsonb_array_elements_text(b.translation_ids))::uuid) from batch b), '[]'::jsonb
    ),
    vote_ids = coalesce(pc.vote_ids, '[]'::jsonb) || coalesce(
      (select jsonb_agg(distinct jsonb_array_elements_text(b.vote_ids)) from batch b), '[]'::jsonb
    ),
    tag_ids = coalesce(pc.tag_ids, '[]'::jsonb) || coalesce(
      (select jsonb_agg(distinct jsonb_array_elements_text(b.tag_ids)) from batch b), '[]'::jsonb
    ),
    language_ids = coalesce(pc.language_ids, '[]'::jsonb) || coalesce(
      (select jsonb_agg(distinct (jsonb_array_elements_text(b.language_ids))::uuid) from batch b), '[]'::jsonb
    ),
    quest_asset_link_ids = coalesce(pc.quest_asset_link_ids, '[]'::jsonb) || coalesce(
      (select jsonb_agg(distinct jsonb_array_elements_text(b.quest_asset_link_ids)) from batch b), '[]'::jsonb
    ),
    asset_content_link_ids = coalesce(pc.asset_content_link_ids, '[]'::jsonb) || coalesce(
      (select jsonb_agg(distinct (jsonb_array_elements_text(b.asset_content_link_ids))::uuid) from batch b), '[]'::jsonb
    ),
    quest_tag_link_ids = coalesce(pc.quest_tag_link_ids, '[]'::jsonb) || coalesce(
      (select jsonb_agg(distinct jsonb_array_elements_text(b.quest_tag_link_ids)) from batch b), '[]'::jsonb
    ),
    asset_tag_link_ids = coalesce(pc.asset_tag_link_ids, '[]'::jsonb) || coalesce(
      (select jsonb_agg(distinct jsonb_array_elements_text(b.asset_tag_link_ids)) from batch b), '[]'::jsonb
    ),
    total_quests = coalesce(pc.total_quests, 0) + coalesce((select count(*) from batch),0),
    total_assets = coalesce(pc.total_assets, 0) + coalesce((select sum(b.total_assets) from batch b),0),
    total_translations = coalesce(pc.total_translations, 0) + coalesce((select sum(b.total_translations) from batch b),0),
    approved_translations = coalesce(pc.approved_translations, 0) + coalesce((select sum(b.approved_translations) from batch b),0),
    last_updated = now()
  where pc.project_id = p_project_id
  returning (select count(*) from batch) into v_rows;

  if v_rows > 0 then
    -- advance cursor to last row of this batch
    insert into public.project_rollup_progress(project_id, last_seen_quest_created_at, last_seen_quest_id, updated_at)
    select p_project_id, max(b.created_at), max(b.quest_id), now() from batch b
    on conflict (project_id)
    do update set last_seen_quest_created_at = excluded.last_seen_quest_created_at,
                  last_seen_quest_id = excluded.last_seen_quest_id,
                  updated_at = now();
  end if;

  return coalesce(v_rows, 0);
end;
$$;

-- finalizer to dedupe arrays and ensure counts match distinct membership
create or replace function public.finalize_project_closure(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.project_closure pc
  set
    quest_ids = (select coalesce(jsonb_agg(distinct x), '[]'::jsonb) from jsonb_array_elements(pc.quest_ids) as x),
    asset_ids = (select coalesce(jsonb_agg(distinct x), '[]'::jsonb) from jsonb_array_elements(pc.asset_ids) as x),
    translation_ids = (select coalesce(jsonb_agg(distinct x), '[]'::jsonb) from jsonb_array_elements(pc.translation_ids) as x),
    vote_ids = (select coalesce(jsonb_agg(distinct x), '[]'::jsonb) from jsonb_array_elements(pc.vote_ids) as x),
    tag_ids = (select coalesce(jsonb_agg(distinct x), '[]'::jsonb) from jsonb_array_elements(pc.tag_ids) as x),
    language_ids = (select coalesce(jsonb_agg(distinct x), '[]'::jsonb) from jsonb_array_elements(pc.language_ids) as x),
    quest_asset_link_ids = (select coalesce(jsonb_agg(distinct x), '[]'::jsonb) from jsonb_array_elements(pc.quest_asset_link_ids) as x),
    asset_content_link_ids = (select coalesce(jsonb_agg(distinct x), '[]'::jsonb) from jsonb_array_elements(pc.asset_content_link_ids) as x),
    quest_tag_link_ids = (select coalesce(jsonb_agg(distinct x), '[]'::jsonb) from jsonb_array_elements(pc.quest_tag_link_ids) as x),
    asset_tag_link_ids = (select coalesce(jsonb_agg(distinct x), '[]'::jsonb) from jsonb_array_elements(pc.asset_tag_link_ids) as x),
    total_quests = coalesce((select count(distinct (x->>0)) from jsonb_array_elements(pc.quest_ids) as x), 0),
    total_assets = coalesce((select count(distinct (x->>0)) from jsonb_array_elements(pc.asset_ids) as x), 0),
    total_translations = coalesce((select count(distinct (x->>0)) from jsonb_array_elements(pc.translation_ids) as x), 0),
    approved_translations = coalesce(pc.approved_translations, 0),
    last_updated = now()
  where pc.project_id = p_project_id;

  -- cleanup progress (optional)
  delete from public.project_rollup_progress where project_id = p_project_id;
end;
$$;

-- integrate: modify perform_clone_step recompute_closures stage to call batch rollup
create or replace function public.perform_clone_step(p_job_id uuid, p_batch_size int default 25)
returns table(done boolean, message text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stage text;
  v_root_project_id uuid;
  v_dst_project_id uuid;
  v_opts jsonb;
  v_rows int := 0;
begin
  select (progress->>'stage')::text, options, root_project_id into v_stage, v_opts, v_root_project_id
  from public.clone_job where id = p_job_id;
  if v_stage is null then v_stage := 'seed_project'; end if;

  if v_stage = 'recompute_closures' then
    select dst_id into v_dst_project_id from public.map_project where job_id = p_job_id and src_id = v_root_project_id;

    v_rows := public.rebuild_project_quest_closures_batch(
      v_dst_project_id,
      (select created_at from public.clone_job where id = p_job_id),
      p_batch_size
    );
    if v_rows > 0 then
      return query select false, format('rebuilt quest closures batch: %s', v_rows);
    end if;

    v_rows := public.rebuild_project_closure_batch(v_dst_project_id, greatest(p_batch_size * 4, 100));
    if v_rows > 0 then
      return query select false, format('rebuilt project closure batch: %s', v_rows);
    end if;

    perform public.finalize_project_closure(v_dst_project_id);

    update public.clone_job 
    set progress = progress || jsonb_build_object('stage','done'), 
        status = 'done', 
        updated_at = now() 
    where id = p_job_id;

    return query select true, 'done';
  end if;

  return query select false, 'noop';
end;
$$;


