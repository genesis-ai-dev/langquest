import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Updates from 'expo-updates';

export function useExpoUpdates() {
  const queryClient = useQueryClient();

  const {
    data: updateInfo,
    isLoading,
    refetch: checkForUpdate,
    error
  } = useQuery({
    queryKey: ['updates'],
    queryFn: async () => {
      try {
        const update = await Updates.checkForUpdateAsync();
        return {
          isUpdateAvailable: update.isAvailable,
          manifest: update.manifest || null
        };
      } catch (error) {
        console.error('Error checking for updates:', error);
        return {
          isUpdateAvailable: false,
          manifest: null
        };
      }
    },
    // Check for updates less frequently
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    // Only check when online
    enabled: navigator.onLine
  });

  const downloadUpdateMutation = useMutation({
    mutationFn: async () => {
      if (!updateInfo?.isUpdateAvailable) {
        throw new Error('No update available');
      }
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    },
    onSuccess: () => {
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
