import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKUP_SUFFIX = '-backup';

/**
 * Storage adapter that preserves a backup copy of session tokens.
 * When Supabase's internal _removeSession() calls removeItem, only the
 * primary key is deleted — the backup survives, allowing recovery.
 */
export const ResilientSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    return AsyncStorage.getItem(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    await AsyncStorage.setItem(key, value);
    if (isAuthTokenKey(key)) {
      await AsyncStorage.setItem(key + BACKUP_SUFFIX, value);
    }
  },

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    // Intentionally does NOT remove the backup key
  }
};

export function getBackupKey(primaryKey: string): string {
  return primaryKey + BACKUP_SUFFIX;
}

export async function getBackupSession(): Promise<string | null> {
  const keys = await AsyncStorage.getAllKeys();
  const backupKey = keys.find(
    (k) => k.startsWith('sb-') && k.endsWith('-auth-token' + BACKUP_SUFFIX)
  );
  if (!backupKey) return null;
  return AsyncStorage.getItem(backupKey);
}

export async function clearBackupSession(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const backupKeys = keys.filter((k) => k.endsWith('-auth-token' + BACKUP_SUFFIX));
  if (backupKeys.length > 0) {
    await AsyncStorage.multiRemove(backupKeys);
  }
}

function isAuthTokenKey(key: string): boolean {
  return key.startsWith('sb-') && key.endsWith('-auth-token');
}
