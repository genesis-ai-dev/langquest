/**
 * Degraded Mode Service
 *
 * Manages degraded mode state when migrations fail repeatedly.
 * Stores state in AsyncStorage and only retries migrations when schema version changes.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const DEGRADED_MODE_KEY = '@langquest:degraded_mode';
const MIGRATION_RETRY_COUNT_KEY = '@langquest:migration_retry_count';
const LAST_SCHEMA_VERSION_KEY = '@langquest:last_schema_version';

const MAX_RETRY_ATTEMPTS = 1;

interface DegradedModeState {
  isDegraded: boolean;
  lastFailedVersion: string | null;
  retryCount: number;
  lastSchemaVersion: string | null;
}

/**
 * Get current schema version
 */
async function getCurrentSchemaVersion(): Promise<string> {
  try {
    const { APP_SCHEMA_VERSION } = await import('../db/constants');
    return APP_SCHEMA_VERSION;
  } catch (error) {
    console.error('[DegradedModeService] Error getting schema version:', error);
    return 'unknown';
  }
}

/**
 * Get current schema version (exported for testing/debugging)
 */
export async function getCurrentSchemaVersionForTesting(): Promise<string> {
  return getCurrentSchemaVersion();
}

/**
 * Get degraded mode state from AsyncStorage
 */
export async function getDegradedModeState(): Promise<DegradedModeState> {
  try {
    const [isDegraded, lastFailedVersion, retryCount, lastSchemaVersion] =
      await Promise.all([
        AsyncStorage.getItem(DEGRADED_MODE_KEY),
        AsyncStorage.getItem(`${DEGRADED_MODE_KEY}:failed_version`),
        AsyncStorage.getItem(MIGRATION_RETRY_COUNT_KEY),
        AsyncStorage.getItem(LAST_SCHEMA_VERSION_KEY)
      ]);

    return {
      isDegraded: isDegraded === 'true',
      lastFailedVersion: lastFailedVersion || null,
      retryCount: retryCount ? parseInt(retryCount, 10) : 0,
      lastSchemaVersion: lastSchemaVersion || null
    };
  } catch (error) {
    console.error(
      '[DegradedModeService] Error reading degraded mode state:',
      error
    );
    return {
      isDegraded: false,
      lastFailedVersion: null,
      retryCount: 0,
      lastSchemaVersion: null
    };
  }
}

/**
 * Check if schema version has changed since last successful migration
 * Note: Does NOT update stored version - that only happens after successful migration
 */
export async function hasSchemaVersionChanged(): Promise<boolean> {
  try {
    const currentVersion = await getCurrentSchemaVersion();
    const lastVersion = await AsyncStorage.getItem(LAST_SCHEMA_VERSION_KEY);

    console.log(
      `[DegradedModeService] Schema version check - Current: ${currentVersion}, Stored: ${lastVersion || 'none'}`
    );

    if (!lastVersion) {
      // First time - don't store yet, wait for successful migration
      // Return false so we don't trigger retry on first check
      console.log(
        `[DegradedModeService] First time schema version check - will store after successful migration`
      );
      return false;
    }

    const versionChanged = lastVersion !== currentVersion;
    if (versionChanged) {
      console.log(
        `[DegradedModeService] ✓ Schema version changed: ${lastVersion} → ${currentVersion}`
      );
      // Don't update stored version here - only update after successful migration
    } else {
      console.log(
        `[DegradedModeService] Schema version unchanged: ${currentVersion}`
      );
    }

    return versionChanged;
  } catch (error) {
    console.error(
      '[DegradedModeService] Error checking schema version:',
      error
    );
    return false;
  }
}

/**
 * Increment retry count and check if we should enter degraded mode
 */
export async function incrementRetryCount(): Promise<boolean> {
  try {
    const state = await getDegradedModeState();
    const newRetryCount = state.retryCount + 1;
    const currentVersion = await getCurrentSchemaVersion();

    await AsyncStorage.setItem(
      MIGRATION_RETRY_COUNT_KEY,
      String(newRetryCount)
    );
    await AsyncStorage.setItem(
      `${DEGRADED_MODE_KEY}:failed_version`,
      currentVersion
    );

    // Enter degraded mode if we've exceeded max retries
    if (newRetryCount >= MAX_RETRY_ATTEMPTS) {
      await AsyncStorage.setItem(DEGRADED_MODE_KEY, 'true');
      console.log(
        `[DegradedModeService] Entered degraded mode after ${newRetryCount} retry attempts`
      );
      return true;
    }

    return false;
  } catch (error) {
    console.error(
      '[DegradedModeService] Error incrementing retry count:',
      error
    );
    return false;
  }
}

/**
 * Check if we should retry migration (only if schema version changed)
 */
export async function shouldRetryMigration(): Promise<boolean> {
  const state = await getDegradedModeState();
  const versionChanged = await hasSchemaVersionChanged();

  // Only retry if:
  // 1. We're in degraded mode AND
  // 2. Schema version has changed
  if (state.isDegraded && versionChanged) {
    console.log(
      '[DegradedModeService] Schema version changed - allowing migration retry'
    );
    return true;
  }

  if (state.isDegraded) {
    console.log(
      '[DegradedModeService] In degraded mode but schema version unchanged - skipping retry'
    );
  }

  return false;
}

/**
 * Clear degraded mode state (called when migration succeeds)
 */
export async function clearDegradedMode(): Promise<void> {
  try {
    const currentVersion = await getCurrentSchemaVersion();
    await Promise.all([
      AsyncStorage.removeItem(DEGRADED_MODE_KEY),
      AsyncStorage.removeItem(`${DEGRADED_MODE_KEY}:failed_version`),
      AsyncStorage.removeItem(MIGRATION_RETRY_COUNT_KEY),
      // Update schema version to current so we don't immediately retry
      AsyncStorage.setItem(LAST_SCHEMA_VERSION_KEY, currentVersion)
    ]);
    console.log('[DegradedModeService] Cleared degraded mode state');
  } catch (error) {
    console.error('[DegradedModeService] Error clearing degraded mode:', error);
  }
}

/**
 * Reset retry count (called when migration succeeds)
 */
export async function resetRetryCount(): Promise<void> {
  try {
    await AsyncStorage.removeItem(MIGRATION_RETRY_COUNT_KEY);
    console.log('[DegradedModeService] Reset retry count');
  } catch (error) {
    console.error('[DegradedModeService] Error resetting retry count:', error);
  }
}

/**
 * Check if currently in degraded mode
 */
export async function isDegradedMode(): Promise<boolean> {
  const state = await getDegradedModeState();
  return state.isDegraded;
}
