/**
 * Migration: 2.2 → 2.3
 *
 * PURPOSE: Migrate Language preferences to Languoid format in Zustand persisted state
 *
 * This migration handles the Zustand store persisted in AsyncStorage, migrating
 * from the old Language format to the new Languoid format. This directly modifies
 * AsyncStorage JSON to avoid initializing useLocalStore during migration.
 *
 * Changes:
 * - Migrate uiLanguage to uiLanguoid
 * - Migrate savedLanguage to savedLanguoid
 * - Look up languoids from both synced and local tables
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Migration } from './index';
import { getRawTableName, rawTableExists } from './utils';

export const migration_2_2_to_2_3: Migration = {
  fromVersion: '2.2',
  toVersion: '2.3',
  description: 'Migrate language preferences from Language to Languoid format',

  async migrate(db, onProgress) {
    console.log(
      '[Migration 2.2→2.3] Migrating language preferences from Language to Languoid format...'
    );

    if (onProgress) onProgress(1, 1, 'Migrating language preferences');

    try {
      const storeKey = 'local-store';
      const storedData = await AsyncStorage.getItem(storeKey);
      if (!storedData) {
        console.log(
          '[Migration 2.2→2.3] No Zustand store data found, skipping'
        );
        return;
      }

      const parsed = JSON.parse(storedData) as {
        state?: {
          uiLanguage?: unknown;
          uiLanguoid?: unknown;
          savedLanguage?: unknown;
          savedLanguoid?: unknown;
          [key: string]: unknown;
        };
        version?: number;
        [key: string]: unknown;
      };
      // Zustand persist stores data as { state: {...}, version: number }
      const state = (parsed.state || parsed) as {
        uiLanguage?: unknown;
        uiLanguoid?: unknown;
        savedLanguage?: unknown;
        savedLanguoid?: unknown;
        [key: string]: unknown;
      };

      // Helper to migrate a Language object to Languoid
      const migrateLanguageToLanguoid = async (lang: unknown) => {
        if (!lang || typeof lang !== 'object') return null;

        const langObj = lang as {
          id?: string;
          name?: string;
          english_name?: string;
        };

        // If it already has 'name' property and no 'english_name', it's already a Languoid
        if (
          'name' in langObj &&
          typeof langObj.name === 'string' &&
          !('english_name' in langObj)
        ) {
          return langObj;
        }

        // Old format: try to find languoid by ID
        if (!langObj.id) {
          return null;
        }

        try {
          // Query raw PowerSync tables directly (same pattern as rest of migration)
          // Check both synced and local languoid tables
          const languoidSyncedExists = await rawTableExists(
            db,
            'languoid',
            'synced'
          );
          const languoidLocalExists = await rawTableExists(
            db,
            'languoid',
            'local'
          );

          // Try synced table first
          if (languoidSyncedExists) {
            const languoidSyncedTable = getRawTableName('languoid', 'synced');
            const results = (await db.getAll(
              `SELECT data FROM ${languoidSyncedTable} WHERE id = ?`,
              [langObj.id]
            )) as { data?: string }[];
            if (results.length > 0 && results[0]?.data) {
              const languoid = JSON.parse(results[0].data);
              console.log(
                `[Migration 2.2→2.3] Migrated language ${langObj.id} to languoid ${(languoid as { id?: string }).id} (synced)`
              );
              return languoid;
            }
          }

          // Try local table
          if (languoidLocalExists) {
            const languoidLocalTable = getRawTableName('languoid', 'local');
            const results = (await db.getAll(
              `SELECT data FROM ${languoidLocalTable} WHERE id = ?`,
              [langObj.id]
            )) as { data?: string }[];
            if (results.length > 0 && results[0]?.data) {
              const languoid = JSON.parse(results[0].data);
              console.log(
                `[Migration 2.2→2.3] Migrated language ${langObj.id} to languoid ${(languoid as { id?: string }).id} (local)`
              );
              return languoid;
            }
          }
        } catch (error) {
          console.warn(
            `[Migration 2.2→2.3] Error finding languoid by ID ${langObj.id}:`,
            error
          );
        }

        // If we can't find a match, return null to clear it
        console.warn(
          `[Migration 2.2→2.3] Could not migrate language ${langObj.id}, clearing`
        );
        return null;
      };

      let needsUpdate = false;

      // Migrate uiLanguage to uiLanguoid
      if (state.uiLanguage) {
        const migrated = await migrateLanguageToLanguoid(state.uiLanguage);
        if (migrated) {
          delete state.uiLanguage;
          state.uiLanguoid = migrated;
          needsUpdate = true;
          console.log('[Migration 2.2→2.3] Migrated uiLanguage to uiLanguoid');
        } else {
          delete state.uiLanguage;
          state.uiLanguoid = null;
          needsUpdate = true;
        }
      }

      // Migrate savedLanguage to savedLanguoid
      if (state.savedLanguage) {
        const migrated = await migrateLanguageToLanguoid(state.savedLanguage);
        if (migrated) {
          state.savedLanguage = migrated;
          state.savedLanguoid = migrated;
          needsUpdate = true;
          console.log(
            '[Migration 2.2→2.3] Migrated savedLanguage to savedLanguoid'
          );
        } else {
          state.savedLanguage = null;
          state.savedLanguoid = null;
          needsUpdate = true;
        }
      }

      // Save back to AsyncStorage if we made changes
      if (needsUpdate) {
        // Preserve Zustand's structure: { state: {...}, version: number }
        const updated = parsed.state ? { ...parsed, state } : state;
        await AsyncStorage.setItem(storeKey, JSON.stringify(updated));
        console.log('[Migration 2.2→2.3] ✓ Migrated language preferences');
      }
    } catch (error) {
      console.warn(
        '[Migration 2.2→2.3] Could not migrate Zustand language preferences:',
        error
      );
      // Continue migration - this is not critical
    }

    console.log('[Migration 2.2→2.3] ✓ Migration complete');
  }
};
