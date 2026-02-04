/**
 * Client-Side Schema Migration System
 *
 * Handles automatic migration of local SQLite data when the app schema version changes.
 * Migrations run before the app becomes interactive, blocking the UI with a progress screen.
 *
 * Key Features:
 * - Version-aware: Detects records with outdated _metadata.schema_version
 * - Sequential execution: Runs migrations in order (1.0 → 1.1 → 1.2)
 * - Progress tracking: Provides callbacks for UI updates
 * - Safe: Never deletes data, only transforms in-place
 * - Idempotent: Safe to retry on failure
 *
 * Usage:
 * 1. Create migration file: db/migrations/X.X-to-Y.Y.ts
 * 2. Register in migrations array below
 * 3. Bump APP_SCHEMA_VERSION in drizzleSchema.ts
 * 4. System automatically detects and runs on next app start
 */

import { migration_0_0_to_1_0 } from './0.0-to-1.0';
import { migration_1_0_to_2_0 } from './1.0-to-2.0';
import { migration_2_0_to_2_1 } from './2.0-to-2.1';
import { migration_2_1_to_2_2 } from './2.1-to-2.2';
import { migration_2_2_to_2_3 } from './2.2-to-2.3';
import { updateMetadataVersion } from './utils';

// Type for database instance used in migrations
// Includes PowerSyncSQLiteDatabase methods plus rawPowerSync access
// export type DrizzleDB = PowerSyncSQLiteDatabase<typeof drizzleSchema> & {
//   rawPowerSync?: PowerSyncDatabase | PowerSyncDatabaseWeb;
//   // Ensure these methods exist with proper types
//   run: (
//     query: ReturnType<typeof sql>
//   ) => Promise<{ changes: number; lastInsertRowid: bigint }>;
//   get: <T = unknown>(query: ReturnType<typeof sql>) => Promise<T | undefined>;
// };

export interface DrizzleDB {
  getAll: (sql: string, params?: unknown[]) => Promise<unknown[]>;
  execute: (sql: string) => Promise<unknown>;
}
// ============================================================================
// TYPES
// ============================================================================

export interface Migration {
  fromVersion: string;
  toVersion: string;
  description: string;
  /**
   * Execute the migration
   * @param db - Drizzle database instance with PowerSync
   * @param onProgress - Optional progress callback (current step, total steps, description)
   */
  migrate: (
    db: DrizzleDB,
    onProgress?: (current: number, total: number, step: string) => void
  ) => Promise<void>;
}

export interface MigrationResult {
  success: boolean;
  migratedFrom: string;
  migratedTo: string;
  migrationsRun: number;
  errors: string[];
}

// ============================================================================
// MIGRATION REGISTRY
// ============================================================================

/**
 * Register all migrations here in order
 * Migrations will be run sequentially from oldest to newest
 */
export const migrations: Migration[] = [
  // Start with 0.0 to 1.0 to handle existing unversioned data
  migration_0_0_to_1_0,
  // Breaking change: Add languoid support for offline projects
  migration_1_0_to_2_0,
  migration_2_0_to_2_1,
  // Add content_type column to asset table
  migration_2_1_to_2_2,
  // Migrate language preferences from Language to Languoid format
  migration_2_2_to_2_3
  // Add future migrations here:
];

// ============================================================================
// VERSION COMPARISON
// ============================================================================

/**
 * Compare two semantic version strings
 * @returns negative if a < b, 0 if equal, positive if a > b
 */
function compareVersions(a: string, b: string): number {
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aPart = aParts[i] || 0;
    const bPart = bParts[i] || 0;

    if (aPart !== bPart) {
      return aPart - bPart;
    }
  }

  return 0;
}

/**
 * Get the minimum version found in any _metadata field across LOCAL-ONLY tables
 * Returns null if no records found (empty database)
 * Returns '0.0' if records exist but have no schema_version (unversioned legacy data)
 * Returns minimum version string if all records have versions
 *
 * CRITICAL: This checks ALL records, not just one per table, because:
 * - Tables can have mixed versions (e.g., 99 records at v1.1, 1 at v1.0)
 * - We need to find the OLDEST version to determine if migration is needed
 * - Missing even one outdated record would leave data un-migrated
 * - Records with NULL or missing _metadata.schema_version are treated as version 0.0
 *
 * NOTE: We only check *_local tables because:
 * - Synced tables are migrated server-side via RPC
 * - Local tables contain data that has never been uploaded
 * - This is the only data that needs client-side migration
 *
 * JSON-FIRST: Always queries raw PowerSync tables directly, never views
 */
export async function getMinimumSchemaVersion(
  db: DrizzleDB
): Promise<string | null> {
  try {
    const { getRawTableName } = await import('./utils');

    // Always query raw PowerSync tables directly, never views
    const tables = [
      'profile_local',
      'project_local',
      'quest_local',
      'asset_local',
      'tag_local',
      'quest_asset_link_local',
      'quest_tag_link_local',
      'asset_tag_link_local',
      'asset_content_link_local',
      'vote_local',
      'reports_local',
      'invite_local',
      'request_local',
      'notification_local',
      'profile_project_link_local',
      'project_language_link_local',
      'subscription_local',
      'blocked_users_local',
      'blocked_content_local',
      // Languoid/region tables (v1.1+)
      'languoid_local',
      'languoid_alias_local',
      'languoid_source_local',
      'languoid_property_local',
      'region_local',
      'region_alias_local',
      'region_source_local',
      'region_property_local',
      'languoid_region_local'
    ];

    let minVersion: string | null = null;
    let foundAnyData = false; // Track if we found any records at all

    for (const table of tables) {
      try {
        const rawTableName = getRawTableName(table);

        // Check if raw table exists
        const result = await db.getAll(
          `SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name=?`,
          [rawTableName]
        );
        const rawTableExists = (result[0] as { count?: number }) || null;

        if (!rawTableExists || rawTableExists.count === 0) {
          console.log(
            `[Migration] Raw table ${rawTableName} does not exist, skipping`
          );
          continue;
        }

        // Check if raw table has any data
        const rowCountResult = await db.getAll(
          `SELECT COUNT(*) as count FROM ${rawTableName}`,
          []
        );
        const rowCount = (rowCountResult[0] as { count?: number }) || null;

        console.log(
          `[Migration] Raw table ${rawTableName}: ${rowCount?.count ?? 0} records`
        );

        if (!rowCount || rowCount.count === 0) {
          continue;
        }

        foundAnyData = true;

        // Check for unversioned records in raw JSON
        const unversionedResult = await db.getAll(
          `SELECT COUNT(*) as count 
           FROM ${rawTableName} 
           WHERE json_extract(data, '$._metadata') IS NULL 
              OR json_extract(json(json_extract(data, '$._metadata')), '$.schema_version') IS NULL`,
          []
        );
        const unversionedCount =
          (unversionedResult[0] as { count?: number }) || null;

        const unversionedCountValue = unversionedCount?.count ?? 0;
        if (unversionedCountValue > 0) {
          console.log(
            `[Migration] Found ${unversionedCountValue} unversioned records in ${rawTableName} - needs migration from 0.0`
          );
          minVersion = '0.0';
          // Don't break - we want to log all tables with unversioned data
          continue;
        }

        // Find minimum version from raw JSON
        const versionResult = await db.getAll(
          `SELECT MIN(json_extract(json(json_extract(data, '$._metadata')), '$.schema_version')) as min_version 
           FROM ${rawTableName} 
           WHERE json_extract(json(json_extract(data, '$._metadata')), '$.schema_version') IS NOT NULL`,
          []
        );
        const versionData =
          (versionResult[0] as { min_version: string | null }) || null;

        if (versionData?.min_version) {
          const version = versionData.min_version;
          if (!minVersion || compareVersions(version, minVersion) < 0) {
            minVersion = version;
            console.log(
              `[Migration] Found version ${version} in ${rawTableName}`
            );
          }
        }
      } catch (err) {
        // Table might not exist or have _metadata column yet - skip it
        console.log(`[Migration] Skipping table ${table}:`, err);
      }
    }

    // Return results:
    // - If no data found at all: return null (caller will treat as "no migration needed")
    // - If data found but no versions: return '0.0' (needs migration)
    // - If data found with versions: return the minimum version
    if (!foundAnyData) {
      return null; // Signal: empty database, no migration needed
    }
    return minVersion || '0.0'; // Data exists, return version (or 0.0 if unversioned)
  } catch (error) {
    console.error('[Migration] Error getting minimum schema version:', error);
    return '0.0';
  }
}

// ============================================================================
// MIGRATION DETECTION
// ============================================================================

/**
 * Check if any migrations are needed
 * @returns true if any records have _metadata.schema_version < targetVersion
 */
export async function checkNeedsMigration(
  db: DrizzleDB,
  targetVersion: string
): Promise<boolean> {
  console.log(
    `[Migration] Checking if migration needed for version ${targetVersion}...`
  );

  const minVersion = await getMinimumSchemaVersion(db);

  // If null, database is empty - no migration needed
  if (minVersion === null) {
    console.log(
      '[Migration] No existing data found - no migration needed (empty database)'
    );
    return false;
  }

  // If we found data with version 0.0 (unversioned), migration IS needed
  if (minVersion === '0.0') {
    console.log(
      '[Migration] Found unversioned data (NULL or missing schema_version) - migration needed from 0.0'
    );
    return true;
  }

  // Compare versions to see if migration needed
  const needsMigration = compareVersions(minVersion, targetVersion) < 0;

  if (needsMigration) {
    console.log(
      `[Migration] Migration needed: found data with version ${minVersion}, target is ${targetVersion}`
    );
  } else {
    console.log(
      `[Migration] No migration needed: all data is version ${minVersion} or newer`
    );
  }

  return needsMigration;
}

// ============================================================================
// MIGRATION EXECUTION
// ============================================================================

/**
 * Find the migration path from currentVersion to targetVersion
 * Returns array of migrations to run in order
 */
function findMigrationPath(
  currentVersion: string,
  targetVersion: string
): Migration[] {
  if (compareVersions(currentVersion, targetVersion) >= 0) {
    return []; // Already at or past target version
  }

  const path: Migration[] = [];
  let version = currentVersion;

  // Build migration chain
  while (compareVersions(version, targetVersion) < 0) {
    const nextMigration = migrations.find(
      (m) =>
        m.fromVersion === version &&
        compareVersions(m.toVersion, targetVersion) <= 0
    );

    if (!nextMigration) {
      // Try to find any migration that moves us forward
      const anyForwardMigration = migrations.find(
        (m) => m.fromVersion === version
      );

      if (!anyForwardMigration) {
        throw new Error(
          `No migration path found from ${currentVersion} to ${targetVersion}. ` +
            `Missing migration from ${version}.`
        );
      }

      path.push(anyForwardMigration);
      version = anyForwardMigration.toVersion;
    } else {
      path.push(nextMigration);
      version = nextMigration.toVersion;
    }

    // Safety: prevent infinite loops
    if (path.length > 50) {
      throw new Error('Migration path too long - possible circular dependency');
    }
  }

  return path;
}

/**
 * Run all necessary migrations from current version to target version
 *
 * @param db - Drizzle database instance
 * @param currentVersion - Starting version (usually from getMinimumSchemaVersion)
 * @param targetVersion - Target version (usually APP_SCHEMA_VERSION)
 * @param onProgress - Optional callback for progress updates
 * @returns Migration result with success status and details
 */
export async function runMigrations(
  db: DrizzleDB,
  currentVersion: string,
  targetVersion: string,
  onProgress?: (current: number, total: number, step: string) => void
): Promise<MigrationResult> {
  console.log(
    `[Migration] Starting migration from ${currentVersion} to ${targetVersion}...`
  );

  const errors: string[] = [];

  try {
    // Find migration path
    const migrationPath = findMigrationPath(currentVersion, targetVersion);

    if (migrationPath.length === 0) {
      console.log('[Migration] No migrations needed');
      return {
        success: true,
        migratedFrom: currentVersion,
        migratedTo: currentVersion,
        migrationsRun: 0,
        errors: []
      };
    }

    console.log(
      `[Migration] Found ${migrationPath.length} migration(s) to run:`
    );
    migrationPath.forEach((m, i) => {
      console.log(
        `  ${i + 1}. ${m.fromVersion} → ${m.toVersion}: ${m.description}`
      );
    });

    // Run migrations sequentially
    for (let i = 0; i < migrationPath.length; i++) {
      const migration = migrationPath[i]!;
      const stepNum = i + 1;

      console.log(
        `\n[Migration] Step ${stepNum}/${migrationPath.length}: ${migration.description}`
      );

      if (onProgress) {
        onProgress(stepNum, migrationPath.length, migration.description);
      }

      try {
        // Run the migration
        await migration.migrate(db, (current, total, substep) => {
          if (onProgress) {
            // Nested progress: show overall step and substep
            onProgress(
              stepNum,
              migrationPath.length,
              `${migration.description}: ${substep} (${current}/${total})`
            );
          }
        });

        // Update _metadata on all records to new version
        console.log(
          `[Migration] Updating _metadata to version ${migration.toVersion}...`
        );
        await updateMetadataVersion(db, migration.toVersion);

        console.log(
          `[Migration] ✓ Completed migration to ${migration.toVersion}`
        );
      } catch (error) {
        const errorMsg = `Failed to migrate from ${migration.fromVersion} to ${migration.toVersion}: ${String(error)}`;
        console.error(`[Migration] ✗ ${errorMsg}`);
        errors.push(errorMsg);
        throw error; // Stop on first error
      }
    }

    const finalVersion = migrationPath[migrationPath.length - 1]!.toVersion;

    console.log(`\n[Migration] ✓ All migrations completed successfully`);
    console.log(`[Migration] Final version: ${finalVersion}`);

    return {
      success: true,
      migratedFrom: currentVersion,
      migratedTo: finalVersion,
      migrationsRun: migrationPath.length,
      errors: []
    };
  } catch (error) {
    console.error('[Migration] Migration failed:', error);

    return {
      success: false,
      migratedFrom: currentVersion,
      migratedTo: currentVersion, // Didn't make it to target
      migrationsRun: 0,
      errors: [...errors, String(error)]
    };
  }
}

/**
 * Custom error class to signal that migration is needed
 * Thrown during system init to trigger migration UI
 */
export class MigrationNeededError extends Error {
  constructor(
    public readonly currentVersion: string,
    public readonly targetVersion: string
  ) {
    super(`Migration needed from ${currentVersion} to ${targetVersion}`);
    this.name = 'MigrationNeededError';
  }
}
