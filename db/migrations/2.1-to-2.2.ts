import type { Migration } from './index';
import { getRawTableName, rawTableExists } from './utils';

/**
 * Migration: 2.1 → 2.2
 *
 * Purpose: Add content_type column to asset table to distinguish between
 * source assets, translations, and transcriptions.
 *
 * Notes:
 * - Column is defined in the Drizzle schema; PowerSync handles schema sync.
 * - Backfill existing translations (where source_asset_id IS NOT NULL) to 'translation'.
 * - New assets default to 'source'.
 * - Uses JSON-first approach: updates raw PowerSync JSON data directly.
 */
export const migration_2_1_to_2_2: Migration = {
  fromVersion: '2.1',
  toVersion: '2.2',
  description: 'Add content_type column to distinguish asset types',

  async migrate(db, onProgress) {
    console.log('[Migration 2.1→2.2] Starting content_type backfill...');

    // Preflight: Verify raw table exists
    const assetLocalRawExists = await rawTableExists(db, 'asset_local');

    if (!assetLocalRawExists) {
      console.log(
        '[Migration 2.1→2.2] No raw asset_local table found, skipping migration'
      );
      return;
    }

    if (onProgress)
      onProgress(1, 2, 'Setting default content_type for all local assets');

    // First, ensure all assets have a content_type of 'source' (the default)
    // CRITICAL: Update raw PowerSync table directly and use json_set() to update JSON data field
    // PowerSync stores data as JSON in 'data' column, not individual columns
    const assetLocalTable = getRawTableName('asset_local');
    await db.execute(`
      UPDATE ${assetLocalTable}
      SET data = json_set(
        data,
        '$.content_type',
        'source'
      )
      WHERE json_extract(data, '$.content_type') IS NULL
    `);

    console.log('[Migration 2.1→2.2] ✓ Default content_type set to "source"');

    if (onProgress)
      onProgress(2, 2, 'Backfilling content_type for translations');

    // Backfill: existing assets with source_asset_id are translations
    // CRITICAL: Update raw PowerSync table directly and use json_set() to update JSON data field
    await db.execute(`
      UPDATE ${assetLocalTable}
      SET data = json_set(
        data,
        '$.content_type',
        'translation'
      )
      WHERE json_extract(data, '$.source_asset_id') IS NOT NULL
        AND (
          json_extract(data, '$.content_type') IS NULL
          OR json_extract(data, '$.content_type') = 'source'
        )
    `);

    console.log(
      '[Migration 2.1→2.2] ✓ content_type backfilled for translations'
    );
    console.log('[Migration 2.1→2.2] ✓ Migration complete');
  }
};
