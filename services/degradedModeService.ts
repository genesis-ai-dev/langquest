/**
 * Degraded Mode Service
 *
 * Manages degraded mode state when migrations fail repeatedly.
 * Stores state in AsyncStorage and only retries migrations when app version changes.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const DEGRADED_MODE_KEY = '@langquest:degraded_mode';
const MIGRATION_RETRY_COUNT_KEY = '@langquest:migration_retry_count';
const LAST_APP_VERSION_KEY = '@langquest:last_app_version';

const MAX_RETRY_ATTEMPTS = 3;

interface DegradedModeState {
  isDegraded: boolean;
  lastFailedVersion: string | null;
  retryCount: number;
  lastAppVersion: string | null;
}

/**
 * Get current app version from Constants
 */
function getCurrentAppVersion(): string {
  return Constants.expoConfig?.version || 'unknown';
}

/**
 * Get degraded mode state from AsyncStorage
 */
export async function getDegradedModeState(): Promise<DegradedModeState> {
  try {
    const [isDegraded, lastFailedVersion, retryCount, lastAppVersion] =
      await Promise.all([
        AsyncStorage.getItem(DEGRADED_MODE_KEY),
        AsyncStorage.getItem(`${DEGRADED_MODE_KEY}:failed_version`),
        AsyncStorage.getItem(MIGRATION_RETRY_COUNT_KEY),
        AsyncStorage.getItem(LAST_APP_VERSION_KEY)
      ]);

    return {
      isDegraded: isDegraded === 'true',
      lastFailedVersion: lastFailedVersion || null,
      retryCount: retryCount ? parseInt(retryCount, 10) : 0,
      lastAppVersion: lastAppVersion || null
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
      lastAppVersion: null
    };
  }
}

/**
 * Check if app version has changed since last migration attempt
 */
export async function hasAppVersionChanged(): Promise<boolean> {
  try {
    const currentVersion = getCurrentAppVersion();
    const lastVersion = await AsyncStorage.getItem(LAST_APP_VERSION_KEY);

    if (!lastVersion) {
      // First time - store current version
      await AsyncStorage.setItem(LAST_APP_VERSION_KEY, currentVersion);
      return false;
    }

    const versionChanged = lastVersion !== currentVersion;
    if (versionChanged) {
      console.log(
        `[DegradedModeService] App version changed: ${lastVersion} → ${currentVersion}`
      );
      // Update stored version
      await AsyncStorage.setItem(LAST_APP_VERSION_KEY, currentVersion);
    }

    return versionChanged;
  } catch (error) {
    console.error('[DegradedModeService] Error checking app version:', error);
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
    const currentVersion = getCurrentAppVersion();

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
 * Check if we should retry migration (only if app version changed)
 */
export async function shouldRetryMigration(): Promise<boolean> {
  const state = await getDegradedModeState();
  const versionChanged = await hasAppVersionChanged();

  // Only retry if:
  // 1. We're in degraded mode AND
  // 2. App version has changed
  if (state.isDegraded && versionChanged) {
    console.log(
      '[DegradedModeService] App version changed - allowing migration retry'
    );
    return true;
  }

  if (state.isDegraded) {
    console.log(
      '[DegradedModeService] In degraded mode but app version unchanged - skipping retry'
    );
  }

  return false;
}

/**
 * Clear degraded mode state (called when migration succeeds)
 */
export async function clearDegradedMode(): Promise<void> {
  try {
    await Promise.all([
      AsyncStorage.removeItem(DEGRADED_MODE_KEY),
      AsyncStorage.removeItem(`${DEGRADED_MODE_KEY}:failed_version`),
      AsyncStorage.removeItem(MIGRATION_RETRY_COUNT_KEY)
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
