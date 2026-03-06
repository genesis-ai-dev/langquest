-- Migration: Fix order_index trigger to handle NULL from old client uploads
-- Purpose: Old app versions upload asset_content_link records without order_index.
--          The DML function passes NULL for missing JSON keys rather than using
--          the column default, violating the NOT NULL constraint. This updates
--          the trigger to catch NULL in addition to 0.

create or replace function public.auto_assign_acl_order_index()
returns trigger
language plpgsql
as $$
begin
  if new.order_index is null or new.order_index = 0 then
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
