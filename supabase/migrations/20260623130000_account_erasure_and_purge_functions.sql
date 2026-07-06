-- Migration: Erasure suppression records and server-side purge helpers (LQ-49 C3/C8)
-- Service-role only. Not synced to PowerSync.

create table if not exists public.account_erasure (
  auth_user_id uuid primary key,
  email_hash text not null,
  consent_snapshot jsonb not null default '{}'::jsonb,
  erasure_source text not null default 'scheduled_purge',
  erased_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.account_erasure is
  'Minimal post-purge record for restore suppression and DSR confirm-only replies. Service-role only; never synced to clients.';

comment on column public.account_erasure.email_hash is
  'HMAC-SHA256 of normalized email. Used to confirm erasure after purge without storing plaintext email.';

comment on column public.account_erasure.consent_snapshot is
  'Profile consent fields captured at purge time (privacy_policy_version, analytics_opt_in, etc.).';

alter table public.account_erasure enable row level security;

grant select, insert, update, delete on table public.account_erasure to service_role;

-- NULL creator attribution and scrub download_profiles arrays before auth delete.
create or replace function public.purge_user_identity_data(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table text;
  v_creator_tables text[] := array[
    'translation',
    'asset',
    'quest',
    'project',
    'vote',
    'asset_vote',
    'language',
    'languoid',
    'region'
  ];
  v_feedback_deleted integer := 0;
  v_consent jsonb;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  select jsonb_build_object(
    'privacy_policy_version', privacy_policy_version,
    'terms_accepted', terms_accepted,
    'terms_accepted_at', terms_accepted_at,
    'analytics_opt_in', analytics_opt_in,
    'analytics_consent_at', analytics_consent_at,
    'deletion_requested_at', deletion_requested_at,
    'deletion_scheduled_for', deletion_scheduled_for
  )
  into v_consent
  from public.profile
  where id = p_user_id;

  if v_consent is null then
    raise exception 'Profile not found for purge: %', p_user_id;
  end if;

  foreach v_table in array v_creator_tables loop
    execute format(
      'update public.%I set creator_id = null where creator_id = $1',
      v_table
    )
    using p_user_id;
  end loop;

  for v_table in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema
     and t.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'download_profiles'
      and c.udt_name = '_uuid'
      and t.table_type = 'BASE TABLE'
  loop
    execute format(
      'update public.%I
       set download_profiles = array_remove(download_profiles, $1)
       where download_profiles @> array[$1]::uuid[]',
      v_table
    )
    using p_user_id;
  end loop;

  delete from public.feedback
  where profile_id = p_user_id;

  get diagnostics v_feedback_deleted = row_count;

  return jsonb_build_object(
    'consent_snapshot', coalesce(v_consent, '{}'::jsonb),
    'feedback_deleted', v_feedback_deleted
  );
end;
$$;

revoke all on function public.purge_user_identity_data(uuid) from public;
grant execute on function public.purge_user_identity_data(uuid) to service_role;

-- Claim profiles due for purge. Never selects active=false without deletion_requested_at.
create or replace function public.claim_profiles_for_purge(p_limit integer default 10)
returns table (
  profile_id uuid,
  email text,
  deletion_requested_at timestamptz,
  deletion_scheduled_for timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    p.id,
    p.email,
    p.deletion_requested_at,
    p.deletion_scheduled_for
  from public.profile p
  where (
    (
      p.deletion_requested_at is not null
      and p.deletion_scheduled_for is not null
      and p.deletion_scheduled_for <= now()
      and not exists (
        select 1
        from public.account_erasure aer
        where aer.auth_user_id = p.id
      )
    )
    or exists (
      select 1
      from public.account_erasure aer
      where aer.auth_user_id = p.id
    )
  )
  order by p.deletion_scheduled_for nulls last
  limit greatest(1, least(coalesce(p_limit, 10), 50));
end;
$$;

revoke all on function public.claim_profiles_for_purge(integer) from public;
grant execute on function public.claim_profiles_for_purge(integer) to service_role;
