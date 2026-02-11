import type { Migration } from './index';
import { getRawTableName, rawTableExists } from './utils';

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
 * - Uses JSON-first approach: updates raw PowerSync JSON data directly.
 */
export const migration_2_0_to_2_1: Migration = {
  fromVersion: '2.0',
  toVersion: '2.1',
  description: 'Backfill versification_template for local projects',

  async migrate(db, onProgress) {
    console.log(
      '[Migration 2.0→2.1] Starting versification_template backfill...'
    );

    // Preflight: Verify raw table exists
    const projectLocalRawExists = await rawTableExists(db, 'project_local');

    if (!projectLocalRawExists) {
      console.log(
        '[Migration 2.0→2.1] No raw project_local table found, skipping migration'
      );
      return;
    }

    if (onProgress)
      onProgress(1, 1, 'Backfilling versification_template on project_local');

    // CRITICAL: Update raw PowerSync table directly and use json_set() to update JSON data field
    // PowerSync stores data as JSON in 'data' column, not individual columns
    const projectLocalTable = getRawTableName('project_local');
    await db.execute(`
      UPDATE ${projectLocalTable}
      SET data = json_set(
        data,
        '$.versification_template',
        'protestant'
      )
      WHERE json_extract(data, '$.versification_template') IS NULL
    `);

    console.log('[Migration 2.0→2.1] ✓ versification_template backfilled');
    console.log('[Migration 2.0→2.1] ✓ Migration complete');
  }
};
