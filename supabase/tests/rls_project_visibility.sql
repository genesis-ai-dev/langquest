begin;

select plan(4);

\ir rls_session.pgsql

do $$
declare
  owner_id uuid;
  public_id uuid := gen_random_uuid();
  private_id uuid := gen_random_uuid();
begin
  owner_id := tests.seed_user('rls.owner.visibility@langquest.org');

  insert into public.project (id, name, private, visible, creator_id)
  values
    (public_id, 'rls-public-project', false, true, owner_id),
    (private_id, 'rls-private-project', true, true, owner_id);

  insert into public.profile_project_link (profile_id, project_id, membership, active)
  values (owner_id, public_id, 'owner', true), (owner_id, private_id, 'owner', true);
end;
$$;

call tests.login_as_anon();
select isnt_empty(
  $$select id from public.project where name = 'rls-public-project'$$,
  'anon can read a public project'
);
-- SELECT on project is currently open (Enable read access for all users).
-- Privacy is enforced on writes and in the app permission matrix.
select isnt_empty(
  $$select id from public.project where name = 'rls-private-project'$$,
  'anon can currently read a private project (SELECT is open; writes are not)'
);
call tests.logout();

call tests.login_as_user('rls.owner.visibility@langquest.org'::text);
select isnt_empty(
  $$select id from public.project where name = 'rls-public-project'$$,
  'owner can read a public project'
);
select isnt_empty(
  $$select id from public.project where name = 'rls-private-project'$$,
  'owner can read a private project'
);
call tests.logout();

select * from finish();
rollback;
