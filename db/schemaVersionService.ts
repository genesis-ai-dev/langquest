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
    // Add timeout to prevent infinite hanging
    const rpcPromise = supabaseClient.rpc('get_schema_info');
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Schema version check timed out after 5 seconds'));
      }, 5000);
    });

    const result = await Promise.race([rpcPromise, timeoutPromise]);
    const { data, error } = result as { data: unknown; error: unknown };

    if (error) {
      console.error(
        '[SchemaVersionService] Failed to fetch server schema:',
        error
      );
      let errorMessage: string;
      if (error instanceof Error) {
        errorMessage = error.message;
      } else {
        try {
          errorMessage = JSON.stringify(error);
        } catch {
          errorMessage = 'Unknown error occurred';
        }
      }
      throw new Error(`Failed to fetch server schema: ${errorMessage}`);
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
 * IMPORTANT: This returns the app's expected schema version (APP_SCHEMA_VERSION),
 * NOT the version of data in the local database. The local data version is only
 * relevant for migrations, not for app upgrade checks.
 *
 * For app upgrade checks, we compare:
 * - App's expected version (APP_SCHEMA_VERSION) - what the code supports
 * - Server's version - what the server requires
 *
 * If these don't match, the app needs to be upgraded. Local data migrations
 * happen separately and don't affect this check.
 *
 * @param db - Drizzle database instance (unused, kept for API compatibility)
 * @returns Local schema version string (always APP_SCHEMA_VERSION)
 */
export function getLocalSchemaVersion(_db: DrizzleDB): Promise<string> {
  console.log(
    '[SchemaVersionService] Getting local schema version (app expected version)...'
  );

  // Always return APP_SCHEMA_VERSION for app upgrade checks
  // The local data version is handled separately by the migration system
  console.log(
    '[SchemaVersionService] Using APP_SCHEMA_VERSION:',
    APP_SCHEMA_VERSION
  );
  return Promise.resolve(APP_SCHEMA_VERSION);
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
