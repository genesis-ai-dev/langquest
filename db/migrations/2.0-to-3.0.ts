/**
 * Migration: 2.0 → 3.0
 *
 * PURPOSE: Add submission_type field to asset table (BREAKING CHANGE)
 *
 * This migration adds the submission_type column to asset_local tables.
 * The column is already defined in the Drizzle schema, but existing tables
 * need the column added.
 *
 * Changes:
 * 1. Add submission_type column to asset_local table (nullable)
 * 2. Set 'translation' only for assets with source_asset_id (translations/transcriptions)
 * 3. Leave NULL for source assets (assets without source_asset_id)
 *
 * NOTE: This is a BREAKING CHANGE (major version bump).
 * The constraint requires submission_type to be set for assets with source_asset_id,
 * so v2.0 clients uploading without submission_type will fail.
 * Server-side transform function v2_to_v3 handles this.
 */

import { sql } from 'drizzle-orm';
import type { Migration } from './index';
import { addColumn, columnExists } from './utils';

export const migration_2_0_to_3_0: Migration = {
  fromVersion: '2.0',
  toVersion: '3.0',
  description: 'Add submission_type to asset_local table (breaking change)',

  async migrate(db, onProgress) {
    console.log('[Migration 2.0→3.0] Starting submission_type migration...');

    // Step 1: Add submission_type column to asset_local if it doesn't exist
    // Check if column already exists (idempotent migration)
    if (onProgress) onProgress(1, 2, 'Adding submission_type column');

    const columnAlreadyExists = await columnExists(
      db,
      'asset_local',
      'submission_type'
    );

    if (!columnAlreadyExists) {
      console.log(
        '[Migration 2.0→3.0] Adding submission_type column to asset_local...'
      );
      // Made nullable - NULL for source assets, 'translation'/'transcription' for translations/transcriptions
      await addColumn(db, 'asset_local', 'submission_type TEXT');
      console.log('[Migration 2.0→3.0] ✓ Column added');
    } else {
      console.log('[Migration 2.0→3.0] Column already exists, skipping');
    }

    // Step 2: Set 'translation' only for assets that have source_asset_id
    // (i.e., translations/transcriptions). Source assets remain NULL.
    if (onProgress) onProgress(2, 2, 'Setting default values for translations');

    try {
      await db.run(
        sql`UPDATE asset_local SET submission_type = 'translation' WHERE (submission_type IS NULL OR submission_type = '') AND source_asset_id IS NOT NULL`
      );
      console.log('[Migration 2.0→3.0] ✓ Default values set for translations');
    } catch (error) {
      // Column might not exist yet or might be in a different state
      console.log(
        '[Migration 2.0→3.0] Note: Could not update default values:',
        error
      );
    }

    console.log('[Migration 2.0→3.0] ✓ Migration complete');
  }
};
