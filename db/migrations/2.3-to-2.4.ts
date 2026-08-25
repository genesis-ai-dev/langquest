import type { Migration } from './index';
import { getRawTableName, rawTableExists } from './utils';

/**
 * Migration: 2.3 -> 2.4
 *
 * Purpose: Backfill quest-specific asset placement fields on
 * quest_asset_link_local after moving display name, order_index, and metadata
 * from asset to quest_asset_link.
 *
 * Notes:
 * - These columns are defined in the Drizzle schema; do not ALTER TABLE.
 * - PowerSync stores local rows as JSON in raw ps_data_local__* tables.
 * - order_index: copy from asset when link is NULL/0 and asset has a non-zero
 *   order (matches server backfill_quest_asset_link_placement).
 */
export const migration_2_3_to_2_4: Migration = {
  fromVersion: '2.3',
  toVersion: '2.4',
  description: 'Backfill quest_asset_link local asset placement fields',

  async migrate(db, onProgress) {
    console.log(
      '[Migration 2.3->2.4] Starting quest_asset_link_local placement backfill...'
    );

    const questAssetLinkExists = await rawTableExists(
      db,
      'quest_asset_link_local'
    );

    if (!questAssetLinkExists) {
      console.log(
        '[Migration 2.3->2.4] No raw quest_asset_link_local table found, skipping migration'
      );
      return;
    }

    const questAssetLinkTable = getRawTableName('quest_asset_link_local');
    const assetTable = getRawTableName('asset_local');

    const assetLocalExists = await rawTableExists(db, 'asset_local');

    if (!assetLocalExists) {
      console.log(
        '[Migration 2.3->2.4] No raw asset_local table found, skipping asset backfill'
      );
      return;
    }

    if (onProgress) {
      onProgress(1, 1, 'Backfilling quest asset link fields from local assets');
    }

    // order_index logic mirrors public.backfill_quest_asset_link_placement:
    // replace legacy default 0 on the link when the linked asset has a real order.
    await db.execute(`
      UPDATE ${questAssetLinkTable}
      SET data = json_set(
        data,
        '$.name',
        coalesce(
          json_extract(data, '$.name'),
          (
            SELECT json_extract(a.data, '$.name')
            FROM ${assetTable} a
            WHERE a.id = json_extract(${questAssetLinkTable}.data, '$.asset_id')
            LIMIT 1
          )
        ),
        '$.order_index',
        CASE
          WHEN coalesce(json_extract(data, '$.order_index'), 0) = 0
            AND coalesce(
              (
                SELECT json_extract(a.data, '$.order_index')
                FROM ${assetTable} a
                WHERE a.id = json_extract(${questAssetLinkTable}.data, '$.asset_id')
                LIMIT 1
              ),
              0
            ) <> 0
          THEN (
            SELECT json_extract(a.data, '$.order_index')
            FROM ${assetTable} a
            WHERE a.id = json_extract(${questAssetLinkTable}.data, '$.asset_id')
            LIMIT 1
          )
          ELSE coalesce(
            json_extract(data, '$.order_index'),
            (
              SELECT json_extract(a.data, '$.order_index')
              FROM ${assetTable} a
              WHERE a.id = json_extract(${questAssetLinkTable}.data, '$.asset_id')
              LIMIT 1
            ),
            0
          )
        END,
        '$.metadata',
        coalesce(
          json_extract(data, '$.metadata'),
          (
            SELECT json_extract(a.data, '$.metadata')
            FROM ${assetTable} a
            WHERE a.id = json_extract(${questAssetLinkTable}.data, '$.asset_id')
            LIMIT 1
          )
        )
      )
      WHERE json_extract(data, '$.name') IS NULL
         OR json_extract(data, '$.metadata') IS NULL
         OR json_extract(data, '$.order_index') IS NULL
         OR (
           coalesce(json_extract(data, '$.order_index'), 0) = 0
           AND EXISTS (
             SELECT 1
             FROM ${assetTable} a
             WHERE a.id = json_extract(${questAssetLinkTable}.data, '$.asset_id')
               AND coalesce(json_extract(a.data, '$.order_index'), 0) <> 0
           )
         )
    `);

    console.log(
      '[Migration 2.3->2.4] ✓ quest_asset_link_local placement fields backfilled'
    );
    console.log('[Migration 2.3->2.4] ✓ Migration complete');
  }
};
