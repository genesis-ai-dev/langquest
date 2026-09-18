begin;

select plan(4);

\ir rls_session.pgsql

do $$
declare
  owner_id uuid;
  member_id uuid;
  project_id uuid := '11111111-1111-4111-8111-111111111111';
  source_id uuid := '22222222-2222-4222-8222-222222222222';
begin
  owner_id := tests.seed_user('rls.owner.tvote@langquest.org');
  member_id := tests.seed_user('rls.member.tvote@langquest.org');
  perform tests.seed_user('rls.outsider.tvote@langquest.org');

  insert into public.project (id, name, private, visible, creator_id)
  values (project_id, 'rls-translations-votes', true, true, owner_id);

  insert into public.profile_project_link (profile_id, project_id, membership, active)
  values
    (owner_id, project_id, 'owner', true),
    (member_id, project_id, 'member', true);

  insert into public.asset (id, name, project_id, creator_id, content_type, created_at)
  values (source_id, 'rls-source-asset', project_id, owner_id, 'source', now());
end;
$$;

call tests.login_as_user('rls.member.tvote@langquest.org'::text);
select lives_ok(
  $$insert into public.asset (
      id, name, project_id, creator_id, content_type, source_asset_id, created_at
    ) values (
      '33333333-3333-4333-8333-333333333333',
      'member-translation',
      '11111111-1111-4111-8111-111111111111',
      auth.uid(),
      'translation',
      '22222222-2222-4222-8222-222222222222',
      now()
    )$$,
  'member can insert a translation asset on a project they belong to'
);
select lives_ok(
  $$insert into public.vote (id, asset_id, polarity, creator_id)
    values (
      gen_random_uuid(),
      '33333333-3333-4333-8333-333333333333',
      'up',
      auth.uid()
    )$$,
  'member can insert a vote on a translation'
);
call tests.logout();

call tests.login_as_user('rls.outsider.tvote@langquest.org'::text);
select throws_ok(
  $$insert into public.asset (
      id, name, project_id, creator_id, content_type, source_asset_id, created_at
    ) values (
      '44444444-4444-4444-8444-444444444444',
      'outsider-translation',
      '11111111-1111-4111-8111-111111111111',
      auth.uid(),
      'translation',
      '22222222-2222-4222-8222-222222222222',
      now()
    )$$,
  '42501'
);
-- Vote INSERT only checks creator_id = auth.uid(). Membership is enforced in the app.
select lives_ok(
  $$insert into public.vote (id, asset_id, polarity, creator_id)
    values (
      gen_random_uuid(),
      '33333333-3333-4333-8333-333333333333',
      'up',
      auth.uid()
    )$$,
  'outsider vote INSERT currently succeeds at RLS (app can() blocks it)'
);
call tests.logout();

select * from finish();
rollback;
