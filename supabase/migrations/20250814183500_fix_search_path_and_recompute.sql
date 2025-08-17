-- migration: fix search_path in project closure triggers and enhance recompute stage

-- fix init_project_closure search_path
create or replace function public.init_project_closure()
 returns trigger
 language plpgsql
 security definer
 set search_path = public
as $function$
begin
    raise notice '[init_project_closure] Initializing project_closure for project_id: %', new.id;
    insert into public.project_closure (project_id)
    values (new.id)
    on conflict (project_id) do nothing;
    return new;
end;
$function$;

-- fix update_project_closure_on_quest_closure search_path
create or replace function public.update_project_closure_on_quest_closure()
 returns trigger
 language plpgsql
 security definer
 set search_path = public
as $function$
begin
    raise notice '[update_project_closure_on_quest_closure] Updating project_closure for project_id: %, quest_id: %', new.project_id, new.quest_id;
    insert into public.project_closure (project_id)
    values (new.project_id)
    on conflict (project_id) do nothing;
    update public.project_closure 
    set 
        quest_ids = (
            select coalesce(jsonb_agg(distinct qc.quest_id), '[]'::jsonb)
            from public.quest_closure qc
            join public.quest q on q.id = qc.quest_id
            where qc.project_id = new.project_id and q.active = true
        ),
        asset_ids = (
            select coalesce(jsonb_agg(distinct asset_id), '[]'::jsonb)
            from (
                select jsonb_array_elements_text(qc.asset_ids)::uuid as asset_id
                from public.quest_closure qc
                join public.quest q on q.id = qc.quest_id
                where qc.project_id = new.project_id and q.active = true
            ) aggregated_assets
        ),
        translation_ids = (
            select coalesce(jsonb_agg(distinct translation_id), '[]'::jsonb)
            from (
                select jsonb_array_elements_text(qc.translation_ids)::uuid as translation_id
                from public.quest_closure qc
                join public.quest q on q.id = qc.quest_id
                where qc.project_id = new.project_id and q.active = true
            ) aggregated_translations
        ),
        vote_ids = (
            select coalesce(jsonb_agg(distinct vote_id), '[]'::jsonb)
            from (
                select jsonb_array_elements_text(qc.vote_ids)::uuid as vote_id
                from public.quest_closure qc
                join public.quest q on q.id = qc.quest_id
                where qc.project_id = new.project_id and q.active = true
            ) aggregated_votes
        ),
        tag_ids = (
            select coalesce(jsonb_agg(distinct tag_id), '[]'::jsonb)
            from (
                select jsonb_array_elements_text(qc.tag_ids)::uuid as tag_id
                from public.quest_closure qc
                join public.quest q on q.id = qc.quest_id
                where qc.project_id = new.project_id and q.active = true
            ) aggregated_tags
        ),
        language_ids = (
            select coalesce(jsonb_agg(distinct language_id), '[]'::jsonb)
            from (
                select jsonb_array_elements_text(qc.language_ids)::uuid as language_id
                from public.quest_closure qc
                join public.quest q on q.id = qc.quest_id
                where qc.project_id = new.project_id and q.active = true
            ) aggregated_languages
        ),
        quest_asset_link_ids = (
            select coalesce(jsonb_agg(distinct link_id), '[]'::jsonb)
            from (
                select jsonb_array_elements_text(qc.quest_asset_link_ids) as link_id
                from public.quest_closure qc
                join public.quest q on q.id = qc.quest_id
                where qc.project_id = new.project_id and q.active = true
            ) aggregated_quest_asset_links
        ),
        asset_content_link_ids = (
            select coalesce(jsonb_agg(distinct link_id), '[]'::jsonb)
            from (
                select jsonb_array_elements_text(qc.asset_content_link_ids)::uuid as link_id
                from public.quest_closure qc
                join public.quest q on q.id = qc.quest_id
                where qc.project_id = new.project_id and q.active = true
            ) aggregated_asset_content_links
        ),
        quest_tag_link_ids = (
            select coalesce(jsonb_agg(distinct link_id), '[]'::jsonb)
            from (
                select jsonb_array_elements_text(qc.quest_tag_link_ids) as link_id
                from public.quest_closure qc
                join public.quest q on q.id = qc.quest_id
                where qc.project_id = new.project_id and q.active = true
            ) aggregated_quest_tag_links
        ),
        asset_tag_link_ids = (
            select coalesce(jsonb_agg(distinct link_id), '[]'::jsonb)
            from (
                select jsonb_array_elements_text(qc.asset_tag_link_ids) as link_id
                from public.quest_closure qc
                join public.quest q on q.id = qc.quest_id
                where qc.project_id = new.project_id and q.active = true
            ) aggregated_asset_tag_links
        ),
        total_quests = (
            select count(distinct qc.quest_id)
            from public.quest_closure qc
            join public.quest q on q.id = qc.quest_id
            where qc.project_id = new.project_id and q.active = true
        ),
        total_assets = (
            select coalesce(sum(qc.total_assets), 0)
            from public.quest_closure qc
            join public.quest q on q.id = qc.quest_id
            where qc.project_id = new.project_id and q.active = true
        ),
        total_translations = (
            select coalesce(sum(qc.total_translations), 0)
            from public.quest_closure qc
            join public.quest q on q.id = qc.quest_id
            where qc.project_id = new.project_id and q.active = true
        ),
        approved_translations = (
            select coalesce(sum(qc.approved_translations), 0)
            from public.quest_closure qc
            join public.quest q on q.id = qc.quest_id
            where qc.project_id = new.project_id and q.active = true
        ),
        last_updated = now()
    where project_id = new.project_id;
    raise notice '[update_project_closure_on_quest_closure] Updated project_closure for project_id: %', new.project_id;
    return new;
end;
$function$;

-- enhance recompute stage to rebuild quest closures first
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

  if v_stage = 'recompute_closures' then
    -- rebuild all quest closures (simple, safe for local)
    perform public.rebuild_all_quest_closures();
    -- fetch dst project id
    select dst_id into v_dst_project_id from public.map_project where job_id = p_job_id and src_id = v_root_project_id;
    -- rebuild project closure
    perform public.rebuild_single_project_closure(v_dst_project_id);
    update public.clone_job set progress = progress || jsonb_build_object('stage','done'), status = 'done', updated_at = now() where id = p_job_id;
    return query select true, 'done';
  end if;

  return query select false, 'noop';
end;
$$;


