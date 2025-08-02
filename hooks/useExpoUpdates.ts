import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Expo from 'expo';
import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';
import { useNetworkStatus } from './useNetworkStatus';

export function useExpoUpdates() {
  const queryClient = useQueryClient();
  const isConnected = useNetworkStatus();
  const [status, setStatus] = useState<
    'idle' | 'checking' | 'downloading' | 'reloading' | 'restarting'
  >('idle');

  useEffect(() => {
    console.log('update status', status);
  }, [status]);

  const {
    data: updateInfo,
    isLoading,
    refetch: checkForUpdate,
    error
  } = useQuery({
    queryKey: ['updates'],
    queryFn: async () => {
      setStatus('checking');
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
      setStatus('downloading');
      await Updates.fetchUpdateAsync();
    },
    onSuccess: async () => {
      setStatus('reloading');
      void queryClient.invalidateQueries({ queryKey: ['updates'] });
      await Updates.reloadAsync(); // reload without restarting app
    },
    onError: async (error) => {
      console.error('Error downloading update', error);
      setStatus('restarting');
      await Expo.reloadAppAsync(); // restart app entirely
    }
  });

  return {
    updateInfo,
    status,
    isLoading,
    checkForUpdate,
    downloadUpdate: downloadUpdateMutation.mutateAsync,
    isDownloadingUpdate: downloadUpdateMutation.isPending,
    error
  };
}
