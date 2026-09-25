begin;

select plan(3);

\ir rls_session.pgsql

do $$
declare
  owner_id uuid;
  outsider_id uuid;
  project_id uuid := gen_random_uuid();
begin
  owner_id := tests.seed_user('rls.owner.writes@langquest.org');
  outsider_id := tests.seed_user('rls.outsider.writes@langquest.org');

  insert into public.project (id, name, private, visible, creator_id)
  values (project_id, 'rls-private-writes', true, true, owner_id);

  insert into public.profile_project_link (profile_id, project_id, membership, active)
  values (owner_id, project_id, 'owner', true);
end;
$$;

call tests.login_as_user('rls.owner.writes@langquest.org'::text);
select lives_ok(
  $$update public.project set name = 'rls-private-writes-renamed' where name = 'rls-private-writes' or name = 'rls-private-writes-renamed'$$,
  'owner can update their private project'
);
call tests.logout();

call tests.login_as_user('rls.outsider.writes@langquest.org'::text);
select is(
  (
    select name from public.project
    where name in ('rls-private-writes', 'rls-private-writes-renamed')
  ),
  'rls-private-writes-renamed',
  'setup: private project is visible so the write denial can be tested'
);
select throws_ok(
  $$insert into public.asset (id, name, project_id, creator_id, content_type, created_at)
    select gen_random_uuid(), 'blocked-asset', id, auth.uid(), 'source', now()
    from public.project
    where name = 'rls-private-writes-renamed'$$,
  '42501'
);
call tests.logout();

select * from finish();
rollback;
