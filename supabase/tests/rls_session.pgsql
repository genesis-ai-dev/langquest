-- Session helpers for pgTAP. Loaded with \ir from each rls_*.sql file.
-- Not a test: pg_prove only runs *.sql.

create schema if not exists tests;

grant anon, authenticated to postgres;
grant usage on schema tests to anon, authenticated;

create or replace procedure tests.login_as_user(user_email text)
language plpgsql
as $$
declare
  auth_user auth.users;
begin
  select * into strict auth_user from auth.users where email = user_email;
  execute format('set request.jwt.claim.sub=%L', auth_user.id::text);
  execute format('set request.jwt.claim.role=%I', auth_user.role);
  execute format('set request.jwt.claim.email=%L', auth_user.email);
  execute format(
    'set request.jwt.claims=%L',
    json_strip_nulls(
      json_build_object('app_metadata', auth_user.raw_app_meta_data)
    )::text
  );
  execute format('set role %I', auth_user.role);
end;
$$;

create or replace procedure tests.login_as_anon()
language plpgsql
as $$
begin
  set request.jwt.claim.sub = '';
  set request.jwt.claim.role = '';
  set request.jwt.claim.email = '';
  set request.jwt.claims = '';
  set role anon;
end;
$$;

create or replace procedure tests.logout()
language plpgsql
as $$
begin
  -- Session user stays postgres; RESET ROLE returns there after SET ROLE.
  reset role;
  set request.jwt.claim.sub = '';
  set request.jwt.claim.role = '';
  set request.jwt.claim.email = '';
  set request.jwt.claims = '';
end;
$$;

create or replace function tests.profile_id(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.profile where email = p_email;
$$;

grant execute on procedure tests.login_as_user(text) to anon, authenticated;
grant execute on procedure tests.login_as_anon() to anon, authenticated;
grant execute on procedure tests.logout() to anon, authenticated;
grant execute on function tests.profile_id(text) to anon, authenticated;

create or replace function tests.seed_user(p_email text)
returns uuid
language plpgsql
as $$
declare
  uid uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token,
    is_anonymous
  ) values (
    '00000000-0000-0000-0000-000000000000',
    uid,
    'authenticated',
    'authenticated',
    p_email,
    '$2a$10$H3qz0ZlszHLwg0/8tT3P2eL1bDb9YakwsMbyIkFcgZd8/DCd8fcbi',
    now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object(
      'username', split_part(p_email, '@', 1),
      'terms_accepted', true,
      'terms_accepted_at', now()::text
    ),
    now(),
    now(),
    '',
    '',
    '',
    '',
    false
  );
  return uid;
end;
$$;
