-- purpose: allow initiating clone jobs from the website by bypassing RLS via SECURITY DEFINER
-- notes:
-- - redefines start_clone and enqueue_clone as SECURITY DEFINER with empty search_path
-- - rationale: starting a job writes to public.clone_job and uses pgmq; site callers may be blocked by RLS

set check_function_bodies = off;

create or replace function public.enqueue_clone(job_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pgmq.create('clone_queue');
  perform pgmq.send('clone_queue', jsonb_build_object('job_id', job_id));
  update public.clone_job set status = 'queued', updated_at = now() where id = job_id and status <> 'running';
end;
$$;

create or replace function public.start_clone(
  p_root_project_id uuid,
  p_new_project_name text,
  p_target_language_id uuid,
  p_creator_id uuid,
  p_batch_size int default 25
)
returns uuid
language plpgsql
security definer
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

grant execute on function public.start_clone(uuid, text, uuid, uuid, int) to authenticated, anon;

