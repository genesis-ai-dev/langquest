-- purpose: make perform_clone_step terminal-state aware and fail-safe
-- changes:
-- - early guard: if progress.stage = 'done', set status='done' and return done=true (idempotent)
-- - only set status='running' after checking terminal stage
-- - exception handling: on any error, set status='failed' and record error in progress

set check_function_bodies = off;

create or replace function public.perform_clone_step(p_job_id uuid, p_batch_size int default 25)
returns table(done boolean, message text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_locked boolean;
  v_stage text;
  v_opts jsonb;
  v_root_project_id uuid;
  v_dst_project_id uuid;
  v_new_name text;
  v_target_language_id uuid;
  v_creator_id uuid;
  v_rows int := 0;
  v_last int := 0;
  qrec record;
  arec record;
  lrec record;
begin
  -- one worker per job
  select pg_try_advisory_lock(hashtext(p_job_id::text)) into v_locked;
  if not coalesce(v_locked, false) then
    return query select false, 'lock not acquired';
    return;
  end if;

  -- read current state BEFORE mutating status
  select (progress->>'stage')::text, options, root_project_id
  into v_stage, v_opts, v_root_project_id
  from public.clone_job
  where id = p_job_id;
  if v_stage is null then v_stage := 'seed_project'; end if;

  -- terminal guard: if already done, finalize idempotently
  if v_stage = 'done' then
    update public.clone_job
    set status = 'done', updated_at = now()
    where id = p_job_id;
    return query select true, 'done';
  end if;

  -- mark running only for non-terminal states
  update public.clone_job set status = 'running', updated_at = now() where id = p_job_id;

  v_new_name := coalesce(v_opts->>'new_project_name', 'Cloned Project');
  v_target_language_id := nullif(v_opts->>'target_language_id','')::uuid;
  v_creator_id := nullif(v_opts->>'creator_id','')::uuid;
  p_batch_size := greatest(coalesce(p_batch_size, (v_opts->>'batch_size')::int), 1);

  perform set_config('app.clone_mode','on', true);

  -- Stage 0: seed project (idempotent)
  if v_stage = 'seed_project' then
    if not exists (select 1 from public.map_project where job_id = p_job_id and src_id = v_root_project_id) then
      insert into public.project (name, description, source_language_id, target_language_id, active, creator_id, private, visible, download_profiles, created_at, last_updated)
      select v_new_name, p.description, p.source_language_id, coalesce(v_target_language_id, p.target_language_id), coalesce(p.active, true), v_creator_id, p.private, p.visible, '{}'::uuid[], now(), now()
      from public.project p where p.id = v_root_project_id
      returning id into v_dst_project_id;

      insert into public.map_project(job_id, src_id, dst_id)
      values (p_job_id, v_root_project_id, v_dst_project_id)
      on conflict do nothing;

      insert into public.project_language_link(project_id, language_id, language_type, active, created_at, last_updated)
      select v_dst_project_id, pll.language_id, pll.language_type, pll.active, now(), now()
      from public.project_language_link pll
      where pll.project_id = v_root_project_id and pll.language_type = 'source'
      on conflict do nothing;

      if v_target_language_id is not null then
        insert into public.project_language_link(project_id, language_id, language_type, active, created_at, last_updated)
        values (v_dst_project_id, v_target_language_id, 'target', true, now(), now())
        on conflict do nothing;
      end if;

      insert into public.profile_project_link (profile_id, project_id, membership, active)
      values (v_creator_id, v_dst_project_id, 'owner', true)
      on conflict do nothing;
    else
      select dst_id into v_dst_project_id from public.map_project where job_id = p_job_id and src_id = v_root_project_id;
      insert into public.profile_project_link (profile_id, project_id, membership, active)
      values (v_creator_id, v_dst_project_id, 'owner', true)
      on conflict do nothing;
    end if;

    update public.clone_job
    set progress = coalesce(progress,'{}'::jsonb) || jsonb_build_object('stage','clone_quests','dst_project_id', v_dst_project_id::text),
        updated_at = now()
    where id = p_job_id;
    return query select false, 'seeded project';
  end if;

  if v_dst_project_id is null then
    select dst_id into v_dst_project_id from public.map_project where job_id = p_job_id and src_id = v_root_project_id;
  end if;

  -- Stage 1: clone_quests
  if v_stage = 'clone_quests' then
    v_rows := 0;
    for qrec in (
      select q.* from public.quest q
      where q.project_id = v_root_project_id
        and not exists (select 1 from public.map_quest mq where mq.job_id = p_job_id and mq.src_id = q.id)
      order by q.created_at
      limit p_batch_size
    ) loop
      insert into public.quest (name, description, project_id, active, creator_id, visible, download_profiles, created_at, last_updated)
      values (qrec.name, qrec.description, v_dst_project_id, qrec.active, v_creator_id, qrec.visible, '{}'::uuid[], now(), now())
      returning id into arec;
      insert into public.map_quest(job_id, src_id, dst_id) values (p_job_id, qrec.id, arec.id) on conflict do nothing;
      v_rows := v_rows + 1;
    end loop;
    if v_rows < p_batch_size then
      update public.clone_job set progress = progress || jsonb_build_object('stage','clone_assets'), updated_at = now() where id = p_job_id;
    end if;
    return query select false, format('cloned quests batch: %s', v_rows);
  end if;

  -- Stage 2: clone_assets
  if v_stage = 'clone_assets' then
    v_rows := 0;
    for arec in (
      select distinct a.*
      from public.asset a
      join public.quest_asset_link qal on qal.asset_id = a.id
      join public.quest q on q.id = qal.quest_id and q.project_id = v_root_project_id
      where qal.active = true and a.active = true
        and not exists (select 1 from public.map_asset ma where ma.job_id = p_job_id and ma.src_id = a.id)
      order by a.created_at
      limit p_batch_size
    ) loop
      insert into public.asset (name, images, active, creator_id, visible, download_profiles, source_language_id, created_at, last_updated)
      values (arec.name, arec.images, arec.active, v_creator_id, arec.visible, '{}'::uuid[], arec.source_language_id, now(), now())
      returning id into qrec;
      insert into public.map_asset(job_id, src_id, dst_id) values (p_job_id, arec.id, qrec.id) on conflict do nothing;
      v_rows := v_rows + 1;
    end loop;
    if v_rows < p_batch_size then
      update public.clone_job set progress = progress || jsonb_build_object('stage','clone_acl'), updated_at = now() where id = p_job_id;
    end if;
    return query select false, format('cloned assets batch: %s', v_rows);
  end if;

  -- Stage 3: clone_acl
  if v_stage = 'clone_acl' then
    v_rows := 0;
    for arec in (
      select s.* from public.asset_content_link s
      join public.map_asset ma on ma.job_id = p_job_id and ma.src_id = s.asset_id
      where not exists (select 1 from public.map_acl m where m.job_id = p_job_id and m.src_id = s.id)
      order by s.created_at
      limit p_batch_size
    ) loop
      insert into public.asset_content_link (asset_id, audio_id, text, active, download_profiles, source_language_id, created_at, last_updated)
      select ma.dst_id, arec.audio_id, arec.text, arec.active, '{}'::uuid[], arec.source_language_id, now(), now()
      from public.map_asset ma
      where ma.job_id = p_job_id and ma.src_id = arec.asset_id
      returning id into qrec;
      insert into public.map_acl(job_id, src_id, dst_id) values (p_job_id, arec.id, qrec.id) on conflict do nothing;
      v_rows := v_rows + 1;
    end loop;
    if v_rows < p_batch_size then
      update public.clone_job set progress = progress || jsonb_build_object('stage','recreate_links'), updated_at = now() where id = p_job_id;
    end if;
    return query select false, format('cloned acl batch: %s', v_rows);
  end if;

  -- Stage 4: recreate_links
  if v_stage = 'recreate_links' then
    v_rows := 0;
    for lrec in (
      select qal.* from public.quest_asset_link qal
      join public.quest q on q.id = qal.quest_id and q.project_id = v_root_project_id
      order by qal.quest_id, qal.asset_id
      limit p_batch_size
    ) loop
      if exists (select 1 from public.map_quest mq where mq.job_id = p_job_id and mq.src_id = lrec.quest_id)
         and exists (select 1 from public.map_asset ma where ma.job_id = p_job_id and ma.src_id = lrec.asset_id) then
        insert into public.quest_asset_link (quest_id, asset_id, active, visible, download_profiles, created_at, last_updated)
        select mq.dst_id, ma.dst_id, lrec.active, coalesce(lrec.visible, true), '{}'::uuid[], now(), now()
        from public.map_quest mq, public.map_asset ma
        where mq.job_id = p_job_id and ma.job_id = p_job_id and mq.src_id = lrec.quest_id and ma.src_id = lrec.asset_id
          and not exists (select 1 from public.quest_asset_link t where t.quest_id = mq.dst_id and t.asset_id = ma.dst_id);
        get diagnostics v_last = row_count;
        v_rows := v_rows + v_last;
      end if;
    end loop;

    if v_rows = 0 then
      for lrec in (
        select qtl.* from public.quest_tag_link qtl
        join public.quest q on q.id = qtl.quest_id and q.project_id = v_root_project_id
        order by qtl.quest_id, qtl.tag_id
        limit p_batch_size
      ) loop
        if exists (select 1 from public.map_quest mq where mq.job_id = p_job_id and mq.src_id = lrec.quest_id) then
          insert into public.quest_tag_link (quest_id, tag_id, active, download_profiles, created_at, last_updated)
          select mq.dst_id, lrec.tag_id, lrec.active, '{}'::uuid[], now(), now()
          from public.map_quest mq
          where mq.job_id = p_job_id and mq.src_id = lrec.quest_id
            and not exists (select 1 from public.quest_tag_link t where t.quest_id = mq.dst_id and t.tag_id = lrec.tag_id);
          get diagnostics v_last = row_count;
          v_rows := v_rows + v_last;
        end if;
      end loop;
    end if;

    if v_rows = 0 then
      for lrec in (
        select atl.* from public.asset_tag_link atl
        where exists (select 1 from public.map_asset ma where ma.job_id = p_job_id and ma.src_id = atl.asset_id)
        order by atl.asset_id, atl.tag_id
        limit p_batch_size
      ) loop
        insert into public.asset_tag_link (asset_id, tag_id, active, download_profiles, created_at, last_modified)
        select ma.dst_id, lrec.tag_id, lrec.active, '{}'::uuid[], now(), now()
        from public.map_asset ma
        where ma.job_id = p_job_id and ma.src_id = lrec.asset_id
          and not exists (select 1 from public.asset_tag_link t where t.asset_id = ma.dst_id and t.tag_id = lrec.tag_id);
        get diagnostics v_last = row_count;
        v_rows := v_rows + v_last;
      end loop;
    end if;

    if v_rows = 0 then
      update public.clone_job set progress = progress || jsonb_build_object('stage','recompute_closures'), updated_at = now() where id = p_job_id;
    end if;
    return query select false, format('recreated links batch: %s', v_rows);
  end if;

  -- Stage 5: recompute_closures
  if v_stage = 'recompute_closures' then
    insert into public.quest_closure (quest_id, project_id)
    select q.id, q.project_id from public.quest q where q.project_id = v_dst_project_id
    on conflict (quest_id) do nothing;

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
    update public.clone_job set progress = progress || jsonb_build_object('stage','done'), status = 'done', updated_at = now() where id = p_job_id;
    return query select true, 'done';
  end if;

  return query select false, 'noop';

exception when others then
  -- mark job failed and capture error
  update public.clone_job
  set status = 'failed',
      progress = coalesce(progress,'{}'::jsonb) || jsonb_build_object('error', coalesce(SQLERRM,'unknown'), 'stage', coalesce(v_stage,'unknown')),
      updated_at = now()
  where id = p_job_id;
  return query select true, format('failed: %s', SQLERRM);
end;
$$;


