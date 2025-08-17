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


