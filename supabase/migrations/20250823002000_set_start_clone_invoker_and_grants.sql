-- purpose: revert start_clone to SECURITY INVOKER while keeping enqueue_clone as definer
-- notes: callers should use proper auth (service_role in dev) to bypass RLS; this is safer and non-destructive

set check_function_bodies = off;

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

revoke all on function public.start_clone(uuid, text, uuid, uuid, int) from public;
grant execute on function public.start_clone(uuid, text, uuid, uuid, int) to authenticated;

