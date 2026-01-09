-- Migration: Add min_required_schema_version to get_schema_info
-- Purpose: Allow DB migrations to be deployed before app updates are approved
--          Old apps below minimum version are blocked, preventing DB corruption
--          while maintaining backwards compatibility for minor updates
--
-- Notes:
-- - min_required_schema_version: Minimum client schema version required to sync
-- - schema_version: Current server schema version (for reference)
-- - If min_required_schema_version is not set, falls back to exact match behavior
-- - Minor schema updates maintain backwards compatibility, so old apps can work
--   with newer DB schemas up to the minimum version

create or replace function public.get_schema_info()
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'schema_version', '2.2',  -- Current server schema version
    'min_required_schema_version', '2.1',  -- Minimum client version required
    'notes', 'Clients must be at least version 2.1 to sync. Minor updates maintain backwards compatibility.'
  );
$$;
