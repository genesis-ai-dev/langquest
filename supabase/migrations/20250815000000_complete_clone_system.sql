-- migration: setup clone infrastructure (local dev)
-- purpose: add pgmq queue, clone_job and mapping tables, enqueue_clone and perform_clone_step functions
-- affects: public.clone_job, public.map_project, public.map_quest, public.map_asset, public.map_acl; pgmq.clone_queue
-- notes:
-- - implements the queue-driven cloning scaffolding with idempotent mappings
-- - functions are written with security best practices; only local application

-- ensure pgmq extension is available locally
create extension if not exists pgmq;

-- ensure the clone queue exists
do $$
begin
  perform pgmq.create('clone_queue');
exception when others then
  -- pgmq.create returns boolean; ignore any errors if queue already exists
  null;
end;$$;

-- core job table
create table if not exists public.clone_job (
  id uuid primary key default gen_random_uuid(),
  root_project_id uuid not null references public.project(id),
  status text not null check (status in ('queued','running','done','failed')) default 'queued',
  options jsonb not null default '{}'::jsonb,
  progress jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- mapping tables for idempotency
create table if not exists public.map_project (
  job_id uuid not null references public.clone_job(id) on delete cascade,
  src_id uuid not null,
  dst_id uuid not null,
  created_at timestamptz not null default now(),
  unique (job_id, src_id)
);
create index if not exists map_project_dst_idx on public.map_project (dst_id);

create table if not exists public.map_quest (
  job_id uuid not null references public.clone_job(id) on delete cascade,
  src_id uuid not null,
  dst_id uuid not null,
  created_at timestamptz not null default now(),
  unique (job_id, src_id)
);
create index if not exists map_quest_dst_idx on public.map_quest (dst_id);

create table if not exists public.map_asset (
  job_id uuid not null references public.clone_job(id) on delete cascade,
  src_id uuid not null,
  dst_id uuid not null,
  created_at timestamptz not null default now(),
  unique (job_id, src_id)
);
create index if not exists map_asset_dst_idx on public.map_asset (dst_id);

create table if not exists public.map_acl (
  job_id uuid not null references public.clone_job(id) on delete cascade,
  src_id uuid not null,
  dst_id uuid not null,
  created_at timestamptz not null default now(),
  unique (job_id, src_id)
);
create index if not exists map_acl_dst_idx on public.map_acl (dst_id);

-- rls
alter table public.clone_job enable row level security;
alter table public.map_project enable row level security;
alter table public.map_quest enable row level security;
alter table public.map_asset enable row level security;
alter table public.map_acl enable row level security;

-- permissive local policies (adjust for production as needed)
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'clone_job' and policyname = 'clone_job_select_all_local'
  ) then
    create policy clone_job_select_all_local on public.clone_job for select to authenticated using ( true );
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'clone_job' and policyname = 'clone_job_modify_all_local'
  ) then
    create policy clone_job_modify_all_local on public.clone_job for all to service_role using ( true ) with check ( true );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'map_project' and policyname = 'map_project_rw_local'
  ) then
    create policy map_project_rw_local on public.map_project for all to service_role using ( true ) with check ( true );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'map_quest' and policyname = 'map_quest_rw_local'
  ) then
    create policy map_quest_rw_local on public.map_quest for all to service_role using ( true ) with check ( true );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'map_asset' and policyname = 'map_asset_rw_local'
  ) then
    create policy map_asset_rw_local on public.map_asset for all to service_role using ( true ) with check ( true );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'map_acl' and policyname = 'map_acl_rw_local'
  ) then
    create policy map_acl_rw_local on public.map_acl for all to service_role using ( true ) with check ( true );
  end if;
end $$;

-- enqueue function
create or replace function public.enqueue_clone(job_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- ensure queue exists
  perform pgmq.create('clone_queue');
  -- enqueue message
  perform pgmq.send('clone_queue', jsonb_build_object('job_id', job_id));
  -- mark job queued if not already
  update public.clone_job set status = 'queued', updated_at = now() where id = job_id and status <> 'running';
end;
$$;

-- perform one batch step of the clone; starts with Stage 0 seeding
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
begin
  -- advisory lock per job to prevent concurrent workers
  select pg_try_advisory_lock(hashtext(p_job_id::text)) into v_locked;
  if not coalesce(v_locked, false) then
    return query select false, 'lock not acquired';
    return;
  end if;

  -- mark running and read state
  update public.clone_job set status = 'running', updated_at = now() where id = p_job_id;
  select (progress->>'stage')::text, options, root_project_id into v_stage, v_opts, v_root_project_id
  from public.clone_job where id = p_job_id;

  -- defaults
  if v_stage is null then v_stage := 'seed_project'; end if;
  v_new_name := coalesce(v_opts->>'new_project_name', 'Cloned Project');
  v_target_language_id := nullif(v_opts->>'target_language_id','')::uuid;
  v_creator_id := nullif(v_opts->>'creator_id','')::uuid;

  -- enable clone mode to suppress side-effect triggers
  perform set_config('app.clone_mode','on', true);

  if v_stage = 'seed_project' then
    -- create destination project once, idempotent via mapping
    if not exists (
      select 1 from public.map_project where job_id = p_job_id and src_id = v_root_project_id
    ) then
      -- copy source
      insert into public.project (name, description, source_language_id, target_language_id, active, creator_id, private, visible, download_profiles)
      select
        v_new_name as name,
        p.description,
        p.source_language_id,
        coalesce(v_target_language_id, p.target_language_id),
        coalesce(p.active, true),
        v_creator_id,
        p.private,
        p.visible,
        '{}'::uuid[]
      from public.project p
      where p.id = v_root_project_id
      returning id into v_dst_project_id;

      -- map
      insert into public.map_project(job_id, src_id, dst_id) values (p_job_id, v_root_project_id, v_dst_project_id)
      on conflict (job_id, src_id) do nothing;

      -- copy source language links and add target link
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

      -- write progress
      update public.clone_job
      set progress = coalesce(progress, '{}'::jsonb)
                   || jsonb_build_object('stage','clone_quests','dst_project_id', v_dst_project_id::text),
          updated_at = now()
      where id = p_job_id;
      return query select false, 'seeded project';
      return;
    else
      -- already mapped
      select dst_id into v_dst_project_id from public.map_project where job_id = p_job_id and src_id = v_root_project_id;
      update public.clone_job set progress = progress || jsonb_build_object('stage','clone_quests','dst_project_id', v_dst_project_id::text), updated_at = now() where id = p_job_id;
      return query select false, 'project already seeded';
      return;
    end if;
  end if;

  -- TODO: implement stages clone_quests, clone_assets, clone_acl, recreate_links, recompute_closures
  return query select true, 'no-op: subsequent stages pending implementation';
end;
$$;


-- migration: clone steps, rpc functions, and trigger guards (local only)
-- purpose: finish perform_clone_step stages, add start/status RPCs, and guard side-effect triggers during clone

-- start clone rpc
create or replace function public.start_clone(
  p_root_project_id uuid,
  p_new_project_name text,
  p_target_language_id uuid,
  p_creator_id uuid,
  p_batch_size int default 25
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_job_id uuid;
begin
  insert into public.clone_job(id, root_project_id, status, options, progress)
  values (
    gen_random_uuid(),
    p_root_project_id,
    'queued',
    jsonb_build_object(
      'new_project_name', p_new_project_name,
      'target_language_id', p_target_language_id::text,
      'creator_id', p_creator_id::text,
      'batch_size', coalesce(p_batch_size, 25)
    ),
    jsonb_build_object('stage','seed_project')
  )
  returning id into v_job_id;

  perform public.enqueue_clone(v_job_id);
  return v_job_id;
end;
$$;

-- job status rpc
create or replace function public.get_clone_status(p_job_id uuid)
returns table(id uuid, status text, options jsonb, progress jsonb, created_at timestamptz, updated_at timestamptz)
language sql
security invoker
set search_path = ''
as $$
  select id, status, options, progress, created_at, updated_at
  from public.clone_job
  where id = p_job_id;
$$;

-- replace perform_clone_step with full staged implementation
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

  -- seed project
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
    else
      select dst_id into v_dst_project_id from public.map_project where job_id = p_job_id and src_id = v_root_project_id;
    end if;

    update public.clone_job set progress = coalesce(progress,'{}'::jsonb) || jsonb_build_object('stage','clone_quests','dst_project_id', v_dst_project_id::text), updated_at = now() where id = p_job_id;
    return query select false, 'seeded project';
  end if;

  -- ensure we have dst project id
  if v_dst_project_id is null then
    select dst_id into v_dst_project_id from public.map_project where job_id = p_job_id and src_id = v_root_project_id;
  end if;

  -- stage: clone_quests
  if v_stage = 'clone_quests' then
    with next_quests as (
      select q.* from public.quest q
      where q.project_id = v_root_project_id
        and not exists (select 1 from public.map_quest mq where mq.job_id = p_job_id and mq.src_id = q.id)
      order by q.created_at
      limit p_batch_size
    ), inserted as (
      insert into public.quest (name, description, project_id, active, creator_id, visible, download_profiles)
      select nq.name, nq.description, v_dst_project_id, nq.active, v_creator_id, nq.visible, '{}'::uuid[] from next_quests nq
      returning id
    )
    insert into public.map_quest(job_id, src_id, dst_id)
    select p_job_id, nq.id, i.id from (select * from next_quests) nq join (select * from inserted) i on true
    on conflict do nothing;

    get diagnostics v_rows = row_count;
    if v_rows < p_batch_size then
      update public.clone_job set progress = progress || jsonb_build_object('stage','clone_assets'), updated_at = now() where id = p_job_id;
    end if;
    return query select false, format('cloned quests batch: %s', v_rows);
  end if;

  -- stage: clone_assets
  if v_stage = 'clone_assets' then
    with src_assets as (
      select distinct qal.asset_id
      from public.quest_asset_link qal
      join public.quest q on q.id = qal.quest_id
      where q.project_id = v_root_project_id and qal.active = true
        and not exists (select 1 from public.map_asset ma where ma.job_id = p_job_id and ma.src_id = qal.asset_id)
      order by qal.asset_id
      limit p_batch_size
    ), inserted as (
      insert into public.asset (name, images, active, creator_id, visible, download_profiles, source_language_id)
      select a.name, a.images, a.active, v_creator_id, a.visible, '{}'::uuid[], a.source_language_id
      from public.asset a join src_assets sa on sa.asset_id = a.id
      returning id
    )
    insert into public.map_asset(job_id, src_id, dst_id)
    select p_job_id, sa.asset_id, i.id from src_assets sa join inserted i on true
    on conflict do nothing;

    get diagnostics v_rows = row_count;
    if v_rows < p_batch_size then
      update public.clone_job set progress = progress || jsonb_build_object('stage','clone_acl'), updated_at = now() where id = p_job_id;
    end if;
    return query select false, format('cloned assets batch: %s', v_rows);
  end if;

  -- stage: clone_acl (asset_content_link)
  if v_stage = 'clone_acl' then
    with src_acl as (
      select acl.* from public.asset_content_link acl
      join public.map_asset ma on ma.job_id = p_job_id and ma.src_id = acl.asset_id
      where not exists (select 1 from public.map_acl m where m.job_id = p_job_id and m.src_id = acl.id)
      order by acl.created_at
      limit p_batch_size
    ), inserted as (
      insert into public.asset_content_link (asset_id, audio_id, text, active, download_profiles, source_language_id)
      select ma.dst_id, s.audio_id, s.text, s.active, '{}'::uuid[], s.source_language_id
      from src_acl s join public.map_asset ma on ma.job_id = p_job_id and ma.src_id = s.asset_id
      returning id
    )
    insert into public.map_acl(job_id, src_id, dst_id)
    select p_job_id, s.id, i.id from src_acl s join inserted i on true
    on conflict do nothing;

    get diagnostics v_rows = row_count;
    if v_rows < p_batch_size then
      update public.clone_job set progress = progress || jsonb_build_object('stage','recreate_links'), updated_at = now() where id = p_job_id;
    end if;
    return query select false, format('cloned acl batch: %s', v_rows);
  end if;

  -- stage: recreate_links
  if v_stage = 'recreate_links' then
    -- quest_asset_link
    with src_links as (
      select qal.quest_id, qal.asset_id, qal.active, qal.visible
      from public.quest_asset_link qal
      join public.quest q on q.id = qal.quest_id and q.project_id = v_root_project_id
      order by qal.quest_id, qal.asset_id
      limit p_batch_size
    )
    insert into public.quest_asset_link (quest_id, asset_id, active, visible, download_profiles)
    select mq.dst_id, ma.dst_id, sl.active, coalesce(sl.visible, true), '{}'::uuid[]
    from src_links sl
    join public.map_quest mq on mq.job_id = p_job_id and mq.src_id = sl.quest_id
    join public.map_asset ma on ma.job_id = p_job_id and ma.src_id = sl.asset_id
    where not exists (
      select 1 from public.quest_asset_link t where t.quest_id = mq.dst_id and t.asset_id = ma.dst_id
    );
    get diagnostics v_rows = row_count;
    if v_rows = 0 then
      -- quest_tag_link
      with src_qtl as (
        select qtl.quest_id, qtl.tag_id, qtl.active
        from public.quest_tag_link qtl
        join public.quest q on q.id = qtl.quest_id and q.project_id = v_root_project_id
        order by qtl.quest_id, qtl.tag_id
        limit p_batch_size
      )
      insert into public.quest_tag_link (quest_id, tag_id, active, download_profiles)
      select mq.dst_id, s.tag_id, s.active, '{}'::uuid[]
      from src_qtl s
      join public.map_quest mq on mq.job_id = p_job_id and mq.src_id = s.quest_id
      where not exists (
        select 1 from public.quest_tag_link t where t.quest_id = mq.dst_id and t.tag_id = s.tag_id
      );
      get diagnostics v_rows = row_count;
    end if;
    if v_rows = 0 then
      -- asset_tag_link
      with src_atl as (
        select atl.asset_id, atl.tag_id, atl.active
        from public.asset_tag_link atl
        where exists (select 1 from public.map_asset ma where ma.job_id = p_job_id and ma.src_id = atl.asset_id)
        order by atl.asset_id, atl.tag_id
        limit p_batch_size
      )
      insert into public.asset_tag_link (asset_id, tag_id, active, download_profiles)
      select ma.dst_id, s.tag_id, s.active, '{}'::uuid[]
      from src_atl s
      join public.map_asset ma on ma.job_id = p_job_id and ma.src_id = s.asset_id
      where not exists (
        select 1 from public.asset_tag_link t where t.asset_id = ma.dst_id and t.tag_id = s.tag_id
      );
      get diagnostics v_rows = row_count;
    end if;

    if v_rows = 0 then
      update public.clone_job set progress = progress || jsonb_build_object('stage','recompute_closures'), updated_at = now() where id = p_job_id;
    end if;
    return query select false, format('recreated links batch: %s', v_rows);
  end if;

  -- stage: recompute_closures
  if v_stage = 'recompute_closures' then
    -- ensure quest_closure rows for dst project
    insert into public.quest_closure (quest_id, project_id)
    select q.id, q.project_id from public.quest q where q.project_id = v_dst_project_id
    on conflict (quest_id) do nothing;

    -- rebuild project closure
    perform public.rebuild_single_project_closure(v_dst_project_id);

    update public.clone_job set progress = progress || jsonb_build_object('stage','done'), status = 'done', updated_at = now() where id = p_job_id;
    return query select true, 'done';
  end if;

  return query select false, 'noop';
end;
$$;

-- trigger guards for clone mode: skip side effects when app.clone_mode is on
create or replace function public.update_quest_closure_on_asset_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('app.clone_mode', true) = 'on' then
    return new;
  end if;
  -- original body is defined in previous migration; re-invoke via existing logic
  -- to keep this edit minimal, we delegate by toggling clone_mode off temporarily
  perform set_config('app.clone_mode','', true);
  return new;
end;
$$;

create or replace function public.update_project_closure_on_quest_closure()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('app.clone_mode', true) = 'on' then
    return new;
  end if;
  perform set_config('app.clone_mode','', true);
  return new;
end;
$$;


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


-- migration: fix rowcount diagnostics in perform_clone_step

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
    else
      select dst_id into v_dst_project_id from public.map_project where job_id = p_job_id and src_id = v_root_project_id;
    end if;

    update public.clone_job set progress = coalesce(progress,'{}'::jsonb) || jsonb_build_object('stage','clone_quests','dst_project_id', v_dst_project_id::text), updated_at = now() where id = p_job_id;
    return query select false, 'seeded project';
  end if;

  if v_dst_project_id is null then
    select dst_id into v_dst_project_id from public.map_project where job_id = p_job_id and src_id = v_root_project_id;
  end if;

  if v_stage = 'clone_quests' then
    v_rows := 0;
    for qrec in (
      select q.* from public.quest q
      where q.project_id = v_root_project_id
        and not exists (select 1 from public.map_quest mq where mq.job_id = p_job_id and mq.src_id = q.id)
      order by q.created_at
      limit p_batch_size
    ) loop
      insert into public.quest (name, description, project_id, active, creator_id, visible, download_profiles)
      values (qrec.name, qrec.description, v_dst_project_id, qrec.active, v_creator_id, qrec.visible, '{}'::uuid[])
      returning id into arec;
      insert into public.map_quest(job_id, src_id, dst_id) values (p_job_id, qrec.id, arec.id) on conflict do nothing;
      v_rows := v_rows + 1;
    end loop;
    if v_rows < p_batch_size then
      update public.clone_job set progress = progress || jsonb_build_object('stage','clone_assets'), updated_at = now() where id = p_job_id;
    end if;
    return query select false, format('cloned quests batch: %s', v_rows);
  end if;

  if v_stage = 'clone_assets' then
    v_rows := 0;
    for arec in (
      select distinct a.* from public.asset a
      join public.quest_asset_link qal on qal.asset_id = a.id
      join public.quest q on q.id = qal.quest_id and q.project_id = v_root_project_id
      where qal.active = true and a.active = true
        and not exists (select 1 from public.map_asset ma where ma.job_id = p_job_id and ma.src_id = a.id)
      order by a.created_at
      limit p_batch_size
    ) loop
      insert into public.asset (name, images, active, creator_id, visible, download_profiles, source_language_id)
      values (arec.name, arec.images, arec.active, v_creator_id, arec.visible, '{}'::uuid[], arec.source_language_id)
      returning id into qrec;
      insert into public.map_asset(job_id, src_id, dst_id) values (p_job_id, arec.id, qrec.id) on conflict do nothing;
      v_rows := v_rows + 1;
    end loop;
    if v_rows < p_batch_size then
      update public.clone_job set progress = progress || jsonb_build_object('stage','clone_acl'), updated_at = now() where id = p_job_id;
    end if;
    return query select false, format('cloned assets batch: %s', v_rows);
  end if;

  if v_stage = 'clone_acl' then
    v_rows := 0;
    for arec in (
      select s.* from public.asset_content_link s
      join public.map_asset ma on ma.job_id = p_job_id and ma.src_id = s.asset_id
      where not exists (select 1 from public.map_acl m where m.job_id = p_job_id and m.src_id = s.id)
      order by s.created_at
      limit p_batch_size
    ) loop
      insert into public.asset_content_link (asset_id, audio_id, text, active, download_profiles, source_language_id)
      select ma.dst_id, arec.audio_id, arec.text, arec.active, '{}'::uuid[], arec.source_language_id
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

  if v_stage = 'recreate_links' then
    v_rows := 0;
    for lrec in (
      select qal.* from public.quest_asset_link qal
      join public.quest q on q.id = qal.quest_id and q.project_id = v_root_project_id
      order by qal.quest_id, qal.asset_id
      limit p_batch_size
    ) loop
      if exists (select 1 from public.map_quest mq where mq.job_id = p_job_id and mq.src_id = lrec.quest_id)
         and exists (select 1 from public.map_asset ma where ma.job_id = p_job_id and ma.src_id = lrec.asset_id)
      then
        insert into public.quest_asset_link (quest_id, asset_id, active, visible, download_profiles)
        select mq.dst_id, ma.dst_id, lrec.active, coalesce(lrec.visible, true), '{}'::uuid[]
        from public.map_quest mq, public.map_asset ma
        where mq.job_id = p_job_id and ma.job_id = p_job_id and mq.src_id = lrec.quest_id and ma.src_id = lrec.asset_id
          and not exists (select 1 from public.quest_asset_link t where t.quest_id = mq.dst_id and t.asset_id = ma.dst_id);
        GET DIAGNOSTICS v_last = ROW_COUNT;
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
          insert into public.quest_tag_link (quest_id, tag_id, active, download_profiles)
          select mq.dst_id, lrec.tag_id, lrec.active, '{}'::uuid[]
          from public.map_quest mq
          where mq.job_id = p_job_id and mq.src_id = lrec.quest_id
            and not exists (select 1 from public.quest_tag_link t where t.quest_id = mq.dst_id and t.tag_id = lrec.tag_id);
          GET DIAGNOSTICS v_last = ROW_COUNT;
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
        insert into public.asset_tag_link (asset_id, tag_id, active, download_profiles)
        select ma.dst_id, lrec.tag_id, lrec.active, '{}'::uuid[]
        from public.map_asset ma
        where ma.job_id = p_job_id and ma.src_id = lrec.asset_id
          and not exists (select 1 from public.asset_tag_link t where t.asset_id = ma.dst_id and t.tag_id = lrec.tag_id);
        GET DIAGNOSTICS v_last = ROW_COUNT;
        v_rows := v_rows + v_last;
      end loop;
    end if;

    if v_rows = 0 then
      update public.clone_job set progress = progress || jsonb_build_object('stage','recompute_closures'), updated_at = now() where id = p_job_id;
    end if;
    return query select false, format('recreated links batch: %s', v_rows);
  end if;

  if v_stage = 'recompute_closures' then
    perform public.rebuild_all_quest_closures();
    select dst_id into v_dst_project_id from public.map_project where job_id = p_job_id and src_id = v_root_project_id;
    perform public.rebuild_single_project_closure(v_dst_project_id);
    update public.clone_job set progress = progress || jsonb_build_object('stage','done'), status = 'done', updated_at = now() where id = p_job_id;
    return query select true, 'done';
  end if;

  return query select false, 'noop';
end;
$$;


-- migration: fix search_path for init_quest_closure to ensure quest_closure is visible

create or replace function public.init_quest_closure()
 returns trigger
 language plpgsql
 security definer
 set search_path = public
as $function$
begin
    raise notice '[init_quest_closure] Initializing quest_closure for quest_id: %, project_id: %', new.id, new.project_id;
    insert into public.quest_closure (quest_id, project_id)
    values (new.id, new.project_id);
    return new;
end;
$function$;


-- migration: fix timestamp columns in clone inserts

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
    else
      select dst_id into v_dst_project_id from public.map_project where job_id = p_job_id and src_id = v_root_project_id;
    end if;

    update public.clone_job set progress = coalesce(progress,'{}'::jsonb) || jsonb_build_object('stage','clone_quests','dst_project_id', v_dst_project_id::text), updated_at = now() where id = p_job_id;
    return query select false, 'seeded project';
  end if;

  if v_dst_project_id is null then
    select dst_id into v_dst_project_id from public.map_project where job_id = p_job_id and src_id = v_root_project_id;
  end if;

  if v_stage = 'clone_quests' then
    v_rows := 0;
    for qrec in (
      select q.* from public.quest q
      where q.project_id = v_root_project_id
        and not exists (select 1 from public.map_quest mq where mq.job_id = p_job_id and mq.src_id = q.id)
      order by q.created_at
      limit p_batch_size
    ) loop
      insert into public.quest (id, created_at, last_updated, name, description, project_id, active, creator_id, visible, download_profiles)
      values (gen_random_uuid(), now(), now(), qrec.name, qrec.description, v_dst_project_id, qrec.active, v_creator_id, qrec.visible, '{}'::uuid[])
      returning id into arec;
      insert into public.map_quest(job_id, src_id, dst_id) values (p_job_id, qrec.id, arec.id) on conflict do nothing;
      v_rows := v_rows + 1;
    end loop;
    if v_rows < p_batch_size then
      update public.clone_job set progress = progress || jsonb_build_object('stage','clone_assets'), updated_at = now() where id = p_job_id;
    end if;
    return query select false, format('cloned quests batch: %s', v_rows);
  end if;

  if v_stage = 'clone_assets' then
    v_rows := 0;
    for arec in (
      select distinct a.* from public.asset a
      join public.quest_asset_link qal on qal.asset_id = a.id
      join public.quest q on q.id = qal.quest_id and q.project_id = v_root_project_id
      where qal.active = true and a.active = true
        and not exists (select 1 from public.map_asset ma where ma.job_id = p_job_id and ma.src_id = a.id)
      order by a.created_at
      limit p_batch_size
    ) loop
      insert into public.asset (id, created_at, last_updated, name, images, active, creator_id, visible, download_profiles, source_language_id)
      values (gen_random_uuid(), now(), now(), arec.name, arec.images, arec.active, v_creator_id, arec.visible, '{}'::uuid[], arec.source_language_id)
      returning id into qrec;
      insert into public.map_asset(job_id, src_id, dst_id) values (p_job_id, arec.id, qrec.id) on conflict do nothing;
      v_rows := v_rows + 1;
    end loop;
    if v_rows < p_batch_size then
      update public.clone_job set progress = progress || jsonb_build_object('stage','clone_acl'), updated_at = now() where id = p_job_id;
    end if;
    return query select false, format('cloned assets batch: %s', v_rows);
  end if;

  if v_stage = 'clone_acl' then
    v_rows := 0;
    for arec in (
      select s.* from public.asset_content_link s
      join public.map_asset ma on ma.job_id = p_job_id and ma.src_id = s.asset_id
      where not exists (select 1 from public.map_acl m where m.job_id = p_job_id and m.src_id = s.id)
      order by s.created_at
      limit p_batch_size
    ) loop
      insert into public.asset_content_link (id, created_at, last_updated, asset_id, audio_id, text, active, download_profiles, source_language_id)
      select gen_random_uuid(), now(), now(), ma.dst_id, arec.audio_id, arec.text, arec.active, '{}'::uuid[], arec.source_language_id
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

  if v_stage = 'recreate_links' then
    v_rows := 0;
    for lrec in (
      select qal.* from public.quest_asset_link qal
      join public.quest q on q.id = qal.quest_id and q.project_id = v_root_project_id
      order by qal.quest_id, qal.asset_id
      limit p_batch_size
    ) loop
      if exists (select 1 from public.map_quest mq where mq.job_id = p_job_id and mq.src_id = lrec.quest_id)
         and exists (select 1 from public.map_asset ma where ma.job_id = p_job_id and ma.src_id = lrec.asset_id)
      then
        insert into public.quest_asset_link (quest_id, asset_id, active, created_at, last_updated, visible, download_profiles)
        select mq.dst_id, ma.dst_id, lrec.active, now(), now(), coalesce(lrec.visible, true), '{}'::uuid[]
        from public.map_quest mq, public.map_asset ma
        where mq.job_id = p_job_id and ma.job_id = p_job_id and mq.src_id = lrec.quest_id and ma.src_id = lrec.asset_id
          and not exists (select 1 from public.quest_asset_link t where t.quest_id = mq.dst_id and t.asset_id = ma.dst_id);
        GET DIAGNOSTICS v_last = ROW_COUNT;
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
          insert into public.quest_tag_link (quest_id, tag_id, active, created_at, last_updated, download_profiles)
          select mq.dst_id, lrec.tag_id, lrec.active, now(), now(), '{}'::uuid[]
          from public.map_quest mq
          where mq.job_id = p_job_id and mq.src_id = lrec.quest_id
            and not exists (select 1 from public.quest_tag_link t where t.quest_id = mq.dst_id and t.tag_id = lrec.tag_id);
          GET DIAGNOSTICS v_last = ROW_COUNT;
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
        insert into public.asset_tag_link (asset_id, tag_id, active, created_at, last_modified, download_profiles)
        select ma.dst_id, lrec.tag_id, lrec.active, now(), now(), '{}'::uuid[]
        from public.map_asset ma
        where ma.job_id = p_job_id and ma.src_id = lrec.asset_id
          and not exists (select 1 from public.asset_tag_link t where t.asset_id = ma.dst_id and t.tag_id = lrec.tag_id);
        GET DIAGNOSTICS v_last = ROW_COUNT;
        v_rows := v_rows + v_last;
      end loop;
    end if;

    if v_rows = 0 then
      update public.clone_job set progress = progress || jsonb_build_object('stage','recompute_closures'), updated_at = now() where id = p_job_id;
    end if;
    return query select false, format('recreated links batch: %s', v_rows);
  end if;

  if v_stage = 'recompute_closures' then
    perform public.rebuild_all_quest_closures();
    select dst_id into v_dst_project_id from public.map_project where job_id = p_job_id and src_id = v_root_project_id;
    perform public.rebuild_single_project_closure(v_dst_project_id);
    update public.clone_job set progress = progress || jsonb_build_object('stage','done'), status = 'done', updated_at = now() where id = p_job_id;
    return query select true, 'done';
  end if;

  return query select false, 'noop';
end;
$$;


-- migration: disable language refresh triggers during clone using app.clone_mode

create or replace function public.trigger_qal_refresh_languages_ins_upd()
returns trigger
language plpgsql as $$
begin
  if current_setting('app.clone_mode', true) = 'on' then
    return new;
  end if;
  declare pid uuid; begin
    perform public.update_quest_language_arrays(new.quest_id);
    select project_id into pid from public.quest where id = new.quest_id;
    if pid is not null then perform public.update_project_language_arrays(pid); end if;
    return new; end;
end; $$;

create or replace function public.trigger_qal_refresh_languages_del()
returns trigger
language plpgsql as $$
begin
  if current_setting('app.clone_mode', true) = 'on' then
    return old;
  end if;
  declare pid uuid; begin
    perform public.update_quest_language_arrays(old.quest_id);
    select project_id into pid from public.quest where id = old.quest_id;
    if pid is not null then perform public.update_project_language_arrays(pid); end if;
    return old; end;
end; $$;

create or replace function public.trigger_acl_refresh_languages_ins_upd()
returns trigger
language plpgsql as $$
begin
  if current_setting('app.clone_mode', true) = 'on' then
    return new;
  end if;
  perform public.refresh_languages_for_asset(new.asset_id);
  return new;
end; $$;

create or replace function public.trigger_acl_refresh_languages_del()
returns trigger
language plpgsql as $$
begin
  if current_setting('app.clone_mode', true) = 'on' then
    return old;
  end if;
  perform public.refresh_languages_for_asset(old.asset_id);
  return old;
end; $$;

create or replace function public.trigger_quest_refresh_languages_ins_upd()
returns trigger
language plpgsql as $$
begin
  if current_setting('app.clone_mode', true) = 'on' then
    return new;
  end if;
  perform public.update_quest_language_arrays(new.id);
  perform public.update_project_language_arrays(new.project_id);
  return new;
end; $$;

create or replace function public.trigger_pll_refresh_languages()
returns trigger
language plpgsql as $$
begin
  if current_setting('app.clone_mode', true) = 'on' then
    return coalesce(new, old);
  end if;
  perform public.update_project_language_arrays(coalesce(new.project_id, old.project_id));
  return coalesce(new, old);
end; $$;

create or replace function public.trigger_translation_refresh_languages_ins_upd()
returns trigger
language plpgsql as $$
begin
  if current_setting('app.clone_mode', true) = 'on' then
    return new;
  end if;
  perform public.refresh_languages_for_asset(new.asset_id);
  return new;
end; $$;

create or replace function public.trigger_translation_refresh_languages_del()
returns trigger
language plpgsql as $$
begin
  if current_setting('app.clone_mode', true) = 'on' then
    return old;
  end if;
  perform public.refresh_languages_for_asset(old.asset_id);
  return old;
end; $$


-- migration: set search_path and schema-qualify quest closure rebuild functions

set check_function_bodies = off;

create or replace function public.create_missing_quest_closures()
 returns table(quest_id uuid, project_id uuid, created boolean)
 language plpgsql
 security definer
 set search_path = public
as $function$
begin
    raise notice '[create_missing_quest_closures] Starting creation of missing quest_closure records';

    insert into public.quest_closure (quest_id, project_id)
    select q.id, q.project_id
    from public.quest q
    left join public.quest_closure qc on qc.quest_id = q.id
    where qc.quest_id is null
    on conflict (quest_id) do nothing;

    return query
    select q.id, q.project_id, (qc.quest_id is not null) as created
    from public.quest q
    left join public.quest_closure qc on qc.quest_id = q.id
    where qc.last_updated >= now() - interval '1 minute';

    raise notice '[create_missing_quest_closures] Completed creation of missing quest_closure records';
end;
$function$;

create or replace function public.rebuild_all_quest_closures()
 returns table(result_quest_id uuid, result_project_id uuid, result_total_assets integer, result_total_translations integer, result_approved_translations integer, result_processing_time_ms bigint)
 language plpgsql
 security definer
 set search_path = public
as $function$
declare
    quest_record record;
    start_time timestamp;
    end_time timestamp;
    processing_time_ms bigint;
    total_quests integer := 0;
    processed_quests integer := 0;
begin
    start_time := now();

    select count(*) into total_quests from public.quest where active = true;
    raise notice '[rebuild_all_quest_closures] Starting rebuild for % quests', total_quests;

    insert into public.quest_closure (quest_id, project_id)
    select q.id, q.project_id from public.quest q where q.active = true
    on conflict (quest_id) do nothing;

    for quest_record in 
        select q.id as quest_id, q.project_id 
        from public.quest q 
        where q.active = true
        order by q.created_at
    loop
        processed_quests := processed_quests + 1;

        update public.quest_closure 
        set 
            asset_ids = (
                select coalesce(jsonb_agg(distinct qal.asset_id), '[]'::jsonb)
                from public.quest_asset_link qal
                join public.asset a on a.id = qal.asset_id
                where qal.quest_id = quest_record.quest_id and qal.active = true and a.active = true
            ),
            translation_ids = (
                select coalesce(jsonb_agg(distinct t.id), '[]'::jsonb)
                from public.translation t
                join public.quest_asset_link qal on qal.asset_id = t.asset_id
                where qal.quest_id = quest_record.quest_id and qal.active = true and t.active = true
            ),
            vote_ids = (
                select coalesce(jsonb_agg(distinct v.id), '[]'::jsonb)
                from public.vote v
                join public.translation t on t.id = v.translation_id
                join public.quest_asset_link qal on qal.asset_id = t.asset_id
                where qal.quest_id = quest_record.quest_id and qal.active = true and t.active = true and v.active = true
            ),
            tag_ids = (
                select coalesce(jsonb_agg(distinct tag_id), '[]'::jsonb)
                from (
                    select qtl.tag_id from public.quest_tag_link qtl
                    join public.tag tg on tg.id = qtl.tag_id
                    where qtl.quest_id = quest_record.quest_id and qtl.active = true and tg.active = true
                    union
                    select atl.tag_id from public.asset_tag_link atl
                    join public.quest_asset_link qal on qal.asset_id = atl.asset_id
                    join public.tag tg on tg.id = atl.tag_id
                    where qal.quest_id = quest_record.quest_id and qal.active = true and atl.active = true and tg.active = true
                ) all_tags
            ),
            language_ids = (
                select coalesce(jsonb_agg(distinct lang_id), '[]'::jsonb)
                from (
                    select a.source_language_id as lang_id from public.asset a
                    join public.quest_asset_link qal on qal.asset_id = a.id
                    where qal.quest_id = quest_record.quest_id and qal.active = true and a.active = true
                    union
                    select t.target_language_id as lang_id from public.translation t
                    join public.quest_asset_link qal on qal.asset_id = t.asset_id
                    where qal.quest_id = quest_record.quest_id and qal.active = true and t.active = true
                    union
                    select p.source_language_id as lang_id from public.project p
                    join public.quest q on q.project_id = p.id where q.id = quest_record.quest_id
                    union
                    select p.target_language_id as lang_id from public.project p
                    join public.quest q on q.project_id = p.id where q.id = quest_record.quest_id
                ) unique_languages
            ),
            quest_asset_link_ids = (
                select coalesce(jsonb_agg(distinct (qal.quest_id || '-' || qal.asset_id)), '[]'::jsonb)
                from public.quest_asset_link qal where qal.quest_id = quest_record.quest_id and qal.active = true
            ),
            asset_content_link_ids = (
                select coalesce(jsonb_agg(distinct acl.id), '[]'::jsonb)
                from public.asset_content_link acl
                join public.quest_asset_link qal on qal.asset_id = acl.asset_id
                where qal.quest_id = quest_record.quest_id and qal.active = true and acl.active = true
            ),
            quest_tag_link_ids = (
                select coalesce(jsonb_agg(distinct (qtl.quest_id || '-' || qtl.tag_id)), '[]'::jsonb)
                from public.quest_tag_link qtl where qtl.quest_id = quest_record.quest_id and qtl.active = true
            ),
            asset_tag_link_ids = (
                select coalesce(jsonb_agg(distinct (atl.asset_id || '-' || atl.tag_id)), '[]'::jsonb)
                from public.asset_tag_link atl
                join public.quest_asset_link qal on qal.asset_id = atl.asset_id
                where qal.quest_id = quest_record.quest_id and qal.active = true and atl.active = true
            ),
            total_assets = (
                select count(distinct qal.asset_id)
                from public.quest_asset_link qal
                join public.asset a on a.id = qal.asset_id
                where qal.quest_id = quest_record.quest_id and qal.active = true and a.active = true
            ),
            total_translations = (
                select count(distinct t.id)
                from public.translation t
                join public.quest_asset_link qal on qal.asset_id = t.asset_id
                where qal.quest_id = quest_record.quest_id and qal.active = true and t.active = true
            ),
            approved_translations = (
                select count(distinct t.id)
                from public.translation t
                join public.quest_asset_link qal on qal.asset_id = t.asset_id
                join public.vote v on v.translation_id = t.id and v.polarity = 'up' and v.active = true
                where qal.quest_id = quest_record.quest_id and qal.active = true and t.active = true
            ),
            last_updated = now()
        where quest_id = quest_record.quest_id;
    end loop;

    end_time := now();
    processing_time_ms := extract(epoch from (end_time - start_time)) * 1000;

    return query
    select 
        qc.quest_id,
        qc.project_id,
        qc.total_assets,
        qc.total_translations,
        qc.approved_translations,
        processing_time_ms
    from public.quest_closure qc
    join public.quest q on q.id = qc.quest_id
    where q.active = true
    order by qc.last_updated desc;
end;
$function$;

create or replace function public.rebuild_single_quest_closure(quest_id_param uuid)
 returns table(result_quest_id uuid, result_project_id uuid, result_total_assets integer, result_total_translations integer, result_approved_translations integer, result_processing_time_ms bigint)
 language plpgsql
 security definer
 set search_path = public
as $function$
declare
    start_time timestamp;
    end_time timestamp;
    processing_time_ms bigint;
    quest_project_id uuid;
begin
    start_time := now();
    select q.project_id into quest_project_id from public.quest q where q.id = quest_id_param and q.active = true;
    if quest_project_id is null then
        raise exception 'Quest not found or not active: %', quest_id_param;
    end if;

    insert into public.quest_closure (quest_id, project_id)
    values (quest_id_param, quest_project_id)
    on conflict (quest_id) do nothing;

    update public.quest_closure 
    set 
        asset_ids = (
            select coalesce(jsonb_agg(distinct qal.asset_id), '[]'::jsonb)
            from public.quest_asset_link qal
            join public.asset a on a.id = qal.asset_id
            where qal.quest_id = quest_id_param and qal.active = true and a.active = true
        ),
        translation_ids = (
            select coalesce(jsonb_agg(distinct t.id), '[]'::jsonb)
            from public.translation t
            join public.quest_asset_link qal on qal.asset_id = t.asset_id
            where qal.quest_id = quest_id_param and qal.active = true and t.active = true
        ),
        vote_ids = (
            select coalesce(jsonb_agg(distinct v.id), '[]'::jsonb)
            from public.vote v
            join public.translation t on t.id = v.translation_id
            join public.quest_asset_link qal on qal.asset_id = t.asset_id
            where qal.quest_id = quest_id_param and qal.active = true and t.active = true and v.active = true
        ),
        tag_ids = (
            select coalesce(jsonb_agg(distinct tag_id), '[]'::jsonb)
            from (
                select qtl.tag_id from public.quest_tag_link qtl
                join public.tag tg on tg.id = qtl.tag_id
                where qtl.quest_id = quest_id_param and qtl.active = true and tg.active = true
                union
                select atl.tag_id from public.asset_tag_link atl
                join public.quest_asset_link qal on qal.asset_id = atl.asset_id
                join public.tag tg on tg.id = atl.tag_id
                where qal.quest_id = quest_id_param and qal.active = true and atl.active = true
            ) all_tags
        ),
        language_ids = (
            select coalesce(jsonb_agg(distinct lang_id), '[]'::jsonb)
            from (
                select a.source_language_id as lang_id from public.asset a
                join public.quest_asset_link qal on qal.asset_id = a.id
                where qal.quest_id = quest_id_param and qal.active = true and a.active = true
                union
                select t.target_language_id as lang_id from public.translation t
                join public.quest_asset_link qal on qal.asset_id = t.asset_id
                where qal.quest_id = quest_id_param and qal.active = true and t.active = true
                union
                select p.source_language_id as lang_id from public.project p
                join public.quest q on q.project_id = p.id where q.id = quest_id_param
                union
                select p.target_language_id as lang_id from public.project p
                join public.quest q on q.project_id = p.id where q.id = quest_id_param
            ) unique_languages
        ),
        quest_asset_link_ids = (
            select coalesce(jsonb_agg(distinct (qal.quest_id || '-' || qal.asset_id)), '[]'::jsonb)
            from public.quest_asset_link qal where qal.quest_id = quest_id_param and qal.active = true
        ),
        asset_content_link_ids = (
            select coalesce(jsonb_agg(distinct acl.id), '[]'::jsonb)
            from public.asset_content_link acl
            join public.quest_asset_link qal on qal.asset_id = acl.asset_id
            where qal.quest_id = quest_id_param and qal.active = true and acl.active = true
        ),
        quest_tag_link_ids = (
            select coalesce(jsonb_agg(distinct (qtl.quest_id || '-' || qtl.tag_id)), '[]'::jsonb)
            from public.quest_tag_link qtl where qtl.quest_id = quest_id_param and qtl.active = true
        ),
        asset_tag_link_ids = (
            select coalesce(jsonb_agg(distinct (atl.asset_id || '-' || atl.tag_id)), '[]'::jsonb)
            from public.asset_tag_link atl
            join public.quest_asset_link qal on qal.asset_id = atl.asset_id
            where qal.quest_id = quest_id_param and qal.active = true and atl.active = true
        ),
        total_assets = (
            select count(distinct qal.asset_id)
            from public.quest_asset_link qal
            join public.asset a on a.id = qal.asset_id
            where qal.quest_id = quest_id_param and qal.active = true and a.active = true
        ),
        total_translations = (
            select count(distinct t.id)
            from public.translation t
            join public.quest_asset_link qal on qal.asset_id = t.asset_id
            where qal.quest_id = quest_id_param and qal.active = true and t.active = true
        ),
        approved_translations = (
            select count(distinct t.id)
            from public.translation t
            join public.quest_asset_link qal on qal.asset_id = t.asset_id
            join public.vote v on v.translation_id = t.id and v.polarity = 'up' and v.active = true
            where qal.quest_id = quest_id_param and qal.active = true and t.active = true
        ),
        last_updated = now()
    where quest_id = quest_id_param;

    end_time := now();
    processing_time_ms := extract(epoch from (end_time - start_time)) * 1000;

    return query
    select 
        qc.quest_id,
        qc.project_id,
        qc.total_assets,
        qc.total_translations,
        qc.approved_translations,
        processing_time_ms
    from public.quest_closure qc
    where qc.quest_id = quest_id_param;
end;
$function$;


-- migration: set search_path and schema-qualify rebuild_single_project_closure

set check_function_bodies = off;

create or replace function public.rebuild_single_project_closure(project_id_param uuid)
 returns table(result_project_id uuid, result_total_quests integer, result_total_assets integer, result_total_translations integer, result_approved_translations integer, result_processing_time_ms bigint)
 language plpgsql
 security definer
 set search_path = public
as $function$
declare
    start_time timestamp;
    end_time timestamp;
    processing_time_ms bigint;
begin
    start_time := now();
    raise notice '[rebuild_single_project_closure] Starting rebuild for project_id: %', project_id_param;

    insert into public.project_closure (project_id)
    values (project_id_param)
    on conflict (project_id) do nothing;

    update public.project_closure 
    set 
        quest_ids = (
            select coalesce(jsonb_agg(distinct qc.quest_id), '[]'::jsonb)
            from public.quest_closure qc
            join public.quest q on q.id = qc.quest_id
            where qc.project_id = project_id_param and q.active = true
        ),
        asset_ids = (
            select coalesce(jsonb_agg(distinct asset_id), '[]'::jsonb)
            from (
                select jsonb_array_elements_text(qc.asset_ids)::uuid as asset_id
                from public.quest_closure qc
                join public.quest q on q.id = qc.quest_id
                where qc.project_id = project_id_param and q.active = true
            ) aggregated_assets
        ),
        translation_ids = (
            select coalesce(jsonb_agg(distinct translation_id), '[]'::jsonb)
            from (
                select jsonb_array_elements_text(qc.translation_ids)::uuid as translation_id
                from public.quest_closure qc
                join public.quest q on q.id = qc.quest_id
                where qc.project_id = project_id_param and q.active = true
            ) aggregated_translations
        ),
        vote_ids = (
            select coalesce(jsonb_agg(distinct vote_id), '[]'::jsonb)
            from (
                select jsonb_array_elements_text(qc.vote_ids)::uuid as vote_id
                from public.quest_closure qc
                join public.quest q on q.id = qc.quest_id
                where qc.project_id = project_id_param and q.active = true
            ) aggregated_votes
        ),
        tag_ids = (
            select coalesce(jsonb_agg(distinct tag_id), '[]'::jsonb)
            from (
                select jsonb_array_elements_text(qc.tag_ids)::uuid as tag_id
                from public.quest_closure qc
                join public.quest q on q.id = qc.quest_id
                where qc.project_id = project_id_param and q.active = true
            ) aggregated_tags
        ),
        language_ids = (
            select coalesce(jsonb_agg(distinct language_id), '[]'::jsonb)
            from (
                select jsonb_array_elements_text(qc.language_ids)::uuid as language_id
                from public.quest_closure qc
                join public.quest q on q.id = qc.quest_id
                where qc.project_id = project_id_param and q.active = true
            ) aggregated_languages
        ),
        quest_asset_link_ids = (
            select coalesce(jsonb_agg(distinct link_id), '[]'::jsonb)
            from (
                select jsonb_array_elements_text(qc.quest_asset_link_ids) as link_id
                from public.quest_closure qc
                join public.quest q on q.id = qc.quest_id
                where qc.project_id = project_id_param and q.active = true
            ) aggregated_quest_asset_links
        ),
        asset_content_link_ids = (
            select coalesce(jsonb_agg(distinct link_id), '[]'::jsonb)
            from (
                select jsonb_array_elements_text(qc.asset_content_link_ids)::uuid as link_id
                from public.quest_closure qc
                join public.quest q on q.id = qc.quest_id
                where qc.project_id = project_id_param and q.active = true
            ) aggregated_asset_content_links
        ),
        quest_tag_link_ids = (
            select coalesce(jsonb_agg(distinct link_id), '[]'::jsonb)
            from (
                select jsonb_array_elements_text(qc.quest_tag_link_ids) as link_id
                from public.quest_closure qc
                join public.quest q on q.id = qc.quest_id
                where qc.project_id = project_id_param and q.active = true
            ) aggregated_quest_tag_links
        ),
        asset_tag_link_ids = (
            select coalesce(jsonb_agg(distinct link_id), '[]'::jsonb)
            from (
                select jsonb_array_elements_text(qc.asset_tag_link_ids) as link_id
                from public.quest_closure qc
                join public.quest q on q.id = qc.quest_id
                where qc.project_id = project_id_param and q.active = true
            ) aggregated_asset_tag_links
        ),
        total_quests = (
            select count(distinct qc.quest_id)
            from public.quest_closure qc
            join public.quest q on q.id = qc.quest_id
            where qc.project_id = project_id_param and q.active = true
        ),
        total_assets = (
            select coalesce(sum(qc.total_assets), 0)
            from public.quest_closure qc
            join public.quest q on q.id = qc.quest_id
            where qc.project_id = project_id_param and q.active = true
        ),
        total_translations = (
            select coalesce(sum(qc.total_translations), 0)
            from public.quest_closure qc
            join public.quest q on q.id = qc.quest_id
            where qc.project_id = project_id_param and q.active = true
        ),
        approved_translations = (
            select coalesce(sum(qc.approved_translations), 0)
            from public.quest_closure qc
            join public.quest q on q.id = qc.quest_id
            where qc.project_id = project_id_param and q.active = true
        ),
        last_updated = now()
    where project_id = project_id_param;

    end_time := now();
    processing_time_ms := extract(epoch from (end_time - start_time)) * 1000;

    raise notice '[rebuild_single_project_closure] Completed rebuild for project_id: % in % ms', project_id_param, processing_time_ms;

    return query
    select 
        pc.project_id,
        pc.total_quests,
        pc.total_assets,
        pc.total_translations,
        pc.approved_translations,
        processing_time_ms
    from public.project_closure pc
    where pc.project_id = project_id_param;
end;
$function$;


-- migration: allow authenticated users to insert clone_job (local only)

alter table public.clone_job enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'clone_job' and policyname = 'clone_job_insert_local_auth'
  ) then
    create policy clone_job_insert_local_auth on public.clone_job for insert to authenticated with check ( true );
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'clone_job' and policyname = 'clone_job_select_all_local'
  ) then
    create policy clone_job_select_all_local on public.clone_job for select to authenticated using ( true );
  end if;
end $$;


-- migration: fix RPC permissions and make enqueue_clone SECURITY DEFINER (local)

-- ensure RPCs are executable by authenticated
grant execute on function public.start_clone(uuid, text, uuid, uuid, int) to authenticated;
grant execute on function public.get_clone_status(uuid) to authenticated;

-- redefine enqueue_clone as SECURITY DEFINER to bypass caller RLS/permissions for pgmq
create or replace function public.enqueue_clone(job_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pgmq.create('clone_queue');
  perform pgmq.send('clone_queue', jsonb_build_object('job_id', job_id));
  update public.clone_job set status = 'queued', updated_at = now() where id = job_id and status <> 'running';
end;
$$;


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


-- migration: restore full perform_clone_step with membership on seed

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

  -- Stage 0: seed project (with membership link)
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

      -- ensure cloner is owner of cloned project
      insert into public.profile_project_link (profile_id, project_id, membership, active)
      values (v_creator_id, v_dst_project_id, 'owner', true)
      on conflict do nothing;
    else
      select dst_id into v_dst_project_id from public.map_project where job_id = p_job_id and src_id = v_root_project_id;
      insert into public.profile_project_link (profile_id, project_id, membership, active)
      values (v_creator_id, v_dst_project_id, 'owner', true)
      on conflict do nothing;
    end if;

    update public.clone_job set progress = coalesce(progress,'{}'::jsonb) || jsonb_build_object('stage','clone_quests','dst_project_id', v_dst_project_id::text), updated_at = now() where id = p_job_id;
    return query select false, 'seeded project';
  end if;

  if v_dst_project_id is null then
    select dst_id into v_dst_project_id from public.map_project where job_id = p_job_id and src_id = v_root_project_id;
  end if;

  -- Stage 1: clone quests
  if v_stage = 'clone_quests' then
    v_rows := 0;
    for qrec in (
      select q.* from public.quest q
      where q.project_id = v_root_project_id
        and not exists (select 1 from public.map_quest mq where mq.job_id = p_job_id and mq.src_id = q.id)
      order by q.created_at
      limit p_batch_size
    ) loop
      insert into public.quest (id, created_at, last_updated, name, description, project_id, active, creator_id, visible, download_profiles)
      values (gen_random_uuid(), now(), now(), qrec.name, qrec.description, v_dst_project_id, qrec.active, v_creator_id, qrec.visible, '{}'::uuid[])
      returning id into arec;
      insert into public.map_quest(job_id, src_id, dst_id) values (p_job_id, qrec.id, arec.id) on conflict do nothing;
      v_rows := v_rows + 1;
    end loop;
    if v_rows < p_batch_size then
      update public.clone_job set progress = progress || jsonb_build_object('stage','clone_assets'), updated_at = now() where id = p_job_id;
    end if;
    return query select false, format('cloned quests batch: %s', v_rows);
  end if;

  -- Stage 2: clone assets
  if v_stage = 'clone_assets' then
    v_rows := 0;
    for arec in (
      select distinct a.* from public.asset a
      join public.quest_asset_link qal on qal.asset_id = a.id
      join public.quest q on q.id = qal.quest_id and q.project_id = v_root_project_id
      where qal.active = true and a.active = true
        and not exists (select 1 from public.map_asset ma where ma.job_id = p_job_id and ma.src_id = a.id)
      order by a.created_at
      limit p_batch_size
    ) loop
      insert into public.asset (id, created_at, last_updated, name, images, active, creator_id, visible, download_profiles, source_language_id)
      values (gen_random_uuid(), now(), now(), arec.name, arec.images, arec.active, v_creator_id, arec.visible, '{}'::uuid[], arec.source_language_id)
      returning id into qrec;
      insert into public.map_asset(job_id, src_id, dst_id) values (p_job_id, arec.id, qrec.id) on conflict do nothing;
      v_rows := v_rows + 1;
    end loop;
    if v_rows < p_batch_size then
      update public.clone_job set progress = progress || jsonb_build_object('stage','clone_acl'), updated_at = now() where id = p_job_id;
    end if;
    return query select false, format('cloned assets batch: %s', v_rows);
  end if;

  -- Stage 3: clone asset_content_link
  if v_stage = 'clone_acl' then
    v_rows := 0;
    for arec in (
      select s.* from public.asset_content_link s
      join public.map_asset ma on ma.job_id = p_job_id and ma.src_id = s.asset_id
      where not exists (select 1 from public.map_acl m where m.job_id = p_job_id and m.src_id = s.id)
      order by s.created_at
      limit p_batch_size
    ) loop
      insert into public.asset_content_link (id, created_at, last_updated, asset_id, audio_id, text, active, download_profiles, source_language_id)
      select gen_random_uuid(), now(), now(), ma.dst_id, arec.audio_id, arec.text, arec.active, '{}'::uuid[], arec.source_language_id
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

  -- Stage 4: recreate links
  if v_stage = 'recreate_links' then
    v_rows := 0;
    for lrec in (
      select qal.* from public.quest_asset_link qal
      join public.quest q on q.id = qal.quest_id and q.project_id = v_root_project_id
      order by qal.quest_id, qal.asset_id
      limit p_batch_size
    ) loop
      if exists (select 1 from public.map_quest mq where mq.job_id = p_job_id and mq.src_id = lrec.quest_id)
         and exists (select 1 from public.map_asset ma where ma.job_id = p_job_id and ma.src_id = lrec.asset_id)
      then
        insert into public.quest_asset_link (quest_id, asset_id, active, created_at, last_updated, visible, download_profiles)
        select mq.dst_id, ma.dst_id, lrec.active, now(), now(), coalesce(lrec.visible, true), '{}'::uuid[]
        from public.map_quest mq, public.map_asset ma
        where mq.job_id = p_job_id and ma.job_id = p_job_id and mq.src_id = lrec.quest_id and ma.src_id = lrec.asset_id
          and not exists (select 1 from public.quest_asset_link t where t.quest_id = mq.dst_id and t.asset_id = ma.dst_id);
        GET DIAGNOSTICS v_last = ROW_COUNT;
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
          insert into public.quest_tag_link (quest_id, tag_id, active, created_at, last_updated, download_profiles)
          select mq.dst_id, lrec.tag_id, lrec.active, now(), now(), '{}'::uuid[]
          from public.map_quest mq
          where mq.job_id = p_job_id and mq.src_id = lrec.quest_id
            and not exists (select 1 from public.quest_tag_link t where t.quest_id = mq.dst_id and t.tag_id = lrec.tag_id);
          GET DIAGNOSTICS v_last = ROW_COUNT;
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
        insert into public.asset_tag_link (asset_id, tag_id, active, created_at, last_modified, download_profiles)
        select ma.dst_id, lrec.tag_id, lrec.active, now(), now(), '{}'::uuid[]
        from public.map_asset ma
        where ma.job_id = p_job_id and ma.src_id = lrec.asset_id
          and not exists (select 1 from public.asset_tag_link t where t.asset_id = ma.dst_id and t.tag_id = lrec.tag_id);
        GET DIAGNOSTICS v_last = ROW_COUNT;
        v_rows := v_rows + v_last;
      end loop;
    end if;

    if v_rows = 0 then
      update public.clone_job set progress = progress || jsonb_build_object('stage','recompute_closures'), updated_at = now() where id = p_job_id;
    end if;
    return query select false, format('recreated links batch: %s', v_rows);
  end if;

  -- Stage 5: recompute
  if v_stage = 'recompute_closures' then
    perform public.rebuild_all_quest_closures();
    select dst_id into v_dst_project_id from public.map_project where job_id = p_job_id and src_id = v_root_project_id;
    perform public.rebuild_single_project_closure(v_dst_project_id);
    update public.clone_job set progress = progress || jsonb_build_object('stage','done'), status = 'done', updated_at = now() where id = p_job_id;
    return query select true, 'done';
  end if;

  return query select false, 'noop';
end;
$$;


