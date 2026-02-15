-- Migration: Add order_index to asset_content_link
-- Version: 2.2 → 2.3
-- Purpose: Persist segment ordering within assets so that merged/reordered
--          segments maintain their intended playback sequence.

-- Add order_index column (default 0 for new single-segment assets)
alter table public.asset_content_link
  add column if not exists order_index integer not null default 0;

-- Backfill: assign sequential order_index (1-based) based on created_at within each asset
-- We use 1-based indexing so that every valid position differs from the column
-- default (0). This is important because PowerSync only includes changed columns
-- in CRUD patches — setting order_index to 0 on a record that already has 0
-- would silently omit it from the sync payload, causing reorder operations to fail.
with ranked as (
  select
    id,
    row_number() over (
      partition by asset_id
      order by created_at asc
    ) as rn
  from public.asset_content_link
)
update public.asset_content_link acl
set order_index = ranked.rn
from ranked
where acl.id = ranked.id;

-- Create composite index for efficient ordering queries
create index if not exists idx_acl_asset_order
  on public.asset_content_link (asset_id, order_index);

comment on column public.asset_content_link.order_index is
  'Defines playback/display order of segments within an asset. Lower values appear first. 1-based (0 = unset). Default is 0.';

-- Auto-assign order_index on INSERT when the value is 0 (unset/default).
-- This handles uploads from older app versions that don't include order_index
-- in their records. Without this, all content links from old clients would get
-- order_index = 0, breaking order-dependent features like audio export.
-- The trigger queries the current max order_index for the asset and assigns
-- the next sequential value (1-based).
create or replace function public.auto_assign_acl_order_index()
returns trigger
language plpgsql
as $$
begin
  if new.order_index = 0 then
    -- Assign order_index based on chronological position among all content
    -- links for this asset (including the new row). Count how many existing
    -- content links have an earlier created_at — that determines the position.
    new.order_index := (
      select count(*) + 1
      from public.asset_content_link
      where asset_id = new.asset_id
        and created_at < new.created_at
        and order_index > 0
    );

    -- Shift any existing content links at or above this position up by 1
    -- to make room for the newly inserted row.
    update public.asset_content_link
    set order_index = order_index + 1
    where asset_id = new.asset_id
      and order_index >= new.order_index
      and id != new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_auto_acl_order_index on public.asset_content_link;

create trigger trg_auto_acl_order_index
  before insert on public.asset_content_link
  for each row
  execute function public.auto_assign_acl_order_index();

-- Bump schema_version to 2.3, keep min_required at 2.1
create or replace function public.get_schema_info()
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'schema_version', '2.3',
    'min_required_schema_version', '2.1',
    'notes', 'Clients must be at least version 2.1 to sync. Added order_index to asset_content_link for segment ordering.'
  );
$$;
