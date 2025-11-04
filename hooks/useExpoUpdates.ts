import { useLocalStore } from '@/store/localStore';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Updates from 'expo-updates';
import { useEffect, useRef } from 'react';

const DISMISSAL_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Helper function to extract version identifier from updateId UUID
export function getUpdateVersion(): string {
  const updateId = Updates.updateId;
  return updateId && updateId.length >= 8
    ? updateId.substring(0, 8)
    : 'unknown';
}

export function useExpoUpdates() {
  const queryClient = useQueryClient();
  const dismissedUpdateTimestamp = useLocalStore(
    (state) => state.dismissedUpdateTimestamp
  );
  const dismissedUpdateVersion = useLocalStore(
    (state) => state.dismissedUpdateVersion
  );
  const dismissUpdate = useLocalStore((state) => state.dismissUpdate);
  const resetUpdateDismissal = useLocalStore(
    (state) => state.resetUpdateDismissal
  );

  // Set up a timer to invalidate query when dismissal expires
  // More performant than constant polling
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // If dismissed, set a timer for when it should reappear
    if (dismissedUpdateTimestamp) {
      const timeSinceDismissal = Date.now() - dismissedUpdateTimestamp;
      const timeRemaining = DISMISSAL_DURATION - timeSinceDismissal;

      if (timeRemaining > 0) {
        console.log(
          '[Updates] Setting timer to reappear in',
          Math.round(timeRemaining / 1000 / 60),
          'minutes'
        );
        timerRef.current = setTimeout(() => {
          console.log('[Updates] Dismissal expired! Checking for updates');
          void queryClient.invalidateQueries({ queryKey: ['updates'] });
        }, timeRemaining);
      }
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [dismissedUpdateTimestamp, queryClient]);

  const {
    data: updateInfo,
    isLoading,
    refetch: checkForUpdate,
    error
  } = useQuery({
    queryKey: ['updates'],
    queryFn: async () => {
      if (__DEV__)
        return {
          isUpdateAvailable: false,
          manifest: null
        };
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
    // expo-updates handles offline gracefully, so always enable
    retry: false // Don't retry on failure, check will happen again after staleTime
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

  // Determine if we should show the update banner
  const shouldShowBanner = () => {
    if (!updateInfo?.isUpdateAvailable) {
      return false;
    }

    // Get current update version (use first 8 chars of updateId UUID as version identifier)
    const currentUpdateVersion = getUpdateVersion();

    // Never dismissed - show banner
    if (!dismissedUpdateTimestamp || !dismissedUpdateVersion) {
      return true;
    }

    // New version available (different from dismissed) - show banner
    if (currentUpdateVersion !== dismissedUpdateVersion) {
      return true;
    }

    // Same version but 24 hours passed - show banner again
    const timeSinceDismissal = Date.now() - dismissedUpdateTimestamp;
    if (timeSinceDismissal >= DISMISSAL_DURATION) {
      return true;
    }

    // Still within dismissal period for this version
    return false;
  };

  // Handle dismissal
  const handleDismiss = () => {
    const currentUpdateVersion = getUpdateVersion();
    dismissUpdate(currentUpdateVersion);
  };

  return {
    updateInfo: {
      ...updateInfo,
      isUpdateAvailable: shouldShowBanner()
    },
    isLoading,
    checkForUpdate,
    downloadUpdate: downloadUpdateMutation.mutateAsync,
    isDownloadingUpdate: downloadUpdateMutation.isPending,
    downloadError: downloadUpdateMutation.error,
    dismissBanner: handleDismiss,
    resetDismissal: resetUpdateDismissal,
    error
  };
}
