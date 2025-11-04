/**
 * Schema Version Service
 *
 * Handles schema version comparison between client and server.
 * Forces app upgrades when there's a mismatch to prevent data corruption.
 *
 * Key Features:
 * - Fetches server schema version via RPC
 * - Compares with local schema version
 * - Throws AppUpgradeNeededError if mismatch detected
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { APP_SCHEMA_VERSION } from './constants';
import type { DrizzleDB } from './migrations/index';
import { getMinimumSchemaVersion } from './migrations/index';

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Error thrown when app needs to be upgraded due to server schema changes
 * This is different from MigrationNeededError - this is for server/client mismatches
 */
export class AppUpgradeNeededError extends Error {
  constructor(
    public readonly reason: 'server_ahead' | 'server_behind',
    public readonly localVersion: string,
    public readonly serverVersion: string
  ) {
    const message =
      reason === 'server_ahead'
        ? `Server schema (${serverVersion}) is newer than local schema (${localVersion}). Please upgrade the app.`
        : `Server schema (${serverVersion}) is older than local schema (${localVersion}). Server needs upgrade.`;

    super(message);
    this.name = 'AppUpgradeNeededError';
  }
}

// ============================================================================
// TYPES
// ============================================================================

interface ServerSchemaInfo {
  schema_version: string;
  notes?: string | null;
}

// ============================================================================
// SCHEMA VERSION FUNCTIONS
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
 * Fetch server schema version from Supabase RPC
 * @param supabaseClient - Supabase client instance
 * @returns Server schema version string
 * @throws Error if RPC call fails
 */
export async function fetchServerSchemaVersion(
  supabaseClient: SupabaseClient
): Promise<string> {
  console.log('[SchemaVersionService] Fetching server schema version...');

  try {
    const { data, error } = await supabaseClient.rpc('get_schema_info');

    if (error) {
      console.error(
        '[SchemaVersionService] Failed to fetch server schema:',
        error
      );
      throw new Error(`Failed to fetch server schema: ${error.message}`);
    }

    if (!data || typeof data !== 'object' || !('schema_version' in data)) {
      throw new Error('Invalid schema info response from server');
    }

    const schemaInfo = data as ServerSchemaInfo;
    console.log(
      '[SchemaVersionService] Server schema version:',
      schemaInfo.schema_version
    );

    return schemaInfo.schema_version;
  } catch (error) {
    console.error(
      '[SchemaVersionService] Error fetching server schema:',
      error
    );
    throw error;
  }
}

/**
 * Get the local schema version to compare with server
 *
 * Strategy:
 * 1. If there are local-only records, use their minimum schema version
 * 2. If no local-only records exist, use APP_SCHEMA_VERSION (the code's schema version)
 *
 * @param db - Drizzle database instance
 * @returns Local schema version string
 */
export async function getLocalSchemaVersion(db: DrizzleDB): Promise<string> {
  console.log('[SchemaVersionService] Getting local schema version...');

  // Check if we have any local-only records with schema versions
  const minLocalVersion = await getMinimumSchemaVersion(db);

  if (minLocalVersion !== null) {
    console.log(
      '[SchemaVersionService] Using local-only records version:',
      minLocalVersion
    );
    return minLocalVersion;
  }

  // No local-only records, use the code's schema version
  console.log(
    '[SchemaVersionService] No local-only records, using APP_SCHEMA_VERSION:',
    APP_SCHEMA_VERSION
  );
  return APP_SCHEMA_VERSION;
}

/**
 * Check if app upgrade is needed by comparing local and server schema versions
 *
 * @param db - Drizzle database instance
 * @param supabaseClient - Supabase client instance
 * @throws AppUpgradeNeededError if versions don't match
 */
export async function checkAppUpgradeNeeded(
  db: DrizzleDB,
  supabaseClient: SupabaseClient
): Promise<void> {
  console.log('[SchemaVersionService] Checking if app upgrade is needed...');

  try {
    // Fetch both versions
    const [localVersion, serverVersion] = await Promise.all([
      getLocalSchemaVersion(db),
      fetchServerSchemaVersion(supabaseClient)
    ]);

    console.log('[SchemaVersionService] Local version:', localVersion);
    console.log('[SchemaVersionService] Server version:', serverVersion);

    // Compare versions
    const comparison = compareVersions(localVersion, serverVersion);

    if (comparison === 0) {
      console.log(
        '[SchemaVersionService] ✓ Schema versions match - no upgrade needed'
      );
      return;
    }

    if (comparison < 0) {
      // Local version is older than server - app upgrade needed
      console.error(
        `[SchemaVersionService] ⚠️  Server schema is newer (${serverVersion}) than local (${localVersion}) - app upgrade required`
      );
      throw new AppUpgradeNeededError(
        'server_ahead',
        localVersion,
        serverVersion
      );
    }

    // Local version is newer than server - server needs upgrade (shouldn't happen in normal flow)
    console.error(
      `[SchemaVersionService] ⚠️  Local schema is newer (${localVersion}) than server (${serverVersion}) - server upgrade required`
    );
    throw new AppUpgradeNeededError(
      'server_behind',
      localVersion,
      serverVersion
    );
  } catch (error) {
    // Re-throw AppUpgradeNeededError as-is
    if (error instanceof AppUpgradeNeededError) {
      throw error;
    }

    // For network errors or other failures, log and continue
    // We don't want to block the app if we can't reach the server
    console.warn(
      '[SchemaVersionService] ⚠️  Failed to check schema version, allowing app to continue:',
      error
    );
    // Don't throw - allow app to proceed
  }
}
