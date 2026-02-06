/**
 * Schema Version Service
 *
 * Handles schema version comparison between client and server.
 * Forces app upgrades when client version is below minimum required version.
 *
 * Key Features:
 * - Fetches server schema info via RPC (includes min_required_schema_version)
 * - Compares local schema version with minimum required version
 * - Throws AppUpgradeNeededError if local version is below minimum
 * - Maintains backwards compatibility: minor updates don't require immediate upgrades
 *
 * Migration Strategy:
 * - DB migrations can be deployed first (set min_required_schema_version)
 * - Old apps below minimum are blocked from syncing
 * - App updates can be released later without blocking all users
 * - Minimum version can be raised gradually as adoption increases
 */

import NetInfo from '@react-native-community/netinfo';
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
    public readonly serverVersion: string // Now represents min_required_schema_version
  ) {
    const message =
      reason === 'server_ahead'
        ? `App schema version (${localVersion}) is below minimum required version (${serverVersion}). Please upgrade the app.`
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
  min_required_schema_version?: string; // Minimum client version required
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
 * Fetch server schema info from Supabase RPC
 * @param supabaseClient - Supabase client instance
 * @returns Server schema info including minimum required version
 * @throws Error if RPC call fails
 */
export async function fetchServerSchemaInfo(
  supabaseClient: SupabaseClient
): Promise<ServerSchemaInfo> {
  console.log('[SchemaVersionService] Fetching server schema info...');

  try {
    // Quick network check - skip RPC entirely if offline
    // This avoids waiting for timeout when we know we can't reach the server
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      console.log(
        '[SchemaVersionService] Device is offline, skipping server check'
      );
      throw new Error('Device is offline');
    }

    // Add timeout to prevent hanging on slow networks
    // Reduced from 5s to 2s for faster offline-first experience
    const TIMEOUT_MS = 2000;
    const rpcPromise = supabaseClient.rpc('get_schema_info');
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Schema info check timed out after ${TIMEOUT_MS}ms`));
      }, TIMEOUT_MS);
    });

    const result = await Promise.race([rpcPromise, timeoutPromise]);
    const { data, error } = result as { data: unknown; error: unknown };

    if (error) {
      console.error(
        '[SchemaVersionService] Failed to fetch server schema info:',
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
      throw new Error(`Failed to fetch server schema info: ${errorMessage}`);
    }

    if (!data || typeof data !== 'object' || !('schema_version' in data)) {
      throw new Error('Invalid schema info response from server');
    }

    const schemaInfo = data as ServerSchemaInfo;
    console.log('[SchemaVersionService] Server schema info:', schemaInfo);

    return schemaInfo;
  } catch (error) {
    console.error(
      '[SchemaVersionService] Error fetching server schema info:',
      error
    );
    throw error;
  }
}

/**
 * Fetch server schema version from Supabase RPC (backwards compatibility)
 * @deprecated Use fetchServerSchemaInfo instead
 * @param supabaseClient - Supabase client instance
 * @returns Server schema version string
 * @throws Error if RPC call fails
 */
export async function fetchServerSchemaVersion(
  supabaseClient: SupabaseClient
): Promise<string> {
  const schemaInfo = await fetchServerSchemaInfo(supabaseClient);
  return schemaInfo.schema_version;
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
 * Check if app upgrade is needed by comparing local version with server's minimum required version
 *
 * Uses minimum version requirement instead of exact match:
 * - If min_required_schema_version is set, checks if localVersion >= min_required_schema_version
 * - If min_required_schema_version is not set, falls back to exact match (backwards compatibility)
 * - Allows DB migrations to be deployed before app updates are approved
 * - Maintains backwards compatibility for minor schema updates
 *
 * @param db - Drizzle database instance
 * @param supabaseClient - Supabase client instance
 * @throws AppUpgradeNeededError if local version is below minimum required
 */
export async function checkAppUpgradeNeeded(
  db: DrizzleDB,
  supabaseClient: SupabaseClient
): Promise<void> {
  console.log('[SchemaVersionService] Checking if app upgrade is needed...');

  try {
    // Fetch server schema info (includes min_required_schema_version)
    const schemaInfo = await fetchServerSchemaInfo(supabaseClient);
    const localVersion = await getLocalSchemaVersion(db);

    // Use min_required_schema_version if available, otherwise fall back to exact match
    const requiredVersion =
      schemaInfo.min_required_schema_version || schemaInfo.schema_version;

    console.log('[SchemaVersionService] Local version:', localVersion);
    console.log('[SchemaVersionService] Required version:', requiredVersion);
    console.log(
      '[SchemaVersionService] Server schema version:',
      schemaInfo.schema_version
    );

    // Compare local version with minimum required version
    const comparison = compareVersions(localVersion, requiredVersion);

    if (comparison >= 0) {
      // Local version meets or exceeds minimum requirement
      console.log(
        '[SchemaVersionService] ✓ Schema version meets minimum requirement'
      );
      return;
    }

    // Local version is below minimum required - app upgrade needed
    console.error(
      `[SchemaVersionService] ⚠️  Local version (${localVersion}) is below minimum required (${requiredVersion}) - app upgrade required`
    );
    throw new AppUpgradeNeededError(
      'server_ahead',
      localVersion,
      requiredVersion
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
