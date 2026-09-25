begin;

select plan(6);

\ir rls_session.pgsql

-- Owners stamp published_at. Creators can also update unpublished rows
-- (including published_at). Members who did not create the quest cannot.
-- Published quests and their assets reject further mutation (0 rows).

do $$
declare
  owner_id uuid;
  member_id uuid;
  project_id uuid := gen_random_uuid();
  owner_draft_id uuid := gen_random_uuid();
  member_draft_id uuid := gen_random_uuid();
  outsider_target_id uuid := gen_random_uuid();
  published_id uuid := gen_random_uuid();
  published_asset_id uuid := gen_random_uuid();
begin
  owner_id := tests.seed_user('rls.owner.publish@langquest.org');
  member_id := tests.seed_user('rls.member.publish@langquest.org');
  perform tests.seed_user('rls.outsider.publish@langquest.org');

  insert into public.project (id, name, private, visible, creator_id)
  values (project_id, 'rls-quest-publish', false, true, owner_id);

  insert into public.profile_project_link (profile_id, project_id, membership, active)
  values
    (owner_id, project_id, 'owner', true),
    (member_id, project_id, 'member', true);

  insert into public.quest (
    id, name, project_id, creator_id, created_at, visible, published_at
  ) values
    (owner_draft_id, 'rls-owner-draft', project_id, owner_id, now(), true, null),
    (member_draft_id, 'rls-member-draft', project_id, member_id, now(), true, null),
    (outsider_target_id, 'rls-outsider-target', project_id, owner_id, now(), true, null),
    (published_id, 'rls-published', project_id, owner_id, now(), true, now());

  insert into public.asset (
    id, name, project_id, creator_id, content_type, created_at
  ) values (
    published_asset_id, 'rls-published-asset', project_id, owner_id, 'source', now()
  );

  insert into public.quest_asset_link (
    quest_id, asset_id, active, visible, created_at, last_updated
  ) values (
    published_id, published_asset_id, true, true, now(), now()
  );
end;
$$;

call tests.login_as_user('rls.member.publish@langquest.org'::text);
update public.quest
  set published_at = now()
  where name = 'rls-owner-draft';
call tests.logout();
select is(
  (
    select published_at is null from public.quest
    where name = 'rls-owner-draft'
  ),
  true,
  'member who did not create the quest cannot stamp published_at'
);

call tests.login_as_user('rls.member.publish@langquest.org'::text);
update public.quest
  set published_at = now()
  where name = 'rls-member-draft';
call tests.logout();
select isnt(
  (
    select published_at from public.quest
    where name = 'rls-member-draft'
  ),
  null,
  'creator can stamp published_at on their unpublished quest'
);

call tests.login_as_user('rls.owner.publish@langquest.org'::text);
update public.quest
  set published_at = now()
  where name = 'rls-owner-draft';
call tests.logout();
select isnt(
  (
    select published_at from public.quest
    where name = 'rls-owner-draft'
  ),
  null,
  'owner can stamp published_at on an unpublished quest'
);

call tests.login_as_user('rls.outsider.publish@langquest.org'::text);
update public.quest
  set published_at = now()
  where name = 'rls-outsider-target';
call tests.logout();
select is(
  (
    select published_at is null from public.quest
    where name = 'rls-outsider-target'
  ),
  true,
  'outsider cannot stamp published_at'
);

call tests.login_as_user('rls.owner.publish@langquest.org'::text);
update public.quest
  set name = 'rls-published-hacked'
  where name = 'rls-published';
update public.asset
  set name = 'rls-published-asset-hacked'
  where name = 'rls-published-asset';
call tests.logout();
select is(
  (
    select name from public.quest
    where name in ('rls-published', 'rls-published-hacked')
  ),
  'rls-published',
  'owner cannot rename a published quest'
);
select is(
  (
    select name from public.asset
    where name in ('rls-published-asset', 'rls-published-asset-hacked')
  ),
  'rls-published-asset',
  'owner cannot update an asset on a published quest'
);

select * from finish();
rollback;
