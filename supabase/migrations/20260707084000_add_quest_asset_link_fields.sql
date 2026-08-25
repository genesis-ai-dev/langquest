-- Add asset-placement fields to quest_asset_link.
-- These mirror public.asset:
--   asset.name        text
--   asset.order_index integer not null default 0
--   asset.metadata    text
alter table public.quest_asset_link
  add column if not exists name text,
  add column if not exists order_index integer not null default 0,
  add column if not exists metadata text;

comment on column public.quest_asset_link.name is
'Display name for an asset within a quest.';
comment on column public.quest_asset_link.order_index is
'Defines the display order of assets within a quest.';
comment on column public.quest_asset_link.metadata is
'JSON metadata for an asset within a quest';

create or replace function public.get_schema_info()
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'schema_version', '2.4',
    'min_required_schema_version', '2.1',
    'notes', 'Clients must be at least version 2.1 to sync. Version 2.4 adds quest_asset_link name, order_index, and metadata.'
  );
$$;