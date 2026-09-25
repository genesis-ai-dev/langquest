-- ============================================================================
-- Migration: Storage object deletion queue for asset_content_link audio
-- Path A (server-only) — NO schema version bump. Nothing here is visible to
-- the client: no synced columns change, no RLS the client depends on changes.
-- ============================================================================
--
-- PURPOSE:
--   Audio files now upload to Supabase Storage as soon as they are recorded
--   (before the quest is published). When an asset_content_link row is deleted
--   — or its audio[] is changed so it no longer references an object — the
--   storage object it pointed at becomes an orphan. This migration removes
--   those objects automatically, with a grace period.
--
-- WHY A QUEUE + GRACE PERIOD (not an immediate delete):
--   * Undo. The app's undo history recreates deleted rows referencing the same
--     object names; deleting the object on row delete would break undo.
--   * Merge / re-reference. Merging assets deletes one acl row and creates
--     another that copies the same audio[] values.
--   * Async HTTP. Storage objects must be removed through the Storage API (a
--     direct DELETE on storage.objects orphans the S3 blob). pg_net is
--     fire-and-forget, so confirmation has to happen on a later pass anyway.
--   The processor therefore re-checks references at deletion time and only
--   removes objects that nothing points at any more.
--
-- FLOW:
--   acl DELETE / UPDATE OF audio
--     → enqueue each dropped object name (eligible_at = now() + 24h)
--   pg_cron every 15 min → process_storage_object_deletions()
--     → still referenced by any acl.audio  → drop queue row
--     → no storage.objects row             → drop queue row (done / never uploaded)
--     → else DELETE /storage/v1/object/{bucket}/{name} via pg_net,
--       bump attempts, retry in 15 min (confirmation = object row gone)
--     → after MAX attempts stop retrying; row stays with last_error for review
--
-- SECRETS (vault.decrypted_secrets, both already used by other triggers):
--   supabase_url, supabase_service_role_key. When either is missing the
--   processor logs and skips; the queue simply accumulates until configured.
-- ============================================================================

create extension if not exists pg_net;

-- pg_cron needs shared_preload_libraries; hosted Supabase and the local CLI
-- image both have it, but tolerate environments that do not.
do $$
begin
  create extension if not exists pg_cron;
exception
  when others then
    raise notice 'pg_cron unavailable (%); schedule process_storage_object_deletions() externally', sqlerrm;
end $$;

-- ----------------------------------------------------------------------------
-- PART 1: Queue table
-- ----------------------------------------------------------------------------

create table if not exists public.storage_object_deletion_queue (
  object_name text primary key,
  requested_at timestamptz not null default now(),
  -- Grace period. Re-enqueueing the same name pushes this out again.
  eligible_at timestamptz not null default now() + interval '24 hours',
  attempts int not null default 0,
  last_attempt_at timestamptz,
  last_request_id bigint,
  last_error text
);

comment on table public.storage_object_deletion_queue is
  'Storage object names dropped from asset_content_link.audio, awaiting deletion via the Storage API after a grace period. Server-only; processed by process_storage_object_deletions().';

create index if not exists idx_storage_object_deletion_queue_eligible
  on public.storage_object_deletion_queue (eligible_at)
  where attempts < 10;

-- No client access: RLS on, no policies. Only the owner (postgres) and the
-- security-definer processor touch it.
alter table public.storage_object_deletion_queue enable row level security;
revoke all on table public.storage_object_deletion_queue from anon, authenticated;

-- ----------------------------------------------------------------------------
-- PART 2: Enqueue helper + acl triggers
-- ----------------------------------------------------------------------------

-- Values that can never be storage objects (legacy file:// URIs, blob: URLs,
-- blanks) are skipped. Everything else is enqueued verbatim: the object name
-- is exactly the audio[] string (including the legacy `local/` prefix on
-- pre-2.6 rows, which were uploaded under that name).
create or replace function public.enqueue_storage_object_deletions(p_names jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.storage_object_deletion_queue (object_name)
  select distinct elem.name
    from jsonb_array_elements_text(
           case when jsonb_typeof(p_names) = 'array' then p_names else '[]'::jsonb end
         ) as elem(name)
   where btrim(elem.name) <> ''
     and elem.name not like 'file://%'
     and elem.name not like 'blob:%'
  on conflict (object_name) do update
     set requested_at = now(),
         eligible_at = now() + interval '24 hours',
         attempts = 0,
         last_error = null;
$$;

comment on function public.enqueue_storage_object_deletions(jsonb) is
  'Queue storage object names (from an audio[] jsonb array) for grace-period deletion. Re-enqueueing resets the grace period.';

create or replace function public.acl_enqueue_storage_object_deletions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dropped jsonb;
begin
  if tg_op = 'DELETE' then
    v_dropped := old.audio;
  else
    -- UPDATE OF audio: only names no longer present in the new array.
    select coalesce(jsonb_agg(elem.name), '[]'::jsonb)
      into v_dropped
      from jsonb_array_elements_text(
             case when jsonb_typeof(old.audio) = 'array' then old.audio else '[]'::jsonb end
           ) as elem(name)
     where not (
       jsonb_typeof(new.audio) = 'array'
       and new.audio ? elem.name
     );
  end if;

  if v_dropped is not null and jsonb_typeof(v_dropped) = 'array'
     and jsonb_array_length(v_dropped) > 0 then
    perform public.enqueue_storage_object_deletions(v_dropped);
  end if;

  return null;
end;
$$;

drop trigger if exists trigger_acl_enqueue_storage_object_deletions_delete
  on public.asset_content_link;
create trigger trigger_acl_enqueue_storage_object_deletions_delete
  after delete on public.asset_content_link
  for each row
  execute function public.acl_enqueue_storage_object_deletions();

drop trigger if exists trigger_acl_enqueue_storage_object_deletions_update
  on public.asset_content_link;
create trigger trigger_acl_enqueue_storage_object_deletions_update
  after update of audio on public.asset_content_link
  for each row
  when (old.audio is distinct from new.audio)
  execute function public.acl_enqueue_storage_object_deletions();

comment on function public.acl_enqueue_storage_object_deletions() is
  'AFTER DELETE / AFTER UPDATE OF audio on asset_content_link: queue object names that the row no longer references.';

-- ----------------------------------------------------------------------------
-- PART 3: Processor
-- ----------------------------------------------------------------------------

create or replace function public.process_storage_object_deletions(p_limit int default 200)
returns table (
  object_name text,
  action text
)
language plpgsql
security definer
set search_path = public, storage, net
as $$
declare
  c_max_attempts constant int := 10;
  c_retry_interval constant interval := interval '15 minutes';
  v_base_url text;
  v_sr_key text;
  v_row record;
  v_obj record;
  v_request_id bigint;
  v_status int;
  v_error text;
  v_referenced boolean;
  v_found boolean;
begin
  begin
    select decrypted_secret into v_base_url
      from vault.decrypted_secrets where name = 'supabase_url' limit 1;
  exception when others then
    v_base_url := null;
  end;
  begin
    select decrypted_secret into v_sr_key
      from vault.decrypted_secrets where name = 'supabase_service_role_key' limit 1;
  exception when others then
    v_sr_key := null;
  end;

  for v_row in
    select q.object_name, q.attempts, q.last_request_id
      from public.storage_object_deletion_queue q
     where q.eligible_at <= now()
       and q.attempts < c_max_attempts
     order by q.eligible_at
     limit p_limit
     for update skip locked
  loop
    object_name := v_row.object_name;

    -- 1. Anything still pointing at this object? (GIN index on acl.audio.)
    --    Undo / merge recreate rows with the same names inside the grace
    --    period; the object must survive.
    select exists (
      select 1 from public.asset_content_link acl
       where acl.audio ? v_row.object_name
    ) into v_referenced;

    if v_referenced then
      delete from public.storage_object_deletion_queue q
       where q.object_name = v_row.object_name;
      action := 'kept_referenced';
      return next;
      continue;
    end if;

    -- 2. Surface the outcome of the previous attempt, if pg_net still has it.
    if v_row.last_request_id is not null then
      begin
        select r.status_code, coalesce(r.error_msg, left(r.content, 500))
          into v_status, v_error
          from net._http_response r
         where r.id = v_row.last_request_id;
      exception when others then
        v_status := null;
        v_error := null;
      end;
    else
      v_status := null;
      v_error := null;
    end if;

    -- 3. No storage object left → done (deleted by an earlier attempt, or it
    --    was never uploaded).
    select exists (
      select 1 from storage.objects o where o.name = v_row.object_name
    ) into v_found;

    if not v_found then
      delete from public.storage_object_deletion_queue q
       where q.object_name = v_row.object_name;
      action := 'done';
      return next;
      continue;
    end if;

    -- 4. Still there: ask the Storage API to remove it. One request per
    --    bucket holding that name (filenames are UUIDs, so normally one).
    if v_base_url is null or v_base_url = '' or v_sr_key is null or v_sr_key = '' then
      raise log '[storage_deletion] supabase_url / supabase_service_role_key not in vault; skipping %', v_row.object_name;
      action := 'skipped_unconfigured';
      return next;
      continue;
    end if;

    v_request_id := null;
    for v_obj in
      select o.bucket_id from storage.objects o where o.name = v_row.object_name
    loop
      begin
        select net.http_delete(
          url := v_base_url || '/storage/v1/object/' || v_obj.bucket_id || '/' || v_row.object_name,
          headers := jsonb_build_object(
            'Authorization', 'Bearer ' || v_sr_key,
            'apikey', v_sr_key
          ),
          timeout_milliseconds := 10000
        ) into v_request_id;
      exception when others then
        v_error := sqlerrm;
        raise log '[storage_deletion] http_delete failed for %/%: %', v_obj.bucket_id, v_row.object_name, sqlerrm;
      end;
    end loop;

    update public.storage_object_deletion_queue q
       set attempts = q.attempts + 1,
           last_attempt_at = now(),
           last_request_id = v_request_id,
           last_error = case
             when v_status is not null and (v_status < 200 or v_status >= 300)
               then 'HTTP ' || v_status || coalesce(': ' || v_error, '')
             when v_status is null and v_error is not null then v_error
             else q.last_error
           end,
           eligible_at = now() + c_retry_interval
     where q.object_name = v_row.object_name;

    action := 'delete_requested';
    return next;
  end loop;

  return;
end;
$$;

comment on function public.process_storage_object_deletions(int) is
  'Cron worker: for eligible queue rows, drop re-referenced names, finish names with no storage object, otherwise request deletion through the Storage API (pg_net) and retry until the object row disappears.';

revoke all on function public.process_storage_object_deletions(int) from public, anon, authenticated;
revoke all on function public.enqueue_storage_object_deletions(jsonb) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- PART 4: Schedule
-- ----------------------------------------------------------------------------

do $$
begin
  -- cron.schedule(name, …) upserts by job name, so re-running is safe.
  perform cron.schedule(
    'process-storage-object-deletions',
    '*/15 * * * *',
    $job$ select public.process_storage_object_deletions(); $job$
  );
exception
  when undefined_table or undefined_function or invalid_schema_name then
    raise notice 'pg_cron not available; process_storage_object_deletions() is not scheduled';
  when others then
    raise notice 'Could not schedule process_storage_object_deletions(): %', sqlerrm;
end $$;
