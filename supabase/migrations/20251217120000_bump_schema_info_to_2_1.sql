-- migration: bump get_schema_info to version 2.1
-- purpose:
-- - align server-reported schema version with app expectation (2.1)
-- - keep rpc simple and idempotent while allowing future metadata keys
--
-- notes:
-- - privileges are preserved when using create or replace
-- - keep search_path scoped to public to avoid accidental cross-schema references

create or replace function public.get_schema_info()
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'schema_version', '2.1',
    'notes', 'incremental update aligning server schema info with app 2.1'
  );
$$;
