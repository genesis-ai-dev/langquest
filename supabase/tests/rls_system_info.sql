begin;

select plan(10);

\ir rls_session.pgsql

do $$
begin
  perform tests.seed_user('rls.reader.systeminfo@langquest.org');
end;
$$;

call tests.login_as_anon();
select isnt_empty(
  $$select id from public.system_info where id = 1$$,
  'anon can select system_info'
);
select throws_ok(
  $$insert into public.system_info (
      id, ios_latest_version, android_latest_version
    ) values (1, '9.9.9', '9.9.9')$$,
  '42501',
  null,
  'anon cannot insert system_info'
);
update public.system_info set banner_enabled = false where id = 1;
delete from public.system_info where id = 1;
select is(
  public.get_schema_info()->>'schema_version',
  '2.6',
  'anon can read get_schema_info schema_version 2.6'
);
call tests.logout();
select is(
  (select banner_enabled from public.system_info where id = 1),
  true,
  'anon update does not change system_info'
);
select isnt_empty(
  $$select id from public.system_info where id = 1$$,
  'anon delete does not remove system_info'
);

call tests.login_as_user('rls.reader.systeminfo@langquest.org'::text);
select isnt_empty(
  $$select id from public.system_info where id = 1$$,
  'authenticated user can select system_info'
);
select throws_ok(
  $$insert into public.system_info (
      id, ios_latest_version, android_latest_version
    ) values (1, '9.9.9', '9.9.9')$$,
  '42501',
  null,
  'authenticated user cannot insert system_info'
);
update public.system_info set banner_enabled = false where id = 1;
delete from public.system_info where id = 1;
call tests.logout();
select is(
  (select banner_enabled from public.system_info where id = 1),
  true,
  'authenticated user update does not change system_info'
);
select isnt_empty(
  $$select id from public.system_info where id = 1$$,
  'authenticated user delete does not remove system_info'
);

grant service_role to postgres;
set role service_role;
update public.system_info set ios_latest_version = '9.9.9' where id = 1;
reset role;
select is(
  (select ios_latest_version from public.system_info where id = 1),
  '9.9.9',
  'service_role can update system_info'
);

select * from finish();
rollback;
