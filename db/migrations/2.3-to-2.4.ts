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
 * - Existing local quest links inherit values from their linked local asset.
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

    if (onProgress) {
      onProgress(1, 2, 'Setting defaults on local quest asset links');
    }

    await db.execute(`
      UPDATE ${questAssetLinkTable}
      SET data = json_set(
        data,
        '$.order_index',
        coalesce(json_extract(data, '$.order_index'), 0)
      )
      WHERE json_extract(data, '$.order_index') IS NULL
    `);

    console.log(
      '[Migration 2.3->2.4] ✓ Default order_index set on quest_asset_link_local'
    );

    const assetLocalExists = await rawTableExists(db, 'asset_local');

    if (!assetLocalExists) {
      console.log(
        '[Migration 2.3->2.4] No raw asset_local table found, skipping asset backfill'
      );
      return;
    }

    if (onProgress) {
      onProgress(2, 2, 'Backfilling quest asset link fields from local assets');
    }

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
        coalesce(
          json_extract(data, '$.order_index'),
          (
            SELECT json_extract(a.data, '$.order_index')
            FROM ${assetTable} a
            WHERE a.id = json_extract(${questAssetLinkTable}.data, '$.asset_id')
            LIMIT 1
          ),
          0
        ),
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
         OR json_extract(data, '$.order_index') IS NULL
         OR json_extract(data, '$.metadata') IS NULL
    `);

    console.log(
      '[Migration 2.3->2.4] ✓ quest_asset_link_local placement fields backfilled'
    );
    console.log('[Migration 2.3->2.4] ✓ Migration complete');
  }
};
