import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Updates from 'expo-updates';

// Set this to true to simulate an available update in development
const SIMULATE_UPDATE_AVAILABLE = false;

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
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
      },
      onError: (err) => {
        console.error('Error downloading update:', err);
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
