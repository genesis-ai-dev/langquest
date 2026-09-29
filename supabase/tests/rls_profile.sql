begin;

select plan(5);

\ir rls_session.pgsql

do $$
begin
  perform tests.seed_user('rls.owner.profile@langquest.org');
  perform tests.seed_user('rls.other.profile@langquest.org');
end;
$$;

call tests.login_as_user('rls.owner.profile@langquest.org'::text);
select isnt(
  (
    select id from public.profile
    where id = auth.uid()
  ),
  null,
  'user can select their own profile'
);
update public.profile
  set username = 'rls-profile-self'
  where id = auth.uid();
call tests.logout();
select is(
  (
    select username from public.profile
    where email = 'rls.owner.profile@langquest.org'
  ),
  'rls-profile-self',
  'user can update their own profile'
);

call tests.login_as_user('rls.other.profile@langquest.org'::text);
update public.profile
  set username = 'rls-profile-hacked'
  where id = tests.profile_id('rls.owner.profile@langquest.org');
call tests.logout();
select is(
  (
    select username from public.profile
    where email = 'rls.owner.profile@langquest.org'
  ),
  'rls-profile-self',
  'other user cannot update someone else''s profile'
);

call tests.login_as_anon();
update public.profile
  set username = 'rls-profile-anon'
  where email = 'rls.owner.profile@langquest.org';
call tests.logout();
select is(
  (
    select username from public.profile
    where email = 'rls.owner.profile@langquest.org'
  ),
  'rls-profile-self',
  'anon cannot update another user''s profile'
);

call tests.login_as_user('rls.owner.profile@langquest.org'::text);
update public.profile
  set active = false
  where id = auth.uid();
call tests.logout();
select is(
  (
    select active from public.profile
    where email = 'rls.owner.profile@langquest.org'
  ),
  false,
  'user can soft-delete their own profile'
);

select * from finish();
rollback;
