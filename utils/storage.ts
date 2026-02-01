import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  OFFLINE_UNDOWNLOAD_WARNING: '@offline_undownload_warning',
  RECORDING_HELP_SHOWN: '@recording_help_shown'
} as const;

export const storage = {
  async getOfflineUndownloadWarningEnabled(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(
        STORAGE_KEYS.OFFLINE_UNDOWNLOAD_WARNING
      );
      return value === null ? true : value === 'true';
    } catch (error) {
      console.error(
        'Error reading offline undownload warning preference:',
        error
      );
      return true; // Default to showing warning if there's an error
    }
  },

  async setOfflineUndownloadWarningEnabled(enabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.OFFLINE_UNDOWNLOAD_WARNING,
        enabled.toString()
      );
    } catch (error) {
      console.error(
        'Error saving offline undownload warning preference:',
        error
      );
    }
  },

  async hasRecordingHelpBeenShown(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(STORAGE_KEYS.RECORDING_HELP_SHOWN);
      console.log('[storage] RECORDING_HELP_SHOWN value:', value);
      return value === 'true';
    } catch (error) {
      console.error('Error reading recording help shown state:', error);
      return false;
    }
  },

  async setRecordingHelpShown(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.RECORDING_HELP_SHOWN, 'true');
      console.log('[storage] Recording help marked as shown');
    } catch (error) {
      console.error('Error saving recording help shown state:', error);
    }
  },

  // For testing: reset the recording help shown state
  async resetRecordingHelpShown(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.RECORDING_HELP_SHOWN);
      console.log('[storage] Recording help state reset');
    } catch (error) {
      console.error('Error resetting recording help shown state:', error);
    }
  }
};

export const getItemSizeInBytes = (value: string): number => {
  // Simple byte length calculation for React Native
  let bytes = 0;
  for (let i = 0; i < value.length; i++) {
    const charCode = value.charCodeAt(i);
    if (charCode < 0x80) bytes += 1;
    else if (charCode < 0x800) bytes += 2;
    else if (charCode < 0xd800 || charCode >= 0xe000) bytes += 3;
    else bytes += 4; // surrogate pair
  }
  return bytes;
};

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const filterOldAttachmentIds = (attachmentIds: string[]): string[] => {
  // Implement logic to filter out old attachment IDs if needed
  return attachmentIds;
};

/**
 * Check AsyncStorage usage and clear old data if needed
 */
export const checkAndClearStorage = async (): Promise<void> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    let totalSize = 0;

    // Calculate total storage size
    for (const key of keys) {
      const value = await AsyncStorage.getItem(key);
      if (value) {
        totalSize += getItemSizeInBytes(value);
      }
    }

    console.log(
      `[Storage] Total AsyncStorage usage: ${formatBytes(totalSize)}`
    );

    // If storage is over 50MB, clear old cache data
    if (totalSize > 50 * 1024 * 1024) {
      console.log('[Storage] Storage exceeds 50MB, clearing old cache...');

      // Clear React Query cache keys (they often start with 'REACT_QUERY')
      const cacheKeys = keys.filter(
        (key) =>
          key.includes('REACT_QUERY') ||
          key.includes('cache') ||
          key.includes('temp_')
      );

      await AsyncStorage.multiRemove(cacheKeys);
      console.log(`[Storage] Cleared ${cacheKeys.length} cache keys`);
    }
  } catch (error) {
    console.error('[Storage] Error checking/clearing storage:', error);
  }
};

/**
 * Clear all temporary and cache data
 */
export const clearAllCacheData = async (): Promise<void> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(
      (key) =>
        key.includes('REACT_QUERY') ||
        key.includes('cache') ||
        key.includes('temp_') ||
        key.includes('pending_') ||
        !key.includes('auth') // Don't clear auth data
    );

    await AsyncStorage.multiRemove(cacheKeys);
    console.log(`[Storage] Cleared ${cacheKeys.length} cache keys`);
  } catch (error) {
    console.error('[Storage] Error clearing cache:', error);
  }
};

/**
 * Get storage info for debugging
 */
export const getStorageInfo = async (): Promise<{
  totalKeys: number;
  totalSize: string;
  breakdown: { key: string; size: string }[];
}> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    let totalSize = 0;
    const breakdown: { key: string; size: string }[] = [];

    for (const key of keys) {
      const value = await AsyncStorage.getItem(key);
      if (value) {
        const size = getItemSizeInBytes(value);
        totalSize += size;
        breakdown.push({ key, size: formatBytes(size) });
      }
    }

    // Sort by size descending
    breakdown.sort((a, b) => {
      const aSize = parseFloat(a.size);
      const bSize = parseFloat(b.size);
      return bSize - aSize;
    });

    return {
      totalKeys: keys.length,
      totalSize: formatBytes(totalSize),
      breakdown: breakdown.slice(0, 20) // Top 20 largest items
    };
  } catch (error) {
    console.error('[Storage] Error getting storage info:', error);
    return {
      totalKeys: 0,
      totalSize: '0 Bytes',
      breakdown: []
    };
  }
};
