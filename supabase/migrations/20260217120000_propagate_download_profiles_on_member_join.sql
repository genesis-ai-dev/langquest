-- ============================================================================
-- Migration: Propagate download_profiles when a member joins a project
-- ============================================================================
--
-- PURPOSE:
-- When a user joins a project (via invite acceptance, request approval, or
-- project cloning), their profile ID must be added to download_profiles on:
--   - project
--   - project_language_link (all active PLLs for the project)
--   - languoid and 8 related tables (via PLL languoid_id references)
--   - project_closure
--
-- Previously, only download_quest_closure / download_project_closure RPCs
-- (called during explicit quest/project downloads) performed this propagation.
-- This left a gap: users who joined a project but hadn't yet downloaded a
-- quest would not have PLL or languoid data synced to their device.
--
-- CHANGES:
-- 1. New trigger on profile_project_link to cascade download_profiles
-- 2. Fix clone_step_project to set download_profiles on PLL records
-- 3. Backfill existing data for all active project members
--
-- AFFECTED TABLES:
-- - profile_project_link (trigger source)
-- - project
-- - project_language_link
-- - project_closure
-- - languoid, languoid_alias, languoid_source, languoid_property
-- - languoid_region, region, region_alias, region_source, region_property
--
-- ============================================================================

-- Increase timeout for backfill operations
set statement_timeout = '30min';
set search_path = public;

-- ============================================================================
-- PART 1: Trigger on profile_project_link to propagate download_profiles
-- ============================================================================
-- When a member becomes active on a project, add their profile_id to
-- download_profiles on the project, its PLLs, and all referenced languoid
-- and region tables.

create or replace function public.propagate_member_to_project_download_profiles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_project_id uuid;
  v_languoid_ids uuid[];
begin
  -- Only process when member becomes active
  if new.active is not true then
    return new;
  end if;

  v_profile_id := new.profile_id;
  v_project_id := new.project_id;

  raise notice '[propagate_member_to_project] Processing project_id=%, profile_id=%',
    v_project_id, v_profile_id;

  -- ========================================================================
  -- 1. UPDATE PROJECT
  -- ========================================================================
  update public.project
  set
    download_profiles = case
      when download_profiles @> array[v_profile_id] then download_profiles
      else array_append(coalesce(download_profiles, '{}'), v_profile_id)
    end
  where id = v_project_id
    and (download_profiles is null or not download_profiles @> array[v_profile_id]);

  -- ========================================================================
  -- 2. UPDATE PROJECT_LANGUAGE_LINK
  -- ========================================================================
  update public.project_language_link
  set
    download_profiles = case
      when download_profiles @> array[v_profile_id] then download_profiles
      else array_append(coalesce(download_profiles, '{}'), v_profile_id)
    end
  where project_id = v_project_id
    and active = true
    and (download_profiles is null or not download_profiles @> array[v_profile_id]);

  -- ========================================================================
  -- 3. UPDATE PROJECT_CLOSURE
  -- ========================================================================
  update public.project_closure
  set
    download_profiles = case
      when download_profiles @> array[v_profile_id] then download_profiles
      else array_append(coalesce(download_profiles, '{}'), v_profile_id)
    end
  where project_id = v_project_id
    and (download_profiles is null or not download_profiles @> array[v_profile_id]);

  -- ========================================================================
  -- Collect languoid IDs from the project's PLLs for cascade
  -- ========================================================================
  select array_agg(distinct pll.languoid_id)
  into v_languoid_ids
  from public.project_language_link pll
  where pll.project_id = v_project_id
    and pll.active = true
    and pll.languoid_id is not null;

  -- If no languoids referenced, we're done
  if v_languoid_ids is null or array_length(v_languoid_ids, 1) is null then
    return new;
  end if;

  -- ========================================================================
  -- 4. UPDATE LANGUOID
  -- ========================================================================
  update public.languoid
  set
    download_profiles = case
      when download_profiles @> array[v_profile_id] then download_profiles
      else array_append(coalesce(download_profiles, '{}'), v_profile_id)
    end,
    last_updated = now()
  where id = any(v_languoid_ids)
    and (download_profiles is null or not download_profiles @> array[v_profile_id]);

  -- ========================================================================
  -- 5. UPDATE LANGUOID_ALIAS
  -- ========================================================================
  update public.languoid_alias
  set
    download_profiles = case
      when download_profiles @> array[v_profile_id] then download_profiles
      else array_append(coalesce(download_profiles, '{}'), v_profile_id)
    end,
    last_updated = now()
  where subject_languoid_id = any(v_languoid_ids)
    and (download_profiles is null or not download_profiles @> array[v_profile_id]);

  -- ========================================================================
  -- 6. UPDATE LANGUOID_SOURCE
  -- ========================================================================
  update public.languoid_source
  set
    download_profiles = case
      when download_profiles @> array[v_profile_id] then download_profiles
      else array_append(coalesce(download_profiles, '{}'), v_profile_id)
    end,
    last_updated = now()
  where languoid_id = any(v_languoid_ids)
    and (download_profiles is null or not download_profiles @> array[v_profile_id]);

  -- ========================================================================
  -- 7. UPDATE LANGUOID_PROPERTY
  -- ========================================================================
  update public.languoid_property
  set
    download_profiles = case
      when download_profiles @> array[v_profile_id] then download_profiles
      else array_append(coalesce(download_profiles, '{}'), v_profile_id)
    end,
    last_updated = now()
  where languoid_id = any(v_languoid_ids)
    and (download_profiles is null or not download_profiles @> array[v_profile_id]);

  -- ========================================================================
  -- 8. UPDATE LANGUOID_REGION
  -- ========================================================================
  update public.languoid_region
  set
    download_profiles = case
      when download_profiles @> array[v_profile_id] then download_profiles
      else array_append(coalesce(download_profiles, '{}'), v_profile_id)
    end,
    last_updated = now()
  where languoid_id = any(v_languoid_ids)
    and (download_profiles is null or not download_profiles @> array[v_profile_id]);

  -- ========================================================================
  -- 9. UPDATE REGION (via languoid_region join)
  -- ========================================================================
  update public.region r
  set
    download_profiles = case
      when r.download_profiles @> array[v_profile_id] then r.download_profiles
      else array_append(coalesce(r.download_profiles, '{}'), v_profile_id)
    end,
    last_updated = now()
  where r.id in (
    select lr.region_id
    from public.languoid_region lr
    where lr.languoid_id = any(v_languoid_ids)
  )
  and (r.download_profiles is null or not r.download_profiles @> array[v_profile_id]);

  -- ========================================================================
  -- 10. UPDATE REGION_ALIAS (via languoid_region -> region)
  -- ========================================================================
  update public.region_alias ra
  set
    download_profiles = case
      when ra.download_profiles @> array[v_profile_id] then ra.download_profiles
      else array_append(coalesce(ra.download_profiles, '{}'), v_profile_id)
    end,
    last_updated = now()
  where ra.subject_region_id in (
    select lr.region_id
    from public.languoid_region lr
    where lr.languoid_id = any(v_languoid_ids)
  )
  and (ra.download_profiles is null or not ra.download_profiles @> array[v_profile_id]);

  -- ========================================================================
  -- 11. UPDATE REGION_SOURCE (via languoid_region -> region)
  -- ========================================================================
  update public.region_source rs
  set
    download_profiles = case
      when rs.download_profiles @> array[v_profile_id] then rs.download_profiles
      else array_append(coalesce(rs.download_profiles, '{}'), v_profile_id)
    end,
    last_updated = now()
  where rs.region_id in (
    select lr.region_id
    from public.languoid_region lr
    where lr.languoid_id = any(v_languoid_ids)
  )
  and (rs.download_profiles is null or not rs.download_profiles @> array[v_profile_id]);

  -- ========================================================================
  -- 12. UPDATE REGION_PROPERTY (via languoid_region -> region)
  -- ========================================================================
  update public.region_property rp
  set
    download_profiles = case
      when rp.download_profiles @> array[v_profile_id] then rp.download_profiles
      else array_append(coalesce(rp.download_profiles, '{}'), v_profile_id)
    end,
    last_updated = now()
  where rp.region_id in (
    select lr.region_id
    from public.languoid_region lr
    where lr.languoid_id = any(v_languoid_ids)
  )
  and (rp.download_profiles is null or not rp.download_profiles @> array[v_profile_id]);

  return new;
end;
$$;

-- Drop existing trigger if any (idempotency)
drop trigger if exists propagate_member_to_project_download_profiles_trigger
  on public.profile_project_link;

-- Create the trigger: fires when a member joins (INSERT) or is reactivated (UPDATE)
create trigger propagate_member_to_project_download_profiles_trigger
after insert or update on public.profile_project_link
for each row
when (new.active = true)
execute function public.propagate_member_to_project_download_profiles();


-- ============================================================================
-- PART 2: Fix clone_step_project to set download_profiles on PLL records
-- ============================================================================
-- The perform_clone_step function inserts project_language_link records without
-- download_profiles, so the PLL INSERT trigger cannot cascade to languoid tables.
-- Update to include the creator's ID in download_profiles.
-- Also set the creator's ID on the cloned project's download_profiles.

create or replace function public.perform_clone_step(p_job_id uuid, p_batch_size integer default 25)
returns table(done boolean, message text)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_locked boolean;
  v_stage text;
  v_status text;
  v_opts jsonb;
  v_root_project_id uuid;
  v_dst_project_id uuid;
  v_new_name text;
  v_target_language_id uuid;
  v_target_languoid_id uuid;
  v_creator_id uuid;
  v_rows int := 0;
  v_last int := 0;
  qrec record;
  arec record;
  lrec record;
begin
  -- Acquire advisory lock (one worker per job)
  select pg_try_advisory_xact_lock(hashtext(p_job_id::text)) into v_locked;
  if not v_locked then
    return query select false, 'Could not acquire lock';
    return;
  end if;

  -- Read job state
  select status, current_stage, options, root_project_id
  into v_status, v_stage, v_opts, v_root_project_id
  from public.clone_job where id = p_job_id;

  if v_status is null then
    return query select true, 'Job not found';
    return;
  end if;
  if v_status in ('completed','failed') then
    return query select true, format('Job already %s', v_status);
    return;
  end if;

  -- Set status to running
  update public.clone_job set status = 'running', updated_at = now() where id = p_job_id;

  -- Parse options
  v_new_name := coalesce(v_opts->>'new_project_name', 'Cloned Project');
  v_target_language_id := nullif(v_opts->>'target_language_id','')::uuid;
  v_target_languoid_id := nullif(v_opts->>'target_languoid_id','')::uuid;
  v_creator_id := nullif(v_opts->>'creator_id','')::uuid;
  p_batch_size := greatest(coalesce(p_batch_size, (v_opts->>'batch_size')::int), 1);

  perform set_config('app.clone_mode','on', true);

  -- =========================================================================
  -- STAGE: seed_project
  -- =========================================================================
  if v_stage = 'seed_project' then
    if not exists (select 1 from public.map_project where job_id = p_job_id and src_id = v_root_project_id) then

      -- Create the cloned project (include creator in download_profiles)
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
        case when v_creator_id is not null then array[v_creator_id] else '{}'::uuid[] end,
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

      -- Copy source language links (include creator in download_profiles)
      insert into public.project_language_link(project_id, language_id, languoid_id, language_type, active, created_at, last_updated, download_profiles)
      select v_dst_project_id, pll.language_id, pll.languoid_id, pll.language_type, pll.active, now(), now(),
        case when v_creator_id is not null then array[v_creator_id] else '{}'::uuid[] end
      from public.project_language_link pll
      where pll.project_id = v_root_project_id and pll.language_type = 'source'
      on conflict do nothing;

      -- Create target language link if specified (include creator in download_profiles)
      if v_target_languoid_id is not null then
        insert into public.project_language_link(project_id, language_id, languoid_id, language_type, active, created_at, last_updated, download_profiles)
        values (v_dst_project_id, v_target_language_id, v_target_languoid_id, 'target', true, now(), now(),
          case when v_creator_id is not null then array[v_creator_id] else '{}'::uuid[] end)
        on conflict do nothing;
      elsif v_target_language_id is not null then
        -- Fallback: try to get languoid_id from source project's target link
        insert into public.project_language_link(project_id, language_id, languoid_id, language_type, active, created_at, last_updated, download_profiles)
        select v_dst_project_id, v_target_language_id, pll.languoid_id, 'target', true, now(), now(),
          case when v_creator_id is not null then array[v_creator_id] else '{}'::uuid[] end
        from public.project_language_link pll
        where pll.project_id = v_root_project_id and pll.language_type = 'target'
        limit 1
        on conflict do nothing;
        
        -- If no existing target link, insert without languoid_id
        if not found then
          insert into public.project_language_link(project_id, language_id, languoid_id, language_type, active, created_at, last_updated, download_profiles)
          values (v_dst_project_id, v_target_language_id, null, 'target', true, now(), now(),
            case when v_creator_id is not null then array[v_creator_id] else '{}'::uuid[] end)
          on conflict do nothing;
        end if;
      end if;

      -- Create owner link
      -- Note: the new propagate_member_to_project_download_profiles trigger will also fire
      -- on this insert, but it's idempotent so no harm done
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


-- ============================================================================
-- PART 3: Backfill existing data
-- ============================================================================
-- For all active profile_project_link records, ensure each member's profile ID
-- exists in the download_profiles of:
-- - project
-- - project_language_link
-- - project_closure
-- - languoid and all related tables (via PLL languoid_id references)

do $$
declare
  v_projects_updated integer := 0;
  v_plls_updated integer := 0;
  v_closures_updated integer := 0;
  v_languoids_updated integer := 0;
  v_aliases_updated integer := 0;
  v_sources_updated integer := 0;
  v_properties_updated integer := 0;
  v_languoid_regions_updated integer := 0;
  v_regions_updated integer := 0;
  v_region_aliases_updated integer := 0;
  v_region_sources_updated integer := 0;
  v_region_properties_updated integer := 0;
begin
  raise notice '[backfill] Starting download_profiles backfill for active project members...';

  -- ========================================================================
  -- Backfill project.download_profiles
  -- ========================================================================
  -- For each active member, ensure their ID is in their project's download_profiles
  with member_projects as (
    select distinct ppl.profile_id, ppl.project_id
    from public.profile_project_link ppl
    where ppl.active = true
  )
  update public.project p
  set download_profiles = (
    select array_agg(distinct elem)
    from (
      select unnest(coalesce(p.download_profiles, '{}')) as elem
      union
      select mp.profile_id
      from member_projects mp
      where mp.project_id = p.id
    ) combined
  )
  where p.id in (select distinct project_id from member_projects);
  get diagnostics v_projects_updated = row_count;
  raise notice '[backfill] Updated project: % rows', v_projects_updated;

  -- ========================================================================
  -- Backfill project_language_link.download_profiles
  -- ========================================================================
  -- For each active PLL, ensure all active members of the project are in download_profiles
  with member_projects as (
    select distinct ppl.profile_id, ppl.project_id
    from public.profile_project_link ppl
    where ppl.active = true
  )
  update public.project_language_link pll
  set download_profiles = (
    select array_agg(distinct elem)
    from (
      select unnest(coalesce(pll.download_profiles, '{}')) as elem
      union
      select mp.profile_id
      from member_projects mp
      where mp.project_id = pll.project_id
    ) combined
  )
  where pll.active = true
    and pll.project_id in (select distinct project_id from member_projects);
  get diagnostics v_plls_updated = row_count;
  raise notice '[backfill] Updated project_language_link: % rows', v_plls_updated;

  -- ========================================================================
  -- Backfill project_closure.download_profiles
  -- ========================================================================
  with member_projects as (
    select distinct ppl.profile_id, ppl.project_id
    from public.profile_project_link ppl
    where ppl.active = true
  )
  update public.project_closure pc
  set download_profiles = (
    select array_agg(distinct elem)
    from (
      select unnest(coalesce(pc.download_profiles, '{}')) as elem
      union
      select mp.profile_id
      from member_projects mp
      where mp.project_id = pc.project_id
    ) combined
  )
  where pc.project_id in (select distinct project_id from member_projects);
  get diagnostics v_closures_updated = row_count;
  raise notice '[backfill] Updated project_closure: % rows', v_closures_updated;

  -- ========================================================================
  -- Backfill languoid tables from PLL references
  -- ========================================================================
  -- For each languoid referenced by a PLL, ensure all active members of that
  -- project are in the languoid's download_profiles

  -- Collect the mapping: which profile_ids need to be on which languoid_ids
  -- Then update each languoid table

  -- Backfill languoid.download_profiles
  with pll_members as (
    select distinct pll.languoid_id, ppl.profile_id
    from public.project_language_link pll
    join public.profile_project_link ppl
      on ppl.project_id = pll.project_id and ppl.active = true
    where pll.active = true and pll.languoid_id is not null
  )
  update public.languoid lo
  set download_profiles = (
    select array_agg(distinct elem)
    from (
      select unnest(coalesce(lo.download_profiles, '{}')) as elem
      union
      select pm.profile_id
      from pll_members pm
      where pm.languoid_id = lo.id
    ) combined
  )
  where lo.id in (select distinct languoid_id from pll_members);
  get diagnostics v_languoids_updated = row_count;
  raise notice '[backfill] Updated languoid: % rows', v_languoids_updated;

  -- Backfill languoid_alias from languoid.download_profiles
  with languoid_profiles as (
    select id, download_profiles from public.languoid
    where download_profiles is not null and array_length(download_profiles, 1) > 0
  )
  update public.languoid_alias la
  set download_profiles = lp.download_profiles
  from languoid_profiles lp
  where la.subject_languoid_id = lp.id
    and (la.download_profiles is null or la.download_profiles <> lp.download_profiles);
  get diagnostics v_aliases_updated = row_count;
  raise notice '[backfill] Updated languoid_alias: % rows', v_aliases_updated;

  -- Backfill languoid_source
  with languoid_profiles as (
    select id, download_profiles from public.languoid
    where download_profiles is not null and array_length(download_profiles, 1) > 0
  )
  update public.languoid_source ls
  set download_profiles = lp.download_profiles
  from languoid_profiles lp
  where ls.languoid_id = lp.id
    and (ls.download_profiles is null or ls.download_profiles <> lp.download_profiles);
  get diagnostics v_sources_updated = row_count;
  raise notice '[backfill] Updated languoid_source: % rows', v_sources_updated;

  -- Backfill languoid_property
  with languoid_profiles as (
    select id, download_profiles from public.languoid
    where download_profiles is not null and array_length(download_profiles, 1) > 0
  )
  update public.languoid_property lp_tbl
  set download_profiles = lp.download_profiles
  from languoid_profiles lp
  where lp_tbl.languoid_id = lp.id
    and (lp_tbl.download_profiles is null or lp_tbl.download_profiles <> lp.download_profiles);
  get diagnostics v_properties_updated = row_count;
  raise notice '[backfill] Updated languoid_property: % rows', v_properties_updated;

  -- Backfill languoid_region
  with languoid_profiles as (
    select id, download_profiles from public.languoid
    where download_profiles is not null and array_length(download_profiles, 1) > 0
  )
  update public.languoid_region lr
  set download_profiles = lp.download_profiles
  from languoid_profiles lp
  where lr.languoid_id = lp.id
    and (lr.download_profiles is null or lr.download_profiles <> lp.download_profiles);
  get diagnostics v_languoid_regions_updated = row_count;
  raise notice '[backfill] Updated languoid_region: % rows', v_languoid_regions_updated;

  -- Backfill region - aggregate profiles from all languoids linked to each region
  with region_profiles as (
    select lr.region_id, array_agg(distinct elem) as profiles
    from public.languoid_region lr
    cross join lateral unnest(lr.download_profiles) as elem
    where lr.download_profiles is not null and array_length(lr.download_profiles, 1) > 0
    group by lr.region_id
  )
  update public.region r
  set download_profiles = rp.profiles
  from region_profiles rp
  where r.id = rp.region_id
    and (r.download_profiles is null or r.download_profiles <> rp.profiles);
  get diagnostics v_regions_updated = row_count;
  raise notice '[backfill] Updated region: % rows', v_regions_updated;

  -- Backfill region_alias
  with region_profiles as (
    select id, download_profiles from public.region
    where download_profiles is not null and array_length(download_profiles, 1) > 0
  )
  update public.region_alias ra
  set download_profiles = rp.download_profiles
  from region_profiles rp
  where ra.subject_region_id = rp.id
    and (ra.download_profiles is null or ra.download_profiles <> rp.download_profiles);
  get diagnostics v_region_aliases_updated = row_count;
  raise notice '[backfill] Updated region_alias: % rows', v_region_aliases_updated;

  -- Backfill region_source
  with region_profiles as (
    select id, download_profiles from public.region
    where download_profiles is not null and array_length(download_profiles, 1) > 0
  )
  update public.region_source rs
  set download_profiles = rp.download_profiles
  from region_profiles rp
  where rs.region_id = rp.id
    and (rs.download_profiles is null or rs.download_profiles <> rp.download_profiles);
  get diagnostics v_region_sources_updated = row_count;
  raise notice '[backfill] Updated region_source: % rows', v_region_sources_updated;

  -- Backfill region_property
  with region_profiles as (
    select id, download_profiles from public.region
    where download_profiles is not null and array_length(download_profiles, 1) > 0
  )
  update public.region_property rp_tbl
  set download_profiles = rp.download_profiles
  from region_profiles rp
  where rp_tbl.region_id = rp.id
    and (rp_tbl.download_profiles is null or rp_tbl.download_profiles <> rp.download_profiles);
  get diagnostics v_region_properties_updated = row_count;
  raise notice '[backfill] Updated region_property: % rows', v_region_properties_updated;

  raise notice '[backfill] Completed. Summary: project=%, pll=%, closure=%, languoid=%, alias=%, source=%, property=%, languoid_region=%, region=%, region_alias=%, region_source=%, region_property=%',
    v_projects_updated, v_plls_updated, v_closures_updated,
    v_languoids_updated, v_aliases_updated, v_sources_updated, v_properties_updated,
    v_languoid_regions_updated, v_regions_updated, v_region_aliases_updated,
    v_region_sources_updated, v_region_properties_updated;
end;
$$;
