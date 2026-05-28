-- Migration: Add project_dashboard_current table
-- Purpose: Store current project dashboard aggregates and serialized payload.

create table if not exists public.project_dashboard_current (
  project_id uuid primary key references public.project(id) on delete cascade,

  project_status text,

  total_quests int not null default 0,
  total_subquests int not null default 0,
  total_assets int not null default 0,

  total_quests_versions int not null default 0,

  expected_quests integer not null default 0,
  completed_quests int not null default 0,
  completed_subquests int not null default 0,

  inactive_quests int not null default 0,
  inactive_assets int not null default 0,

  assets_with_text int not null default 0,
  assets_with_audio int not null default 0,
  assets_with_image int not null default 0,

  assets_with_transcription int not null default 0,
  assets_with_translation int not null default 0,

  total_source_languages int not null default 0,
  total_target_languages int not null default 0,

  total_members int not null default 0,
  total_owners int not null default 0,

  dashboard_json jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.project_dashboard_current is
  'Current denormalized dashboard metrics for each project.';

comment on column public.project_dashboard_current.dashboard_json is
  'Serialized dashboard payload for flexible UI consumption.';

-- Keep updated_at in sync on row updates
create or replace function public._project_dashboard_current_set_updated_at()
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

drop trigger if exists project_dashboard_current_set_updated_at on public.project_dashboard_current;
create trigger project_dashboard_current_set_updated_at
before update on public.project_dashboard_current
for each row
execute function public._project_dashboard_current_set_updated_at();

-- Helpful index for status filtering
create index if not exists project_dashboard_current_status_idx
  on public.project_dashboard_current (project_status);

-- RLS for backend-managed table
alter table public.project_dashboard_current enable row level security;

do $$ begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'project_dashboard_current'
      and policyname = 'project_dashboard_current_service_role_all'
  ) then
    create policy project_dashboard_current_service_role_all
      on public.project_dashboard_current
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'project_dashboard_current'
      and policyname = 'project_dashboard_current_authenticated_select'
  ) then
    create policy project_dashboard_current_authenticated_select
      on public.project_dashboard_current
      for select
      to authenticated
      using (true);
  end if;
end $$;

-- Note: intentionally not added to PowerSync publication (backend-only aggregate table).