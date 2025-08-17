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


