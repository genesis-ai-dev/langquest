import type { Migration } from './index';

/**
 * Migration: 2.0 → 2.1
 *
 * Purpose: Backfill versification_template for existing local projects.
 * The column is nullable and has no default; this sets existing records
 * to the initial value of 'protestant' so client code can rely on it.
 *
 * Notes:
 * - Column is defined in the Drizzle schema; no ALTER needed on PowerSync tables.
 * - Only touches *_local tables per migration rules.
 */
export const migration_2_0_to_2_1: Migration = {
  fromVersion: '2.0',
  toVersion: '2.1',
  description: 'Backfill versification_template for local projects',

  async migrate(db, onProgress) {
    if (onProgress)
      onProgress(1, 1, 'Backfilling versification_template on project_local');

    await db.execute(`
      UPDATE project_local
      SET versification_template = 'protestant'
      WHERE versification_template IS NULL
    `);
  }
};
