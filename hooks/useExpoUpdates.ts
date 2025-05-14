import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';

// Set this to true to simulate an available update in development
const SIMULATE_UPDATE_AVAILABLE = false;

export function useExpoUpdates() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [checkingForUpdate, setCheckingForUpdate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkForUpdate = async () => {
    try {
      setCheckingForUpdate(true);
      setError(null);

      // In development, simulate update check based on flag
      if (__DEV__) {
        setUpdateAvailable(SIMULATE_UPDATE_AVAILABLE);
        return;
      }

      const update = await Updates.checkForUpdateAsync();
      setUpdateAvailable(update.isAvailable);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to check for update'
      );
      console.error('Error checking for update:', err);
    } finally {
      setCheckingForUpdate(false);
    }
  };

  const downloadAndReloadUpdate = async () => {
    try {
      setCheckingForUpdate(true);
      setError(null);

      // In development, simulate download delay
      if (__DEV__) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        console.log('Development mode: Simulated update download complete');
        return;
      }

      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to download update'
      );
      console.error('Error downloading update:', err);
    } finally {
      setCheckingForUpdate(false);
    }
  };

  useEffect(() => {
    void checkForUpdate();
  }, []);

  return {
    updateAvailable,
    checkingForUpdate,
    error,
    checkForUpdate,
    downloadAndReloadUpdate
  };
}
