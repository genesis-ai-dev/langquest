-- purpose: include target_languoid_id in start_clone job options payload
-- notes: keeps existing target_language_id key for backward compatibility

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
      'target_languoid_id', p_target_language_id::text,
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
