begin;

select plan(15);

\ir rls_session.pgsql

-- Invite INSERT fires handle_invite_trigger (outbound email). Disable it so
-- these cases measure RLS, not vault/edge-function availability.
alter table public.invite disable trigger on_invite_awaiting_trigger;

do $$
declare
  owner_id uuid;
  member_id uuid;
  invitee_id uuid;
  outsider_id uuid;
  requester_id uuid;
  project_id uuid := gen_random_uuid();
begin
  owner_id := tests.seed_user('rls.owner.membership@langquest.org');
  member_id := tests.seed_user('rls.member.membership@langquest.org');
  invitee_id := tests.seed_user('rls.invitee.membership@langquest.org');
  outsider_id := tests.seed_user('rls.outsider.membership@langquest.org');
  requester_id := tests.seed_user('rls.requester.membership@langquest.org');

  insert into public.project (id, name, private, visible, creator_id)
  values (project_id, 'rls-membership', true, true, owner_id);

  insert into public.profile_project_link (profile_id, project_id, membership, active)
  values
    (owner_id, project_id, 'owner', true),
    (member_id, project_id, 'member', true);
end;
$$;

call tests.login_as_user('rls.owner.membership@langquest.org'::text);
select lives_ok(
  $$insert into public.invite (
      sender_profile_id, email, project_id, status, as_owner, count
    )
    select auth.uid(), 'rls.invitee.membership@langquest.org', id, 'pending', false, 1
    from public.project
    where name = 'rls-membership'$$,
  'owner can insert an invite'
);
call tests.logout();

call tests.login_as_user('rls.member.membership@langquest.org'::text);
select throws_ok(
  $$insert into public.invite (
      sender_profile_id, email, project_id, status, as_owner, count
    )
    select auth.uid(), 'rls.outsider.membership@langquest.org', id, 'pending', false, 1
    from public.project
    where name = 'rls-membership'$$,
  '42501'
);
call tests.logout();

call tests.login_as_user('rls.outsider.membership@langquest.org'::text);
select throws_ok(
  $$insert into public.invite (
      sender_profile_id, email, project_id, status, as_owner, count
    )
    select auth.uid(), 'rls.requester.membership@langquest.org', id, 'pending', false, 1
    from public.project
    where name = 'rls-membership'$$,
  '42501'
);
call tests.logout();

call tests.login_as_user('rls.invitee.membership@langquest.org'::text);
select lives_ok(
  $$update public.invite
    set status = 'accepted', last_updated = now()
    where email = 'rls.invitee.membership@langquest.org'
      and project_id = (select id from public.project where name = 'rls-membership')$$,
  'invitee can accept a pending invite'
);
select lives_ok(
  $$insert into public.profile_project_link (
      profile_id, project_id, membership, active
    )
    select auth.uid(), id, 'member', true
    from public.project
    where name = 'rls-membership'$$,
  'invitee can insert membership after accepting an invite'
);
call tests.logout();

insert into public.invite (
  sender_profile_id, receiver_profile_id, email, project_id, status, as_owner, count, last_updated
)
select
  tests.profile_id('rls.owner.membership@langquest.org'),
  tests.profile_id('rls.outsider.membership@langquest.org'),
  'rls.outsider.membership@langquest.org',
  p.id,
  'pending',
  false,
  1,
  now() - interval '8 days'
from public.project p
where p.name = 'rls-membership';

call tests.login_as_user('rls.outsider.membership@langquest.org'::text);
update public.invite
  set status = 'accepted', last_updated = now()
  where email = 'rls.outsider.membership@langquest.org'
    and project_id = (select id from public.project where name = 'rls-membership');
update public.invite
  set status = 'declined', last_updated = now()
  where email = 'rls.invitee.membership@langquest.org'
    and project_id = (select id from public.project where name = 'rls-membership');
select throws_ok(
  $$insert into public.profile_project_link (
      profile_id, project_id, membership, active
    )
    select auth.uid(), id, 'member', true
    from public.project
    where name = 'rls-membership'$$,
  '42501'
);
call tests.logout();

select is(
  (
    select status from public.invite
    where email = 'rls.outsider.membership@langquest.org'
      and project_id = (select id from public.project where name = 'rls-membership')
  ),
  'pending',
  'receiver cannot accept an expired invite'
);
select is(
  (
    select status from public.invite
    where email = 'rls.invitee.membership@langquest.org'
      and project_id = (select id from public.project where name = 'rls-membership')
  ),
  'accepted',
  'outsider cannot change another user''s invite'
);

call tests.login_as_user('rls.requester.membership@langquest.org'::text);
select lives_ok(
  $$insert into public.request (sender_profile_id, project_id, status, count)
    select auth.uid(), id, 'pending', 1
    from public.project
    where name = 'rls-membership'$$,
  'authenticated user can insert their own membership request'
);
select throws_ok(
  $$insert into public.request (sender_profile_id, project_id, status, count)
    values (
      tests.profile_id('rls.owner.membership@langquest.org'),
      (select id from public.project where name = 'rls-membership'),
      'pending',
      1
    )$$,
  '42501'
);
call tests.logout();

insert into public.request (sender_profile_id, project_id, status, count)
select
  tests.profile_id('rls.outsider.membership@langquest.org'),
  id,
  'pending',
  1
from public.project
where name = 'rls-membership';

call tests.login_as_user('rls.member.membership@langquest.org'::text);
update public.request
  set status = 'accepted', last_updated = now()
  where sender_profile_id = tests.profile_id('rls.outsider.membership@langquest.org')
    and project_id = (select id from public.project where name = 'rls-membership');
update public.profile_project_link
  set active = false, last_updated = now()
  where profile_id = tests.profile_id('rls.owner.membership@langquest.org')
    and project_id = (select id from public.project where name = 'rls-membership');
call tests.logout();

select is(
  (
    select status from public.request
    where sender_profile_id = tests.profile_id('rls.outsider.membership@langquest.org')
      and project_id = (select id from public.project where name = 'rls-membership')
  ),
  'pending',
  'member cannot accept someone else''s request'
);
select is(
  (
    select active from public.profile_project_link
    where profile_id = tests.profile_id('rls.owner.membership@langquest.org')
      and project_id = (select id from public.project where name = 'rls-membership')
  ),
  true,
  'member cannot deactivate an owner'
);

call tests.login_as_user('rls.owner.membership@langquest.org'::text);
select lives_ok(
  $$update public.request
    set status = 'accepted', last_updated = now()
    where sender_profile_id = tests.profile_id('rls.requester.membership@langquest.org')
      and project_id = (select id from public.project where name = 'rls-membership')$$,
  'owner can accept a membership request'
);
select lives_ok(
  $$insert into public.profile_project_link (
      profile_id, project_id, membership, active
    )
    values (
      tests.profile_id('rls.requester.membership@langquest.org'),
      (select id from public.project where name = 'rls-membership'),
      'member',
      true
    )$$,
  'owner can insert membership for an accepted requester'
);
select lives_ok(
  $$update public.profile_project_link
    set active = false, last_updated = now()
    where profile_id = tests.profile_id('rls.member.membership@langquest.org')
      and project_id = (select id from public.project where name = 'rls-membership')$$,
  'owner can deactivate a member'
);
call tests.logout();

select * from finish();
rollback;
