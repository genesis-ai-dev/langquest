begin;

select plan(11);

\ir rls_session.pgsql

-- Storage object deletion queue (20260917150000_storage_object_deletion_queue):
--   * deleting an acl row queues every audio[] object name with a 24h grace
--   * changing audio[] queues only the names that were dropped
--   * values that can never be objects (file://, blob:, blank) are skipped
--   * the processor keeps names another acl row still references,
--     finishes names with no storage object, and ignores rows still in grace

do $$
declare
  owner_id uuid;
  project_id uuid := gen_random_uuid();
  asset_a uuid := gen_random_uuid();
  asset_b uuid := gen_random_uuid();
begin
  owner_id := tests.seed_user('sdq.owner@langquest.org');

  insert into public.project (id, name, private, visible, creator_id)
  values (project_id, 'sdq-project', false, true, owner_id);

  insert into public.asset (id, name, project_id, creator_id, content_type, created_at)
  values
    (asset_a, 'sdq-asset-a', project_id, owner_id, 'source', now()),
    (asset_b, 'sdq-asset-b', project_id, owner_id, 'source', now());

  -- Row to delete outright: two real names plus junk that must be skipped.
  insert into public.asset_content_link (id, asset_id, text, audio)
  values (
    gen_random_uuid(), asset_a, 'sdq-delete-me',
    '["sdq-one.m4a", "local/sdq-two.m4a", "file:///tmp/sdq-legacy.m4a", "blob:http://x/y", "  "]'::jsonb
  );

  -- Row whose audio[] will be edited.
  insert into public.asset_content_link (id, asset_id, text, audio)
  values (
    gen_random_uuid(), asset_b, 'sdq-edit-me',
    '["sdq-keep.m4a", "sdq-drop.m4a"]'::jsonb
  );

  -- Independent row that keeps referencing one of the names deleted above.
  insert into public.asset_content_link (id, asset_id, text, audio)
  values (
    gen_random_uuid(), asset_b, 'sdq-still-references',
    '["sdq-one.m4a"]'::jsonb
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Enqueue on DELETE
-- ---------------------------------------------------------------------------

delete from public.asset_content_link where text = 'sdq-delete-me';

select set_eq(
  $$select object_name from public.storage_object_deletion_queue
     where object_name like 'sdq-%' or object_name like 'local/sdq-%'$$,
  array['sdq-one.m4a', 'local/sdq-two.m4a'],
  'deleting an acl row queues its storage object names and skips file://, blob: and blank values'
);

select ok(
  (
    select bool_and(eligible_at between now() + interval '23 hours 59 minutes'
                                   and now() + interval '24 hours 1 minute')
    from public.storage_object_deletion_queue
    where object_name in ('sdq-one.m4a', 'local/sdq-two.m4a')
  ),
  'queued names get a 24 hour grace period'
);

-- ---------------------------------------------------------------------------
-- Enqueue on UPDATE OF audio (only dropped names)
-- ---------------------------------------------------------------------------

update public.asset_content_link
   set audio = '["sdq-keep.m4a", "sdq-new.m4a"]'::jsonb
 where text = 'sdq-edit-me';

select ok(
  exists (select 1 from public.storage_object_deletion_queue where object_name = 'sdq-drop.m4a'),
  'changing audio[] queues the name that was dropped'
);
select ok(
  not exists (
    select 1 from public.storage_object_deletion_queue
    where object_name in ('sdq-keep.m4a', 'sdq-new.m4a')
  ),
  'changing audio[] does not queue names that are still (or newly) referenced'
);

-- Re-enqueueing resets the grace period.
update public.storage_object_deletion_queue
   set eligible_at = now() - interval '1 hour', attempts = 3
 where object_name = 'sdq-drop.m4a';
select public.enqueue_storage_object_deletions('["sdq-drop.m4a"]'::jsonb);
select ok(
  (
    select eligible_at > now() + interval '23 hours' and attempts = 0
    from public.storage_object_deletion_queue where object_name = 'sdq-drop.m4a'
  ),
  're-enqueueing a name resets its grace period and attempt count'
);

-- ---------------------------------------------------------------------------
-- Processor
-- ---------------------------------------------------------------------------

-- Nothing is eligible yet: the processor must leave the queue alone.
select is(
  (select count(*)::int from public.process_storage_object_deletions()
    where object_name like 'sdq-%' or object_name like 'local/sdq-%'),
  0,
  'processor ignores rows still inside their grace period'
);

-- Make everything eligible.
update public.storage_object_deletion_queue
   set eligible_at = now() - interval '1 minute'
 where object_name like 'sdq-%' or object_name like 'local/sdq-%';

create temp table sdq_results as
  select * from public.process_storage_object_deletions();

select is(
  (select action from sdq_results where object_name = 'sdq-one.m4a'),
  'kept_referenced',
  'a name another acl row still references is dropped from the queue without deleting the object'
);
select ok(
  not exists (select 1 from public.storage_object_deletion_queue where object_name = 'sdq-one.m4a'),
  'kept_referenced removes the queue row'
);

select is(
  (select action from sdq_results where object_name = 'local/sdq-two.m4a'),
  'done',
  'a name with no storage object is finished immediately'
);
select is(
  (select action from sdq_results where object_name = 'sdq-drop.m4a'),
  'done',
  'a dropped name with no storage object is finished immediately'
);
select ok(
  not exists (
    select 1 from public.storage_object_deletion_queue
    where object_name in ('local/sdq-two.m4a', 'sdq-drop.m4a')
  ),
  'done removes the queue rows'
);

select * from finish();

rollback;
