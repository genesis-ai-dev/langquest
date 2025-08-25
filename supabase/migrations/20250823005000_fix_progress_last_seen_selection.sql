-- purpose: fix last_seen selection without max(uuid) by ordering batch and taking last row
-- affects: public.rebuild_project_closure_batch

set check_function_bodies = off;

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
  insert into public.project_closure(project_id)
  values (p_project_id) on conflict do nothing;

  select last_seen_quest_created_at, last_seen_quest_id
  into v_last_seen_at, v_last_seen_id
  from public.project_rollup_progress where project_id = p_project_id;

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
    quest_ids = coalesce(pc.quest_ids, '[]'::jsonb)
      || coalesce((select jsonb_agg(distinct b.quest_id) from batch b), '[]'::jsonb),
    asset_ids = coalesce(pc.asset_ids, '[]'::jsonb)
      || coalesce((
        select jsonb_agg(distinct (elem)::uuid)
        from batch b, lateral jsonb_array_elements_text(b.asset_ids) as elem
      ), '[]'::jsonb),
    translation_ids = coalesce(pc.translation_ids, '[]'::jsonb)
      || coalesce((
        select jsonb_agg(distinct (elem)::uuid)
        from batch b, lateral jsonb_array_elements_text(b.translation_ids) as elem
      ), '[]'::jsonb),
    vote_ids = coalesce(pc.vote_ids, '[]'::jsonb)
      || coalesce((
        select jsonb_agg(distinct elem)
        from batch b, lateral jsonb_array_elements_text(b.vote_ids) as elem
      ), '[]'::jsonb),
    tag_ids = coalesce(pc.tag_ids, '[]'::jsonb)
      || coalesce((
        select jsonb_agg(distinct elem)
        from batch b, lateral jsonb_array_elements_text(b.tag_ids) as elem
      ), '[]'::jsonb),
    language_ids = coalesce(pc.language_ids, '[]'::jsonb)
      || coalesce((
        select jsonb_agg(distinct (elem)::uuid)
        from batch b, lateral jsonb_array_elements_text(b.language_ids) as elem
      ), '[]'::jsonb),
    quest_asset_link_ids = coalesce(pc.quest_asset_link_ids, '[]'::jsonb)
      || coalesce((
        select jsonb_agg(distinct elem)
        from batch b, lateral jsonb_array_elements_text(b.quest_asset_link_ids) as elem
      ), '[]'::jsonb),
    asset_content_link_ids = coalesce(pc.asset_content_link_ids, '[]'::jsonb)
      || coalesce((
        select jsonb_agg(distinct (elem)::uuid)
        from batch b, lateral jsonb_array_elements_text(b.asset_content_link_ids) as elem
      ), '[]'::jsonb),
    quest_tag_link_ids = coalesce(pc.quest_tag_link_ids, '[]'::jsonb)
      || coalesce((
        select jsonb_agg(distinct elem)
        from batch b, lateral jsonb_array_elements_text(b.quest_tag_link_ids) as elem
      ), '[]'::jsonb),
    asset_tag_link_ids = coalesce(pc.asset_tag_link_ids, '[]'::jsonb)
      || coalesce((
        select jsonb_agg(distinct elem)
        from batch b, lateral jsonb_array_elements_text(b.asset_tag_link_ids) as elem
      ), '[]'::jsonb),
    total_quests = coalesce(pc.total_quests, 0) + coalesce((select count(*) from batch),0),
    total_assets = coalesce(pc.total_assets, 0) + coalesce((select sum(b.total_assets) from batch b),0),
    total_translations = coalesce(pc.total_translations, 0) + coalesce((select sum(b.total_translations) from batch b),0),
    approved_translations = coalesce(pc.approved_translations, 0) + coalesce((select sum(b.approved_translations) from batch b),0),
    last_updated = now()
  where pc.project_id = p_project_id;

  -- count rows in the same window
  with batch as (
    select qc.quest_id, q.created_at
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
  select count(*) into v_rows from batch;

  if v_rows > 0 then
    -- pick the last row by created_at desc, quest_id desc
    with batch as (
      select qc.quest_id, q.created_at
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
    ), last_row as (
      select created_at, quest_id
      from batch
      order by created_at desc, quest_id desc
      limit 1
    )
    insert into public.project_rollup_progress(project_id, last_seen_quest_created_at, last_seen_quest_id, updated_at)
    select p_project_id, lr.created_at, lr.quest_id, now()
    from last_row lr
    on conflict (project_id)
    do update set last_seen_quest_created_at = excluded.last_seen_quest_created_at,
                  last_seen_quest_id = excluded.last_seen_quest_id,
                  updated_at = now();
  end if;

  return coalesce(v_rows, 0);
end;
$$;


