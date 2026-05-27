-- Revert get_schema_info to 2.3 / min 2.1 (matches APP_SCHEMA_VERSION in db/constants.ts).
-- Supersedes the 2.5 / min 2.4 bump in 20260529120000_rename_project_language_suggestion_to_languoid.sql.

create or replace function public.get_schema_info()
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'schema_version', '2.3',
    'min_required_schema_version', '2.1',
    'notes', 'Clients must be at least version 2.1 to sync. Schema info reverted to 2.3 for current app builds.'
  );
$$;
