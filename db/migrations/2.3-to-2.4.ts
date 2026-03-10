import type { Migration } from './index';
import { getRawTableName, rawTableExists } from './utils';

/**
 * Migration: 2.3 → 2.4
 *
 * Purpose: Add metadata field to asset_content_link_local for per-segment
 * properties (initially trim points). Since metadata is a nullable column with
 * no default, existing rows just need the key set to null in the raw JSON so
 * PowerSync includes it in view projections.
 *
 * Notes:
 * - Column is defined in the Drizzle schema; PowerSync handles schema sync for synced tables.
 * - Uses JSON-first approach: updates raw PowerSync JSON data directly.
 * - Rows that already have a metadata key are left untouched.
 */
export const migration_2_3_to_2_4: Migration = {
  fromVersion: '2.3',
  toVersion: '2.4',
  description: 'Add metadata to asset_content_link for per-segment trim',

  async migrate(db, onProgress) {
    console.log(
      '[Migration 2.3→2.4] Starting metadata field addition for asset_content_link_local...'
    );

    const aclLocalRawExists = await rawTableExists(
      db,
      'asset_content_link_local'
    );

    if (!aclLocalRawExists) {
      console.log(
        '[Migration 2.3→2.4] No raw asset_content_link_local table found, skipping migration'
      );
      return;
    }

    if (onProgress)
      onProgress(1, 1, 'Setting metadata to null for existing content links');

    const aclLocalTable = getRawTableName('asset_content_link_local');
    await db.execute(`
      UPDATE ${aclLocalTable}
      SET data = json_set(data, '$.metadata', null)
      WHERE json_extract(data, '$.metadata') IS NULL
    `);

    console.log(
      '[Migration 2.3→2.4] ✓ metadata field initialized on all local content links'
    );
    console.log('[Migration 2.3→2.4] ✓ Migration complete');
  }
};
