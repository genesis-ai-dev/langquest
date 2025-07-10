import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Updates from 'expo-updates';
import { useHybridSupabaseQuery } from './useHybridSupabaseQuery';

export function useExpoUpdates() {
  const queryClient = useQueryClient();

  const {
    data: updateInfo,
    isLoading,
    refetch: checkForUpdate,
    error
  } = useHybridSupabaseQuery({
    queryKey: ['updates'],
    onlineFn: async () => {
      try {
        const update = await Updates.checkForUpdateAsync();
        return [
          {
            isUpdateAvailable: update.isAvailable,
            manifest: update.manifest || null
          }
        ] as Record<string, unknown>[];
      } catch (error) {
        console.error('Error checking for updates:', error);
        return [
          {
            isUpdateAvailable: false,
            manifest: null
          }
        ] as Record<string, unknown>[];
      }
    },
    offlineFn: () =>
      [{ isUpdateAvailable: false, manifest: null }] as Record<
        string,
        unknown
      >[],
    // Check for updates less frequently
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000 // 10 minutes
  });

  const downloadUpdateMutation = useMutation({
    mutationFn: async () => {
      if (!updateInfo?.[0]?.isUpdateAvailable) {
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
