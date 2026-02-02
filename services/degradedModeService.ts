/**
 * Degraded Mode Service
 *
 * Manages degraded mode state when migrations fail repeatedly.
 * Stores state in local store and only retries migrations when:
 * - An OTA update has been applied (updateId changes), OR
 * - App version has changed (new build installed)
 */

import { APP_SCHEMA_VERSION } from '@/db/constants';
import { DEGRADED_MODE_KEY, useLocalStore } from '@/store/localStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

const MAX_RETRY_ATTEMPTS = 1;

interface DegradedModeState {
  isDegraded: boolean;
  lastFailedVersion: string | null;
  retryCount: number;
  lastUpdateId: string | null;
  lastAppVersion: string | null;
  lastSchemaVersion: string | null;
}

/**
 * Get current OTA update ID
 * Returns 'embedded' if running embedded build, or the updateId if running OTA update
 */
function getCurrentUpdateId(): string {
  try {
    // If embedded launch, use 'embedded' as identifier
    if (Updates.isEmbeddedLaunch) {
      return 'embedded';
    }
    // Otherwise, use the updateId (first 8 chars for readability)
    const updateId = Updates.updateId;
    return updateId && updateId.length >= 8
      ? updateId.substring(0, 8)
      : updateId || 'unknown';
  } catch (error) {
    console.error('[DegradedModeService] Error getting update ID:', error);
    return 'unknown';
  }
}

/**
 * Get current update ID (exported for testing/debugging)
 */
export function getCurrentUpdateIdForTesting(): string {
  return getCurrentUpdateId();
}

/**
 * Get current app version from Constants
 */
function getCurrentAppVersion(): string {
  return Constants.expoConfig?.version || 'unknown';
}

/**
 * Get current app version (exported for testing/debugging)
 */
export function getCurrentAppVersionForTesting(): string {
  return getCurrentAppVersion();
}

/**
 * Get degraded mode state from local store
 */
export async function getDegradedModeState(): Promise<DegradedModeState> {
  try {
    const store = useLocalStore.getState();
    // lastFailedVersion is still stored in AsyncStorage (not migrated to store)
    const lastFailedVersion = await AsyncStorage.getItem(
      `${DEGRADED_MODE_KEY}:failed_version`
    );

    return {
      isDegraded: store.degradedMode,
      lastFailedVersion: lastFailedVersion || null,
      retryCount: store.migrationRetryCount,
      lastUpdateId: store.lastUpdateId,
      lastAppVersion: store.lastAppVersion,
      lastSchemaVersion: store.lastSchemaVersion
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
      lastUpdateId: null,
      lastAppVersion: null,
      lastSchemaVersion: null
    };
  }
}

/**
 * Check if an OTA update has been applied since last successful migration
 * Note: Does NOT update stored updateId - that only happens after successful migration
 */
function hasOTAUpdateBeenApplied(): boolean {
  try {
    const currentUpdateId = getCurrentUpdateId();
    const store = useLocalStore.getState();
    const lastUpdateId = store.lastUpdateId;

    if (!lastUpdateId) {
      return false;
    }

    const updateApplied = lastUpdateId !== currentUpdateId;
    if (updateApplied) {
      console.log(
        `[DegradedModeService] ✓ OTA update applied: ${lastUpdateId} → ${currentUpdateId}`
      );
    }

    return updateApplied;
  } catch (error) {
    console.error('[DegradedModeService] Error checking OTA update:', error);
    return false;
  }
}

/**
 * Check if app version has changed since last successful migration
 * Note: Does NOT update stored version - that only happens after successful migration
 */
function hasAppVersionChanged(): boolean {
  try {
    const currentVersion = getCurrentAppVersion();
    const store = useLocalStore.getState();
    const lastVersion = store.lastAppVersion;

    if (!lastVersion) {
      return false;
    }

    const versionChanged = lastVersion !== currentVersion;
    if (versionChanged) {
      console.log(
        `[DegradedModeService] ✓ App version changed: ${lastVersion} → ${currentVersion}`
      );
    }

    return versionChanged;
  } catch (error) {
    console.error('[DegradedModeService] Error checking app version:', error);
    return false;
  }
}

/**
 * Check if either OTA update or app version has changed
 * This allows retry when either an OTA update is applied OR a new app build is installed
 */
export function hasUpdateOrVersionChanged(): boolean {
  const otaUpdateApplied = hasOTAUpdateBeenApplied();
  const appVersionChanged = hasAppVersionChanged();

  const currentUpdateId = getCurrentUpdateId();
  const currentVersion = getCurrentAppVersion();
  const store = useLocalStore.getState();
  const lastUpdateId = store.lastUpdateId;
  const lastVersion = store.lastAppVersion;

  console.log(
    `[DegradedModeService] Update check - OTA: ${lastUpdateId || 'none'} → ${currentUpdateId}, App version: ${lastVersion || 'none'} → ${currentVersion}`
  );

  if (!lastUpdateId && !lastVersion) {
    // First time - don't trigger retry
    console.log(
      `[DegradedModeService] First time check - will store after successful migration`
    );
    return false;
  }

  const changed = otaUpdateApplied || appVersionChanged;

  if (!changed) {
    console.log(`[DegradedModeService] No update or version change detected`);
  }

  return changed;
}

/**
 * Increment retry count and check if we should enter degraded mode
 */
export async function incrementRetryCount(): Promise<boolean> {
  try {
    const store = useLocalStore.getState();
    const newRetryCount = store.migrationRetryCount + 1;
    const currentUpdateId = getCurrentUpdateId();

    // Update retry count in store
    store.setMigrationRetryCount(newRetryCount);

    // Store failed version in AsyncStorage (not migrated to store yet)
    await AsyncStorage.setItem(
      `${DEGRADED_MODE_KEY}:failed_version`,
      currentUpdateId
    );

    // Enter degraded mode if we've exceeded max retries
    if (newRetryCount >= MAX_RETRY_ATTEMPTS) {
      store.setDegradedMode(true);
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
 * Check if we should retry migration (only if OTA update or app version changed)
 */
export async function shouldRetryMigration(): Promise<boolean> {
  const state = await getDegradedModeState();
  const updateOrVersionChanged = hasUpdateOrVersionChanged();

  // Only retry if:
  // 1. We're in degraded mode AND
  // 2. Either an OTA update has been applied OR app version has changed
  if (state.isDegraded && updateOrVersionChanged) {
    console.log(
      '[DegradedModeService] Update or version changed - allowing migration retry'
    );
    return true;
  }

  if (state.isDegraded) {
    console.log(
      '[DegradedModeService] In degraded mode but no update or version change - skipping retry'
    );
  }

  return false;
}

/**
 * Clear degraded mode state (called when migration succeeds)
 */
export async function clearDegradedMode(): Promise<void> {
  try {
    const currentUpdateId = getCurrentUpdateId();
    const currentAppVersion = getCurrentAppVersion();
    const currentSchemaVersion = APP_SCHEMA_VERSION;
    const store = useLocalStore.getState();

    // Clear degraded mode and reset retry count in store
    store.setDegradedMode(false);
    store.setMigrationRetryCount(0);

    // Update stored updateId, app version, and schema version to current so we don't immediately retry
    store.setLastUpdateId(currentUpdateId);
    store.setLastAppVersion(currentAppVersion);
    store.setLastSchemaVersion(currentSchemaVersion);

    // Remove failed version from AsyncStorage (not migrated to store yet)
    await AsyncStorage.removeItem(`${DEGRADED_MODE_KEY}:failed_version`);

    console.log('[DegradedModeService] Cleared degraded mode state');
  } catch (error) {
    console.error('[DegradedModeService] Error clearing degraded mode:', error);
  }
}

/**
 * Reset retry count (called when migration succeeds)
 */
export function resetRetryCount(): void {
  try {
    const store = useLocalStore.getState();
    store.setMigrationRetryCount(0);
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

/**
 * TESTING ONLY: Simulate an OTA update by changing the stored update ID
 * This allows testing degraded mode retry without needing a real OTA update
 *
 * Usage:
 * ```typescript
 * import { simulateOTAUpdate } from '@/services/degradedModeService';
 * simulateOTAUpdate();
 * // Then restart app - degraded mode should detect the "update" and retry migration
 * ```
 */
export function simulateOTAUpdate(): void {
  try {
    const currentUpdateId = getCurrentUpdateId();
    // Set stored update ID to something different to simulate an update
    const simulatedOldUpdateId =
      currentUpdateId === 'embedded'
        ? 'old-update-12345678'
        : `old-${currentUpdateId}`;

    const store = useLocalStore.getState();
    store.setLastUpdateId(simulatedOldUpdateId);

    console.log(
      `[DegradedModeService] TESTING: Simulated OTA update - stored old update ID: ${simulatedOldUpdateId}`
    );
    console.log(
      `[DegradedModeService] Current update ID: ${currentUpdateId} - will be detected as new update on next check`
    );
  } catch (error) {
    console.error('[DegradedModeService] Error simulating OTA update:', error);
  }
}
