-- Migration: Add legal consent and analytics preference columns to profile
-- Path A — nullable columns; synced via PowerSync schemaless JSON, no schema version bump.

alter table public.profile
  add column if not exists privacy_policy_version text,
  add column if not exists analytics_opt_in boolean,
  add column if not exists analytics_consent_at timestamptz;

comment on column public.profile.privacy_policy_version is
  'Slug of the privacy policy version the user accepted (e.g. 2026-07-08). Matches langquest.org/privacy archive slugs.';

comment on column public.profile.analytics_opt_in is
  'Explicit analytics opt-in (true), opt-out (false), or null if the user has not chosen yet.';

comment on column public.profile.analytics_consent_at is
  'Timestamp of the user''s most recent explicit analytics preference choice.';

-- Copy privacy_policy_version from auth metadata when profiles are created on signup.
create or replace function handle_new_user_signup()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  if new.email_confirmed_at is not null
     and (new.is_anonymous is false or new.is_anonymous is null)
  then
    insert into public.profile (
      id,
      email,
      username,
      ui_language_id,
      terms_accepted,
      terms_accepted_at,
      privacy_policy_version
    )
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data ->> 'username', 'user_' || substr(new.id::text, 1, 8)),
      case
        when uuid(new.raw_user_meta_data ->> 'ui_language_id') is not null
        then (new.raw_user_meta_data ->> 'ui_language_id')::uuid
        else null
      end,
      coalesce((new.raw_user_meta_data ->> 'terms_accepted')::boolean, false),
      (new.raw_user_meta_data ->> 'terms_accepted_at')::timestamptz,
      new.raw_user_meta_data ->> 'privacy_policy_version'
    )
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

create or replace function handle_user_conversion()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  if new.is_anonymous = false
     and new.email_confirmed_at is not null
     and old.email_confirmed_at is null
  then
    insert into public.profile (
      id,
      email,
      username,
      ui_language_id,
      terms_accepted,
      terms_accepted_at,
      privacy_policy_version
    )
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data ->> 'username', 'user_' || substr(new.id::text, 1, 8)),
      case
        when uuid(new.raw_user_meta_data ->> 'ui_language_id') is not null
        then (new.raw_user_meta_data ->> 'ui_language_id')::uuid
        else null
      end,
      coalesce((new.raw_user_meta_data ->> 'terms_accepted')::boolean, false),
      (new.raw_user_meta_data ->> 'terms_accepted_at')::timestamptz,
      new.raw_user_meta_data ->> 'privacy_policy_version'
    )
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;
