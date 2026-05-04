-- Migration: Add dashboard_refresh_queue table
-- Purpose: Queue project dashboard refresh jobs with retry metadata.

create table if not exists public.dashboard_refresh_queue (
  id uuid primary key default gen_random_uuid(),

  project_id uuid not null references public.project(id) on delete cascade,

  status text not null default 'pending'
    check (status in ('pending', 'processing', 'failed')),

  retry_count integer not null default 0
    check (retry_count >= 0),

  last_error text null,
  processing_at timestamptz null,
  next_attempt_at timestamptz not null default now(),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Prevent multiple queue entries for the same project
  constraint dashboard_refresh_queue_project_id_key unique (project_id)
);

comment on table public.dashboard_refresh_queue is
  'Queue for project dashboard refresh jobs, with retry controls and processing state.';

-- Indexes used by queue workers
create index if not exists dashboard_refresh_queue_status_next_attempt_idx
  on public.dashboard_refresh_queue (status, next_attempt_at);

create index if not exists dashboard_refresh_queue_processing_at_idx
  on public.dashboard_refresh_queue (processing_at);

-- Keep updated_at in sync on updates
create or replace function public._dashboard_refresh_queue_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = 'public'
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists dashboard_refresh_queue_set_updated_at on public.dashboard_refresh_queue;
create trigger dashboard_refresh_queue_set_updated_at
before update on public.dashboard_refresh_queue
for each row
execute function public._dashboard_refresh_queue_set_updated_at();

-- RLS (backend operational table)
alter table public.dashboard_refresh_queue enable row level security;

do $$ begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'dashboard_refresh_queue'
      and policyname = 'dashboard_refresh_queue_service_role_all'
  ) then
    create policy dashboard_refresh_queue_service_role_all
      on public.dashboard_refresh_queue
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

-- Note: intentionally not added to PowerSync publication (backend-only queue).