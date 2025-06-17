import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Updates from 'expo-updates';
import { Alert } from 'react-native';

// Set this to true to simulate an available update in development
const SIMULATE_UPDATE_AVAILABLE = false;
const UPDATE_TIMEOUT_MS = 6000; // 6 seconds

export function useExpoUpdates() {
  const queryClient = useQueryClient();

  const {
    data: updateInfo,
    isError,
    error
  } = useQuery({
    queryKey: ['updates'],
    queryFn: async () => {
      if (__DEV__) {
        return { isAvailable: SIMULATE_UPDATE_AVAILABLE };
      }
      return await Updates.checkForUpdateAsync();
    }
  });

  const { mutate: downloadAndReloadUpdate, isPending: checkingForUpdate } =
    useMutation({
      mutationFn: async () => {
        if (__DEV__) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          console.log('Development mode: Simulated update download complete');
          return;
        }

        // Create a timeout promise
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('Update download timed out'));
          }, UPDATE_TIMEOUT_MS);
        });

        // Create the update promise
        const updatePromise = (async () => {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        })();

        // Race between timeout and update
        try {
          await Promise.race([updatePromise, timeoutPromise]);
        } catch (error) {
          if (
            error instanceof Error &&
            error.message === 'Update download timed out'
          ) {
            Alert.alert(
              'Update Timeout',
              'The update is taking longer than expected. Please restart the app to complete the update.',
              [
                {
                  text: 'OK',
                  onPress: () => {
                    // Try to reload anyway, which might help
                    Updates.reloadAsync().catch(() => {
                      // If reload fails, user will need to manually restart
                    });
                  }
                }
              ]
            );
            throw error;
          }
          throw error;
        }
      },
      onError: (err) => {
        if (
          err instanceof Error &&
          err.message !== 'Update download timed out'
        ) {
          Alert.alert(
            'Update Failed',
            'Failed to download the update. Please try again later.',
            [{ text: 'OK' }]
          );
        }
      }
    });

  return {
    updateAvailable: updateInfo?.isAvailable ?? false,
    checkingForUpdate,
    error: isError
      ? error instanceof Error
        ? error.message
        : 'Failed to check for update'
      : null,
    checkForUpdate: () =>
      queryClient.invalidateQueries({ queryKey: ['updates'] }),
    downloadAndReloadUpdate
  };
}
