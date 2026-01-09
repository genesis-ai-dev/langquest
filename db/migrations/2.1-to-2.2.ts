import { sql } from 'drizzle-orm';
import type { Migration } from './index';

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
 */
export const migration_2_1_to_2_2: Migration = {
  fromVersion: '2.1',
  toVersion: '2.2',
  description: 'Add content_type column to distinguish asset types',

  async migrate(db, onProgress) {
    if (onProgress)
      onProgress(1, 2, 'Setting default content_type for all local assets');

    // First, ensure all assets have a content_type of 'source' (the default)
    await db.run(sql`
      UPDATE asset_local
      SET content_type = 'source'
      WHERE content_type IS NULL
    `);

    if (onProgress)
      onProgress(2, 2, 'Backfilling content_type for translations');

    // Backfill: existing assets with source_asset_id are translations
    await db.run(sql`
      UPDATE asset_local
      SET content_type = 'translation'
      WHERE source_asset_id IS NOT NULL
        AND content_type = 'source'
    `);
  }
};
