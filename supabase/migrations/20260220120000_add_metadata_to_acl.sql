-- Migration: Add metadata column to asset_content_link
-- Version: 2.3 → 2.4
-- Purpose: Store per-segment metadata (initially trim points) as JSON.
--          This supports per-content-link audio trimming rather than per-asset,
--          which is necessary for merged assets where each segment has independent
--          trim bounds.
-- Affected table: asset_content_link
-- Backwards compatible: yes (nullable column, old clients ignore it)

-- Add nullable metadata column for per-segment JSON metadata
alter table public.asset_content_link
  add column if not exists metadata text;

comment on column public.asset_content_link.metadata is
  'JSON metadata for per-segment properties. Currently stores trim points as {"trim":{"startMs":number,"endMs":number}}. Extensible for future per-segment metadata.';

-- Bump schema_version to 2.4, keep min_required at 2.1
create or replace function public.get_schema_info()
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'schema_version', '2.4',
    'min_required_schema_version', '2.1',
    'notes', 'Clients must be at least version 2.1 to sync. Added metadata column to asset_content_link for per-segment trim points.'
  );
$$;
