-- ============================================================================
-- Migration: Fix perform_clone_step - Merge Nov 23 improvements with languoid support
-- ============================================================================
-- 
-- PURPOSE:
-- The migration 20251125120000_add_languoid_references.sql accidentally overwrote
-- the improved clone function from 20251123052112_new_clone_step_rpc.sql with an
-- older/different implementation.
--
-- This migration restores the Nov 23 improvements while keeping languoid support:
--
-- RESTORED FROM NOV 23:
-- 1. Quest cloning with description, clone_id, and parent_id
-- 2. Parent_id propagation logic (preserves quest hierarchy)
-- 3. Asset cloning filtered by quest_asset_link and source_asset_id IS NULL
-- 4. Consolidated recreate_links stage (more efficient)
-- 5. Proper stage flow: seed_project -> clone_quests -> clone_assets -> 
--    clone_acl -> recreate_links -> recompute_closures
--
-- ADDED FROM NOV 25 (languoid support):
-- 1. v_target_languoid_id parameter from options
-- 2. languoid_id in project_language_link inserts
-- 3. languoid_id in asset_content_link inserts
--
-- ============================================================================

CREATE OR REPLACE FUNCTION public.perform_clone_step(p_job_id uuid, p_batch_size integer DEFAULT 25)
RETURNS TABLE(done boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  v_locked boolean;
  v_stage text;
  v_status text;
  v_opts jsonb;
  v_root_project_id uuid;
  v_dst_project_id uuid;
  v_new_name text;
  v_target_language_id uuid;
  v_target_languoid_id uuid;  -- Added for languoid support
  v_creator_id uuid;
  v_rows int := 0;
  v_last int := 0;
  qrec record;
  arec record;
  lrec record;
begin
  -- Acquire advisory lock (one worker per job)
  select pg_try_advisory_lock(hashtext(p_job_id::text)) into v_locked;
  if not coalesce(v_locked, false) then
    return query select false, 'lock not acquired';
    return;
  end if;

  -- Read current state
  select (progress->>'stage')::text, status, options, root_project_id
  into v_stage, v_status, v_opts, v_root_project_id
  from public.clone_job
  where id = p_job_id;
  if v_stage is null then v_stage := 'seed_project'; end if;

  -- Terminal guard: if already done, ensure status is correct
  if v_stage = 'done' then
    update public.clone_job
    set status = 'done', updated_at = now()
    where id = p_job_id and status != 'done';
    return query select true, 'done';
  end if;

  -- Set status to running
  update public.clone_job set status = 'running', updated_at = now() where id = p_job_id;

  -- Parse options
  v_new_name := coalesce(v_opts->>'new_project_name', 'Cloned Project');
  v_target_language_id := nullif(v_opts->>'target_language_id','')::uuid;
  v_target_languoid_id := nullif(v_opts->>'target_languoid_id','')::uuid;  -- Added for languoid support
  v_creator_id := nullif(v_opts->>'creator_id','')::uuid;
  p_batch_size := greatest(coalesce(p_batch_size, (v_opts->>'batch_size')::int), 1);

  perform set_config('app.clone_mode','on', true);

  -- =========================================================================
  -- STAGE: seed_project
  -- =========================================================================
  if v_stage = 'seed_project' then
    if not exists (select 1 from public.map_project where job_id = p_job_id and src_id = v_root_project_id) then

      -- Create the cloned project
      insert into public.project (
        name,
        description,
        target_language_id,
        active,
        creator_id,
        private,
        visible,
        download_profiles,
        created_at,
        last_updated,
        clone_id,
        template
      )
      select
        v_new_name,
        p.description,
        coalesce(v_target_language_id, p.target_language_id),
        coalesce(p.active, true),
        v_creator_id,
        p.private,
        p.visible,
        '{}'::uuid[],
        now(),
        now(),
        v_root_project_id,
        p.template  
      from public.project p
      where p.id = v_root_project_id
      returning id into v_dst_project_id;

      insert into public.map_project(job_id, src_id, dst_id)
      values (p_job_id, v_root_project_id, v_dst_project_id)
      on conflict do nothing;

      -- Copy source language links (with languoid_id support)
      insert into public.project_language_link(project_id, language_id, languoid_id, language_type, active, created_at, last_updated)
      select v_dst_project_id, pll.language_id, pll.languoid_id, pll.language_type, pll.active, now(), now()
      from public.project_language_link pll
      where pll.project_id = v_root_project_id and pll.language_type = 'source'
      on conflict do nothing;

      -- Create target language link if specified (with languoid_id support)
      if v_target_languoid_id is not null then
        -- New languoid-based target language
        insert into public.project_language_link(project_id, language_id, languoid_id, language_type, active, created_at, last_updated)
        values (v_dst_project_id, v_target_language_id, v_target_languoid_id, 'target', true, now(), now())
        on conflict do nothing;
      elsif v_target_language_id is not null then
        -- Fallback: try to get languoid_id from source project's target link
        insert into public.project_language_link(project_id, language_id, languoid_id, language_type, active, created_at, last_updated)
        select v_dst_project_id, v_target_language_id, pll.languoid_id, 'target', true, now(), now()
        from public.project_language_link pll
        where pll.project_id = v_root_project_id and pll.language_type = 'target'
        limit 1
        on conflict do nothing;
        
        -- If no existing target link, insert without languoid_id
        if not found then
          insert into public.project_language_link(project_id, language_id, languoid_id, language_type, active, created_at, last_updated)
          values (v_dst_project_id, v_target_language_id, null, 'target', true, now(), now())
          on conflict do nothing;
        end if;
      end if;

      -- Create owner link
      insert into public.profile_project_link (profile_id, project_id, membership, active)
      values (v_creator_id, v_dst_project_id, 'owner', true)
      on conflict do nothing;

    else
      -- Project already seeded, just ensure ownership
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

  -- Ensure we have dst_project_id for subsequent stages
  if v_dst_project_id is null then
    select dst_id into v_dst_project_id from public.map_project where job_id = p_job_id and src_id = v_root_project_id;
  end if;

  -- =========================================================================
  -- STAGE: clone_quests (with description, clone_id, and parent_id support)
  -- =========================================================================
  if v_stage = 'clone_quests' then
    v_rows := 0;

    for qrec in (
      select q.*
      from public.quest q
      where q.project_id = v_root_project_id
        and not exists (
          select 1 from public.map_quest mq 
          where mq.job_id = p_job_id and mq.src_id = q.id
        )
      order by q.created_at
      limit p_batch_size
    ) loop

      insert into public.quest (
        name,
        description,
        project_id,
        active,
        creator_id,
        visible,
        metadata,
        clone_id,
        download_profiles,
        created_at,
        last_updated,
        parent_id
      )
      values (
        qrec.name,
        qrec.description,
        v_dst_project_id,
        qrec.active,
        v_creator_id,
        qrec.visible,
        qrec.metadata,
        qrec.id,
        '{}'::uuid[],
        now(),
        now(),
        null  -- parent_id set in second pass
      )
      returning id into arec;

      insert into public.map_quest(job_id, src_id, dst_id)
      values (p_job_id, qrec.id, arec.id)
      on conflict do nothing;

      v_rows := v_rows + 1;

    end loop;

    -- IMPORTANT: Propagate parent_id after all quests in batch are cloned
    -- This preserves the quest hierarchy
    update public.quest dst
    set parent_id = mq_parent.dst_id
    from public.map_quest mq
    join public.quest src on src.id = mq.src_id
    join public.map_quest mq_parent 
         on mq_parent.job_id = p_job_id
        and mq_parent.src_id = src.parent_id
    where 
      mq.job_id = p_job_id
      and dst.id = mq.dst_id
      and src.parent_id is not null
      and dst.parent_id is distinct from mq_parent.dst_id;

    if v_rows < p_batch_size then
      update public.clone_job
        set progress = progress || jsonb_build_object('stage','clone_assets'),
            updated_at = now()
      where id = p_job_id;
    end if;

    return query select false, format('cloned quests batch: %s', v_rows);
  end if;

  -- =========================================================================
  -- STAGE: clone_assets (filtered by quest_asset_link, excludes translations)
  -- =========================================================================
  if v_stage = 'clone_assets' then
    v_rows := 0;
    for arec in (
      select distinct a.*
      from public.asset a
      join public.quest_asset_link qal on qal.asset_id = a.id
      join public.quest q on q.id = qal.quest_id and q.project_id = v_root_project_id
      where qal.active = true and a.active = true
        and a.source_asset_id is null  -- Exclude translation assets
        and not exists (select 1 from public.map_asset ma where ma.job_id = p_job_id and ma.src_id = a.id)
      order by a.created_at
      limit p_batch_size
    ) loop
      insert into public.asset (name, images, active, creator_id, visible, clone_id, download_profiles, source_language_id, project_id, created_at, last_updated)
      values (arec.name, arec.images, arec.active, v_creator_id, arec.visible, arec.id, '{}'::uuid[], arec.source_language_id, v_dst_project_id, now(), now())
      returning id into qrec;
      insert into public.map_asset(job_id, src_id, dst_id) values (p_job_id, arec.id, qrec.id) on conflict do nothing;
      v_rows := v_rows + 1;
    end loop;
    if v_rows < p_batch_size then
      update public.clone_job set progress = progress || jsonb_build_object('stage','clone_acl'), updated_at = now() where id = p_job_id;
    end if;
    return query select false, format('cloned assets batch: %s', v_rows);
  end if;

  -- =========================================================================
  -- STAGE: clone_acl (asset_content_link with languoid_id support)
  -- =========================================================================
  if v_stage = 'clone_acl' then
    v_rows := 0;
    for arec in (
      select s.* from public.asset_content_link s
      join public.map_asset ma on ma.job_id = p_job_id and ma.src_id = s.asset_id
      where not exists (select 1 from public.map_acl m where m.job_id = p_job_id and m.src_id = s.id)
      order by s.created_at
      limit p_batch_size
    ) loop
      -- Clone with languoid_id support
      insert into public.asset_content_link (asset_id, audio, text, active, download_profiles, source_language_id, languoid_id, created_at, last_updated)
      select ma.dst_id, arec.audio, arec.text, arec.active, '{}'::uuid[], arec.source_language_id, arec.languoid_id, now(), now()
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

  -- =========================================================================
  -- STAGE: recreate_links (consolidated: quest_asset_link, quest_tag_link, asset_tag_link)
  -- =========================================================================
  if v_stage = 'recreate_links' then
    v_rows := 0;

    -- First: quest_asset_link
    for lrec in (
      select qal.*
      from public.quest_asset_link qal
      join public.quest q on q.id = qal.quest_id and q.project_id = v_root_project_id
      where exists (select 1 from public.map_quest mq where mq.job_id = p_job_id and mq.src_id = qal.quest_id)
        and exists (select 1 from public.map_asset ma where ma.job_id = p_job_id and ma.src_id = qal.asset_id)
        and not exists (
          select 1
          from public.map_quest mq, public.map_asset ma, public.quest_asset_link dst
          where mq.job_id = p_job_id and ma.job_id = p_job_id
            and mq.src_id = qal.quest_id and ma.src_id = qal.asset_id
            and dst.quest_id = mq.dst_id and dst.asset_id = ma.dst_id
        )
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

    -- Second: quest_tag_link (only if no quest_asset_links were processed)
    if v_rows = 0 then
      for lrec in (
        select qtl.*
        from public.quest_tag_link qtl
        join public.quest q on q.id = qtl.quest_id and q.project_id = v_root_project_id
        where exists (select 1 from public.map_quest mq where mq.job_id = p_job_id and mq.src_id = qtl.quest_id)
          and not exists (
            select 1
            from public.map_quest mq, public.quest_tag_link dst
            where mq.job_id = p_job_id
              and mq.src_id = qtl.quest_id
              and dst.quest_id = mq.dst_id and dst.tag_id = qtl.tag_id
          )
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

    -- Third: asset_tag_link (only if no quest_tag_links were processed)
    if v_rows = 0 then
      for lrec in (
        select atl.*
        from public.asset_tag_link atl
        where exists (select 1 from public.map_asset ma where ma.job_id = p_job_id and ma.src_id = atl.asset_id)
          and not exists (
            select 1
            from public.map_asset ma, public.asset_tag_link dst
            where ma.job_id = p_job_id
              and ma.src_id = atl.asset_id
              and dst.asset_id = ma.dst_id and dst.tag_id = atl.tag_id
          )
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

  -- =========================================================================
  -- STAGE: recompute_closures (currently no-op, closure logic commented out)
  -- =========================================================================
  if v_stage = 'recompute_closures' then
    -- Note: Closure computation is currently disabled
    -- If needed, uncomment and implement:
    -- insert into public.quest_closure (quest_id, project_id)
    -- select q.id, q.project_id from public.quest q where q.project_id = v_dst_project_id
    -- on conflict (quest_id) do nothing;
    --
    -- v_rows := public.rebuild_project_quest_closures_batch(
    --   v_dst_project_id,
    --   (select created_at from public.clone_job where id = p_job_id),
    --   p_batch_size
    -- );
    -- if v_rows > 0 then
    --   return query select false, format('rebuilt quest closures batch: %s', v_rows);
    -- end if;
    --
    -- v_rows := public.rebuild_project_closure_batch(v_dst_project_id, greatest(p_batch_size * 4, 100));
    -- if v_rows > 0 then
    --   return query select false, format('rebuilt project closure batch: %s', v_rows);
    -- end if;
    --
    -- perform public.finalize_project_closure(v_dst_project_id);

    update public.clone_job 
    set progress = progress || jsonb_build_object('stage','done'), 
        status = 'done', 
        updated_at = now() 
    where id = p_job_id;

    return query select true, 'done';
  end if;

  return query select false, 'noop';

exception when others then
  update public.clone_job
  set status = 'failed',
      progress = coalesce(progress,'{}'::jsonb) || jsonb_build_object('error', coalesce(SQLERRM,'unknown'), 'stage', coalesce(v_stage,'unknown')),
      updated_at = now()
  where id = p_job_id;
  return query select true, format('failed: %s', SQLERRM);
end;
$function$;

