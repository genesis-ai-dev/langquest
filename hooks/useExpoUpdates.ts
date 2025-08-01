import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Updates from 'expo-updates';
import { useNetworkStatus } from './useNetworkStatus';

export function useExpoUpdates() {
  const queryClient = useQueryClient();
  const isConnected = useNetworkStatus();

  const {
    data: updateInfo,
    isLoading,
    refetch: checkForUpdate,
    error
  } = useQuery({
    queryKey: ['updates'],
    queryFn: async () => {
      const { isAvailable, ...update } = await Updates.checkForUpdateAsync();
      return {
        ...update,
        isUpdateAvailable: isAvailable
      };
    },
    // Check for updates less frequently
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    // Only check when online and not in development mode
    enabled: isConnected && !__DEV__
  });

  const downloadUpdateMutation = useMutation({
    mutationFn: async () => {
      if (!updateInfo?.isUpdateAvailable) {
        throw new Error('No update available');
      }
      await Updates.fetchUpdateAsync();
    },
    onSuccess: async () => {
      await Updates.reloadAsync();
      void queryClient.invalidateQueries({ queryKey: ['updates'] });
    }
  });

  return {
    updateInfo,
    isLoading,
    checkForUpdate,
    downloadUpdate: downloadUpdateMutation.mutateAsync,
    isDownloadingUpdate: downloadUpdateMutation.isPending,
    error
  };
}
