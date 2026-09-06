-- Path A (server-only): operational client config, independent of schema_version.
-- Update ios/android latest versions only after the build is live in that store.
-- Intentionally not added to the PowerSync publication.

create table public.system_info (
  id smallint primary key default 1 check (id = 1),

  ios_latest_version text not null,
  android_latest_version text not null,
  ios_min_version text,
  android_min_version text,

  ios_store_url text,
  android_store_url text,

  banner_enabled boolean not null default true,

  updated_at timestamptz not null default now()
);

comment on table public.system_info is
  'Singleton operational config. Store versions are updated after App Store / Play Store publish, not on merge.';

comment on column public.system_info.ios_latest_version is
  'Latest iOS version already live on the App Store. Drives the optional store-update banner.';
comment on column public.system_info.android_latest_version is
  'Latest Android version already live on the Play Store. Drives the optional store-update banner.';
comment on column public.system_info.ios_min_version is
  'Optional minimum iOS version. Null means no store-version force upgrade.';
comment on column public.system_info.android_min_version is
  'Optional minimum Android version. Null means no store-version force upgrade.';
comment on column public.system_info.ios_store_url is
  'Optional App Store URL override.';
comment on column public.system_info.android_store_url is
  'Optional Play Store URL override.';
comment on column public.system_info.banner_enabled is
  'When false, the store-update banner stays hidden even if a newer store version exists.';

create or replace function public._system_info_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger system_info_set_updated_at
before update on public.system_info
for each row
execute function public._system_info_set_updated_at();

insert into public.system_info (
  id,
  ios_latest_version,
  android_latest_version,
  ios_store_url,
  android_store_url
) values (
  1,
  '2.2.6',
  '2.2.6',
  'https://apps.apple.com/app/6752446665',
  'https://play.google.com/store/apps/details?id=com.etengenesis.langquest'
);

alter table public.system_info enable row level security;

create policy "Anyone can read system info"
  on public.system_info
  for select
  to anon, authenticated
  using (true);

grant select on table public.system_info to anon, authenticated;
grant select, insert, update on table public.system_info to service_role;
