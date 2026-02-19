import type { Migration } from './index';
import { getRawTableName, rawTableExists } from './utils';

/**
 * Migration: 2.2 → 2.3
 *
 * Purpose: Add order_index column to asset_content_link_local table to persist
 * segment ordering within assets. Without this, segment order relies on
 * created_at timestamps which are lost during merge operations.
 *
 * Notes:
 * - Column is defined in the Drizzle schema; PowerSync handles schema sync for synced tables.
 * - Backfills existing rows using created_at ordering within each asset_id.
 * - New content links default to order_index 0 (unset). Backfill uses 1-based indexing.
 * - Uses JSON-first approach: updates raw PowerSync JSON data directly.
 */
export const migration_2_2_to_2_3: Migration = {
  fromVersion: '2.2',
  toVersion: '2.3',
  description: 'Add order_index to asset_content_link for segment ordering',

  async migrate(db, onProgress) {
    console.log(
      '[Migration 2.2→2.3] Starting order_index backfill for asset_content_link_local...'
    );

    // Preflight: Verify raw table exists
    const aclLocalRawExists = await rawTableExists(
      db,
      'asset_content_link_local'
    );

    if (!aclLocalRawExists) {
      console.log(
        '[Migration 2.2→2.3] No raw asset_content_link_local table found, skipping migration'
      );
      return;
    }

    if (onProgress)
      onProgress(
        1,
        2,
        'Setting default order_index for all local content links'
      );

    // Step 1: Set default order_index = 0 for all rows that don't have it
    const aclLocalTable = getRawTableName('asset_content_link_local');
    await db.execute(`
      UPDATE ${aclLocalTable}
      SET data = json_set(
        data,
        '$.order_index',
        0
      )
      WHERE json_extract(data, '$.order_index') IS NULL
    `);

    console.log(
      '[Migration 2.2→2.3] ✓ Default order_index set to 0 for all rows'
    );

    if (onProgress)
      onProgress(2, 2, 'Backfilling order_index based on created_at ordering');

    // Step 2: Backfill sequential order_index (1-based) within each asset_id
    // Uses 1-based indexing so every valid position differs from the column
    // default (0). This ensures PowerSync always includes order_index in CRUD
    // patches when reordering, since 0→0 would be a no-op.
    await db.execute(`
      WITH ranked AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY json_extract(data, '$.asset_id')
            ORDER BY json_extract(data, '$.created_at') ASC
          ) AS rn
        FROM ${aclLocalTable}
      )
      UPDATE ${aclLocalTable}
      SET data = json_set(
        data,
        '$.order_index',
        ranked.rn
      )
      FROM ranked
      WHERE ${aclLocalTable}.id = ranked.id
    `);

    console.log(
      '[Migration 2.2→2.3] ✓ order_index backfilled based on created_at ordering'
    );
    console.log('[Migration 2.2→2.3] ✓ Migration complete');
  }
};
