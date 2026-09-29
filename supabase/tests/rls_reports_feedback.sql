begin;

select plan(8);

\ir rls_session.pgsql

-- Insert trigger POSTs to an edge function; skip it so these cases measure RLS.
alter table public.feedback disable trigger feedback_webhook_trigger;

do $$
begin
  perform tests.seed_user('rls.owner.feedback@langquest.org');
  perform tests.seed_user('rls.other.feedback@langquest.org');
end;
$$;

call tests.login_as_user('rls.owner.feedback@langquest.org'::text);
select lives_ok(
  $$insert into public.feedback (
      profile_id, title, request_type, description
    ) values (
      auth.uid(), 'rls-own-feedback', 'general', 'owner body'
    )$$,
  'authenticated user can insert their own feedback'
);
select lives_ok(
  $$insert into public.reports (
      record_id, record_table, reporter_id, reason, details
    ) values (
      gen_random_uuid(), 'project', auth.uid(), 'spam', 'rls-own-report'
    )$$,
  'authenticated user can insert a report as themselves'
);
call tests.logout();

call tests.login_as_user('rls.other.feedback@langquest.org'::text);
select throws_ok(
  $$insert into public.feedback (
      profile_id, title, request_type, description
    )
    select tests.profile_id('rls.owner.feedback@langquest.org'),
      'rls-forged-feedback', 'bug', 'forged'
$$,
  '42501',
  null,
  'user cannot insert feedback as someone else'
);
select throws_ok(
  $$insert into public.reports (
      record_id, record_table, reporter_id, reason, details
    )
    select gen_random_uuid(), 'project',
      tests.profile_id('rls.owner.feedback@langquest.org'),
      'spam', 'forged'
$$,
  '42501',
  null,
  'user cannot insert a report as someone else'
);
select is(
  (
    select count(*)::int from public.feedback
    where title = 'rls-own-feedback'
  ),
  0,
  'other user cannot select someone else''s feedback'
);
call tests.logout();

call tests.login_as_anon();
select throws_ok(
  $$insert into public.feedback (
      profile_id, title, request_type, description
    )
    select tests.profile_id('rls.owner.feedback@langquest.org'),
      'rls-anon-feedback', 'general', 'anon'
$$,
  '42501',
  null,
  'anon cannot insert feedback'
);
select throws_ok(
  $$insert into public.reports (
      record_id, record_table, reporter_id, reason, details
    )
    select gen_random_uuid(), 'project',
      tests.profile_id('rls.owner.feedback@langquest.org'),
      'spam', 'anon'
$$,
  '42501',
  null,
  'anon cannot insert a report'
);
select isnt(
  (
    select id from public.reports
    where details = 'rls-own-report'
    limit 1
  ),
  null,
  'anon can select reports (open SELECT policy)'
);
call tests.logout();

select * from finish();
rollback;
