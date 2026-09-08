import type { Migration } from './index';

/**
 * Migration: 2.5 -> 2.6
 *
 * Purpose: Version bump only. 2.6 collapses the PowerSync _local / _synced /
 * union-view triplicate into one table per entity and adds quest.published_at.
 *
 * The layout change is handled by `upgradeToSingleTable.ts` (JSON-staged
 * drafts, copy *_synced → ps_data__*, drop leftover tables/views) because
 * PowerSync's constructor would otherwise drop *_local before a SQLite
 * snapshot could be re-read. This file exists so findMigrationPath() can
 * hop 2.5 → 2.6; the framework stamps _metadata.schema_version after migrate().
 */
export const migration_2_5_to_2_6: Migration = {
  fromVersion: '2.5',
  toVersion: '2.6',
  description: 'Schema version bump for single-table PowerSync layout',

  async migrate(_db, onProgress) {
    onProgress?.(1, 1, 'Layout upgrade runs separately');
    await Promise.resolve();
  }
};
