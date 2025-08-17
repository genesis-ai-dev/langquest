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


