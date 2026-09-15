-- Path A (server-only): store versions now live in public.system_info.
-- Restore schema_version to 2.5 (overwritten by 20260830180000) and drop latest_app_version.
-- Does NOT bump APP_SCHEMA_VERSION.

create or replace function public.get_schema_info()
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'schema_version', '2.5',
    'min_required_schema_version', '2.1',
    'notes', 'Clients must be at least version 2.1 to sync. Version 2.5 adds asset_content_link.audio_uploaded_at. Store update banner reads public.system_info.'
  );
$$;
