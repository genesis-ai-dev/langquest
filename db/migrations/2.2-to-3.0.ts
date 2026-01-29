import type { Migration } from './index';

/**
 * Migration: 2.2 → 3.0
 *
 * PURPOSE: Test degraded mode functionality
 *
 * This migration intentionally fails to test the degraded mode system.
 * It simulates a migration failure scenario where the migration cannot complete.
 *
 * NOTE: This is a test migration only. Remove or fix before production.
 */
export const migration_2_2_to_3_0: Migration = {
  fromVersion: '2.2',
  toVersion: '3.0',
  description: 'Test migration for degraded mode (intentionally fails)',

  async migrate(db, onProgress) {
    console.log('[Migration 2.2→3.0] Starting test migration...');

    if (onProgress) {
      onProgress(1, 2, 'Simulating migration failure...');
    }

    // Simulate some work before failing
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Intentionally throw an error to test degraded mode
    throw new Error(
      'Test migration failure: This migration intentionally fails to test degraded mode functionality. ' +
        'After 3 retry attempts, the app should enter degraded mode.'
    );
  }
};
