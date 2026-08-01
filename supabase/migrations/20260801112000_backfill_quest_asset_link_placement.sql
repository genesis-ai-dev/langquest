-- Path A (server-only): backfill quest_asset_link placement fields from asset.
-- Columns were added in 20260707084000_add_quest_asset_link_fields.sql.
-- Existing rows have name/metadata NULL and order_index = 0 (column default),
-- while the real values still live on public.asset.
--
-- last_updated is bumped so PowerSync re-replicates updated links to clients.
-- Idempotent: does not overwrite link values already set by newer clients.
-- No get_schema_info() bump — schema version already at 2.4 from the column add.

do $$
declare
  rows_updated integer := 0;
begin
  raise notice '[backfill_quest_asset_link_placement] Starting backfill from asset...';

  update public.quest_asset_link qal
  set
    name = coalesce(qal.name, a.name),
    order_index = case
      when qal.order_index = 0 and coalesce(a.order_index, 0) <> 0
        then a.order_index
      else qal.order_index
    end,
    metadata = coalesce(qal.metadata, a.metadata),
    last_updated = now()
  from public.asset a
  where qal.asset_id = a.id
    and (
      qal.name is null
      or qal.metadata is null
      or (qal.order_index = 0 and coalesce(a.order_index, 0) <> 0)
    );

  get diagnostics rows_updated = row_count;
  raise notice '[backfill_quest_asset_link_placement] Updated % quest_asset_link row(s)', rows_updated;
end;
$$;
