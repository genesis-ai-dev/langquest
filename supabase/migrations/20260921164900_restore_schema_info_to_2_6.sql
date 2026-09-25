-- Path A (server-only): 20260915140000 restored get_schema_info to 2.5, which
-- was correct on dev. This branch already bumped to 2.6 in
-- 20260904000000_quest_published_at.sql. Re-apply 2.6 so the last replacement
-- matches APP_SCHEMA_VERSION. Does NOT bump APP_SCHEMA_VERSION.

create or replace function public.get_schema_info()
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'schema_version', '2.6',
    'min_required_schema_version', '2.1',
    'notes', 'Clients must be at least version 2.1 to sync. Version 2.6 adds quest.published_at (unpublished drafts stay private to the creator). Store update banner reads public.system_info.'
  );
$$;
