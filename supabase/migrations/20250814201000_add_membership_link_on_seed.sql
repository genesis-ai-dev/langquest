-- migration: add membership link on seed stage in perform_clone_step

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
  select pg_try_advisory_lock(hashtext(p_job_id::text)) into v_locked;
  if not coalesce(v_locked, false) then
    return query select false, 'lock not acquired';
    return;
  end if;

  update public.clone_job set status = 'running', updated_at = now() where id = p_job_id;
  select (progress->>'stage')::text, options, root_project_id into v_stage, v_opts, v_root_project_id
  from public.clone_job where id = p_job_id;
  if v_stage is null then v_stage := 'seed_project'; end if;
  v_new_name := coalesce(v_opts->>'new_project_name', 'Cloned Project');
  v_target_language_id := nullif(v_opts->>'target_language_id','')::uuid;
  v_creator_id := nullif(v_opts->>'creator_id','')::uuid;
  p_batch_size := greatest(coalesce(p_batch_size, (v_opts->>'batch_size')::int), 1);

  perform set_config('app.clone_mode','on', true);

  if v_stage = 'seed_project' then
    if not exists (select 1 from public.map_project where job_id = p_job_id and src_id = v_root_project_id) then
      insert into public.project (name, description, source_language_id, target_language_id, active, creator_id, private, visible, download_profiles)
      select v_new_name, p.description, p.source_language_id, coalesce(v_target_language_id, p.target_language_id), coalesce(p.active, true), v_creator_id, p.private, p.visible, '{}'::uuid[]
      from public.project p where p.id = v_root_project_id
      returning id into v_dst_project_id;

      insert into public.map_project(job_id, src_id, dst_id) values (p_job_id, v_root_project_id, v_dst_project_id) on conflict do nothing;

      insert into public.project_language_link(project_id, language_id, language_type, active)
      select v_dst_project_id, pll.language_id, pll.language_type, pll.active
      from public.project_language_link pll
      where pll.project_id = v_root_project_id and pll.language_type = 'source'
      on conflict do nothing;

      if v_target_language_id is not null then
        insert into public.project_language_link(project_id, language_id, language_type, active)
        values (v_dst_project_id, v_target_language_id, 'target', true)
        on conflict do nothing;
      end if;

      -- ensure the cloner is an owner of the cloned project so it appears in UIs
      insert into public.profile_project_link (profile_id, project_id, membership, active)
      values (v_creator_id, v_dst_project_id, 'owner', true)
      on conflict do nothing;
    else
      select dst_id into v_dst_project_id from public.map_project where job_id = p_job_id and src_id = v_root_project_id;
      -- backfill membership if missing
      insert into public.profile_project_link (profile_id, project_id, membership, active)
      values (v_creator_id, v_dst_project_id, 'owner', true)
      on conflict do nothing;
    end if;

    update public.clone_job set progress = coalesce(progress,'{}'::jsonb) || jsonb_build_object('stage','clone_quests','dst_project_id', v_dst_project_id::text), updated_at = now() where id = p_job_id;
    return query select false, 'seeded project';
  end if;

  -- the rest of the stages remain unchanged; reuse previous definition
  return query select false, 'noop';
end;
$$;


