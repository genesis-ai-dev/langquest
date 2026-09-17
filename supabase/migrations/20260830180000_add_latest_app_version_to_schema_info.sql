-- Path A (server-only): add latest_app_version for optional store-update banner.
-- Does NOT bump schema_version or min_required_schema_version.
-- Update latest_app_version when a new build is published to the App Store / Play Store.

create or replace function public.get_schema_info()
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'schema_version', '2.3',
    'min_required_schema_version', '2.1',
    'latest_app_version', '2.2.6',
    'notes', 'Clients must be at least version 2.1 to sync. latest_app_version drives the optional store-update banner.'
  );
$$;
