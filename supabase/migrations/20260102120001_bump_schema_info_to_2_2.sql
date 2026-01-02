-- migration: bump get_schema_info to version 2.2
-- purpose:
-- - align server-reported schema version with app expectation (2.2)
-- - reflects addition of content_type column to asset table

create or replace function public.get_schema_info()
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'schema_version', '2.2',
    'notes', 'added content_type enum to asset table'
  );
$$;
