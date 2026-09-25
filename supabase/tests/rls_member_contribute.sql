begin;

select plan(2);

\ir rls_session.pgsql

do $$
declare
  owner_id uuid;
  member_id uuid;
  project_id uuid := gen_random_uuid();
begin
  owner_id := tests.seed_user('rls.owner.contribute@langquest.org');
  member_id := tests.seed_user('rls.member.contribute@langquest.org');

  insert into public.project (id, name, private, visible, creator_id)
  values (project_id, 'rls-member-contribute', true, true, owner_id);

  insert into public.profile_project_link (profile_id, project_id, membership, active)
  values
    (owner_id, project_id, 'owner', true),
    (member_id, project_id, 'member', true);
end;
$$;

call tests.login_as_user('rls.member.contribute@langquest.org'::text);
select lives_ok(
  $$insert into public.asset (id, name, project_id, creator_id, content_type, created_at)
    select gen_random_uuid(), 'member-source-asset', id, auth.uid(), 'source', now()
    from public.project
    where name = 'rls-member-contribute'$$,
  'member can insert an asset on a project they belong to'
);
select lives_ok(
  $$insert into public.asset_content_link (id, asset_id, text)
    select gen_random_uuid(), a.id, 'member translation'
    from public.asset a
    join public.project p on p.id = a.project_id
    where p.name = 'rls-member-contribute'
      and a.name = 'member-source-asset'$$,
  'member can insert asset_content_link on their asset'
);
call tests.logout();

select * from finish();
rollback;
