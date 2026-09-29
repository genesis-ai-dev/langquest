begin;

select plan(6);

\ir rls_session.pgsql

-- Owner can rename/hide/unlink unpublished assets. Member and outsider
-- updates match 0 rows (policy USING), not a throw.

do $$
declare
  owner_id uuid;
  member_id uuid;
  project_id uuid := gen_random_uuid();
  quest_id uuid := gen_random_uuid();
  keep_id uuid := gen_random_uuid();
  hide_id uuid := gen_random_uuid();
  unlink_id uuid := gen_random_uuid();
begin
  owner_id := tests.seed_user('rls.owner.assets@langquest.org');
  member_id := tests.seed_user('rls.member.assets@langquest.org');
  perform tests.seed_user('rls.outsider.assets@langquest.org');

  insert into public.project (id, name, private, visible, creator_id)
  values (project_id, 'rls-assets', false, true, owner_id);

  insert into public.profile_project_link (profile_id, project_id, membership, active)
  values
    (owner_id, project_id, 'owner', true),
    (member_id, project_id, 'member', true);

  insert into public.quest (
    id, name, project_id, creator_id, created_at, visible, published_at
  ) values (
    quest_id, 'rls-assets-quest', project_id, owner_id, now(), true, null
  );

  insert into public.asset (
    id, name, project_id, creator_id, content_type, created_at, visible, active
  ) values
    (keep_id, 'rls-asset-keep', project_id, owner_id, 'source', now(), true, true),
    (hide_id, 'rls-asset-hide', project_id, owner_id, 'source', now(), true, true),
    (unlink_id, 'rls-asset-unlink', project_id, owner_id, 'source', now(), true, true);

  insert into public.quest_asset_link (
    quest_id, asset_id, active, visible, created_at, last_updated
  ) values
    (quest_id, keep_id, true, true, now(), now()),
    (quest_id, hide_id, true, true, now(), now()),
    (quest_id, unlink_id, true, true, now(), now());
end;
$$;

call tests.login_as_user('rls.owner.assets@langquest.org'::text);
update public.asset
  set name = 'rls-asset-renamed'
  where name = 'rls-asset-keep';
call tests.logout();
select is(
  (
    select name from public.asset
    where name in ('rls-asset-keep', 'rls-asset-renamed')
  ),
  'rls-asset-renamed',
  'owner can rename an unpublished asset'
);

call tests.login_as_user('rls.member.assets@langquest.org'::text);
update public.asset
  set name = 'rls-asset-member-hack'
  where name = 'rls-asset-renamed';
call tests.logout();
select is(
  (
    select name from public.asset
    where name in ('rls-asset-renamed', 'rls-asset-member-hack')
  ),
  'rls-asset-renamed',
  'member cannot rename an asset'
);

call tests.login_as_user('rls.outsider.assets@langquest.org'::text);
update public.asset
  set name = 'rls-asset-outsider-hack'
  where name = 'rls-asset-renamed';
call tests.logout();
select is(
  (
    select name from public.asset
    where name in ('rls-asset-renamed', 'rls-asset-outsider-hack')
  ),
  'rls-asset-renamed',
  'outsider cannot rename an asset'
);

call tests.login_as_user('rls.owner.assets@langquest.org'::text);
update public.asset
  set visible = false
  where name = 'rls-asset-hide';
call tests.logout();
select is(
  (
    select visible from public.asset
    where name = 'rls-asset-hide'
  ),
  false,
  'owner can hide an unpublished asset'
);

call tests.login_as_user('rls.owner.assets@langquest.org'::text);
update public.quest_asset_link
  set active = false
  where asset_id = (
    select id from public.asset where name = 'rls-asset-unlink'
  );
call tests.logout();
select is(
  (
    select qal.active
    from public.quest_asset_link qal
    join public.asset a on a.id = qal.asset_id
    where a.name = 'rls-asset-unlink'
  ),
  false,
  'owner can soft-delete an unpublished quest asset link'
);

call tests.login_as_user('rls.member.assets@langquest.org'::text);
update public.quest_asset_link
  set active = true
  where asset_id = (
    select id from public.asset where name = 'rls-asset-unlink'
  );
call tests.logout();
select is(
  (
    select qal.active
    from public.quest_asset_link qal
    join public.asset a on a.id = qal.asset_id
    where a.name = 'rls-asset-unlink'
  ),
  false,
  'member cannot reactivate a quest asset link'
);

select * from finish();
rollback;
