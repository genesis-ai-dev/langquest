import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  OFFLINE_UNDOWNLOAD_WARNING: '@offline_undownload_warning'
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
  }
};
