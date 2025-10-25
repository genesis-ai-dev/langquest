-- Migration: Add RPC to fetch current schema information
-- Purpose:
-- - Provide a simple way for clients/tools to fetch server-side schema metadata
-- - Returns JSON with at least `schema_version`, leaving room for future keys
--
-- Notes:
-- - This function is intentionally simple and can be extended later
-- - If you later centralize schema metadata in a table, update this RPC to read from there

create or replace function public.get_schema_info()
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'schema_version', '1.0',
    'notes', null
  );
$$;

grant execute on function public.get_schema_info() to anon, authenticated;


