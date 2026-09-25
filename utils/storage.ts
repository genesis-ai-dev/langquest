import AsyncStorage from '@react-native-async-storage/async-storage';

import { useLocalStore } from '@/store/localStore';
const STORAGE_KEYS = {
  OFFLINE_UNDOWNLOAD_WARNING: '@offline_undownload_warning',
  RECORDING_HELP_SHOWN: '@recording_help_shown'
} as const;

export const storage = {
  async getOfflineUndownloadWarningEnabled(): Promise<boolean> {
    try {
      const state = useLocalStore.getState();
      return state.offlineUndownloadWarningEnabled;
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
      const { setOfflineUndownloadWarningEnabled } = useLocalStore.getState();
      setOfflineUndownloadWarningEnabled(enabled);
    } catch (error) {
      console.error(
        'Error saving offline undownload warning preference:',
        error
      );
    }
  },

  async hasRecordingHelpBeenShown(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(
        STORAGE_KEYS.RECORDING_HELP_SHOWN
      );
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
  }
};
