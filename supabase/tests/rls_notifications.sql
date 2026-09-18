begin;

select plan(5);

\ir rls_session.pgsql

-- Notifications are own-row only. There is no INSERT policy; rows come from
-- triggers. SELECT and UPDATE require profile_id = auth.uid().

do $$
declare
  owner_id uuid;
  other_id uuid;
begin
  owner_id := tests.seed_user('rls.owner.notify@langquest.org');
  other_id := tests.seed_user('rls.other.notify@langquest.org');

  insert into public.notification (
    id, profile_id, viewed, target_table_name, target_record_id
  ) values (
    gen_random_uuid(), owner_id, false, 'invite', gen_random_uuid()
  );
end;
$$;

call tests.login_as_user('rls.owner.notify@langquest.org'::text);
select isnt_empty(
  $$select id from public.notification where profile_id = auth.uid()$$,
  'user can select their own notifications'
);
update public.notification
  set viewed = true
  where profile_id = auth.uid();
call tests.logout();
select is(
  (
    select viewed from public.notification
    where profile_id = tests.profile_id('rls.owner.notify@langquest.org')
  ),
  true,
  'user can mark their own notification viewed'
);

call tests.login_as_user('rls.other.notify@langquest.org'::text);
select is(
  (
    select count(*)::int from public.notification
    where profile_id = tests.profile_id('rls.owner.notify@langquest.org')
  ),
  0,
  'other user cannot select someone else''s notifications'
);
update public.notification
  set viewed = false
  where profile_id = tests.profile_id('rls.owner.notify@langquest.org');
call tests.logout();
select is(
  (
    select viewed from public.notification
    where profile_id = tests.profile_id('rls.owner.notify@langquest.org')
  ),
  true,
  'other user cannot update someone else''s notifications'
);

call tests.login_as_anon();
select is(
  (
    select count(*)::int from public.notification
  ),
  0,
  'anon cannot select notifications'
);
call tests.logout();

select * from finish();
rollback;
