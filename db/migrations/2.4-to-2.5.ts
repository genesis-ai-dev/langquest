import type { Migration } from './index';

/**
 * Migration: 2.4 -> 2.5
 *
 * Purpose: Version bump only. 2.5 adds asset_content_link.audio_uploaded_at
 * (server-confirmed audio upload time, read by the audio sync workers).
 *
 * No data transformation is needed:
 * - PowerSync stores local rows as JSON; the new column is just a view
 *   projection, and existing rows read NULL — which is the correct value
 *   ("audio not confirmed uploaded").
 * - Clients never write the column (stripped in SupabaseConnector, rejected
 *   by server guard triggers), so there is nothing to backfill.
 *
 * This file exists because findMigrationPath() requires a registered
 * migration for every version hop; without it, users with local records
 * stamped 2.4 would be stuck on a failing migration screen. The framework
 * bumps _metadata.schema_version automatically after migrate() runs.
 */
export const migration_2_4_to_2_5: Migration = {
  fromVersion: '2.4',
  toVersion: '2.5',
  description: 'Schema version bump for asset_content_link.audio_uploaded_at',

  async migrate(_db, onProgress) {
    onProgress?.(1, 1, 'No data changes needed');
    await Promise.resolve();
  }
};
