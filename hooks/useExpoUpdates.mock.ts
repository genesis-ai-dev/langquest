/**
 * Mock implementation of useExpoUpdates for testing OTA update UI
 * This simulates the behavior of expo-updates without requiring real updates
 */

import { useLocalStore } from '@/store/localStore';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

const DISMISSAL_DURATION = 10 * 1000; // 10 seconds for testing (normally 24 hours)

// Simulated update versions
const MOCK_UPDATES = [
  { id: 'update-v1', createdAt: '2025-01-01T00:00:00Z', message: 'Bug fixes' },
  {
    id: 'update-v2',
    createdAt: '2025-01-02T00:00:00Z',
    message: 'New features'
  },
  {
    id: 'update-v3',
    createdAt: '2025-01-03T00:00:00Z',
    message: 'Performance improvements'
  }
];

// Shared state across all hook instances (so debug controls and banner share state)
let currentMockUpdateIndex = 0;
let simulateErrorGlobal = false;

export function useExpoUpdatesMock() {
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

  // Only set up a timer if we're in a dismissed state
  // This invalidates the query when dismissal expires (more performant than constant polling)
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
        console.log('[MOCK] Setting timer to reappear in', timeRemaining, 'ms');
        timerRef.current = setTimeout(() => {
          console.log(
            '[MOCK] Dismissal expired! Invalidating query to show banner'
          );
          void queryClient.invalidateQueries({ queryKey: ['updates-mock'] });
        }, timeRemaining);
      }
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [dismissedUpdateTimestamp, queryClient]);

  // Simulate checking for updates
  const {
    data: updateInfo,
    isLoading,
    refetch: checkForUpdate
  } = useQuery({
    queryKey: ['updates-mock'],
    queryFn: async () => {
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      const currentUpdate = MOCK_UPDATES[currentMockUpdateIndex];

      console.log('[MOCK] Checking for updates...', currentUpdate);

      return {
        isUpdateAvailable: true, // Always available in mock
        manifest: currentUpdate
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
    retry: false
    // No refetchInterval - we use a timeout timer instead for better performance
  });

  // Simulate downloading update
  const downloadUpdateMutation = useMutation({
    mutationFn: async () => {
      console.log('[MOCK] Starting update download...');

      if (!updateInfo?.isUpdateAvailable) {
        throw new Error('No update available');
      }

      // Simulate download time
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Simulate error if global flag is set
      if (simulateErrorGlobal) {
        console.log('[MOCK] Simulating download error');
        throw new Error('Network error: Failed to download update');
      }

      console.log('[MOCK] Download complete! In real app, would reload now.');
      // In real app: await Updates.reloadAsync();
      // For mock, we just log and show success
      alert(
        'Mock: Update downloaded successfully! In real app, would reload now.'
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['updates-mock'] });
    }
  });

  // Determine if we should show the update banner
  const shouldShowBanner = () => {
    if (!updateInfo?.isUpdateAvailable) {
      return false;
    }

    const currentUpdateVersion =
      updateInfo.manifest?.createdAt || updateInfo.manifest?.id || 'unknown';

    // Never dismissed - show banner
    if (!dismissedUpdateTimestamp || !dismissedUpdateVersion) {
      console.log('[MOCK] Never dismissed - showing banner');
      return true;
    }

    // New version available (different from dismissed) - show banner
    if (currentUpdateVersion !== dismissedUpdateVersion) {
      console.log('[MOCK] New version available - showing banner');
      return true;
    }

    // Same version but 10 seconds passed (for testing) - show banner again
    const timeSinceDismissal = Date.now() - dismissedUpdateTimestamp;
    if (timeSinceDismissal >= DISMISSAL_DURATION) {
      console.log('[MOCK] Dismissal period ended - showing banner again');
      return true;
    }

    console.log('[MOCK] Still within dismissal period - hiding banner');
    return false;
  };

  // Handle dismissal
  const handleDismiss = () => {
    const currentUpdateVersion =
      updateInfo?.manifest?.createdAt || updateInfo?.manifest?.id || 'unknown';
    console.log('[MOCK] Dismissing update:', currentUpdateVersion);
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
    error: null,
    // Mock-specific test controls
    _mockControls: {
      simulateError: simulateErrorGlobal,
      setSimulateError: (value: boolean) => {
        simulateErrorGlobal = value;
        console.log('[MOCK] Error simulation:', value ? 'ENABLED' : 'DISABLED');
        // Trigger re-render by invalidating query
        void queryClient.invalidateQueries({ queryKey: ['updates-mock'] });
      },
      nextVersion: () => {
        currentMockUpdateIndex =
          (currentMockUpdateIndex + 1) % MOCK_UPDATES.length;
        void queryClient.invalidateQueries({ queryKey: ['updates-mock'] });
        console.log(
          '[MOCK] Switched to version:',
          MOCK_UPDATES[currentMockUpdateIndex]
        );
      },
      getCurrentVersion: () => MOCK_UPDATES[currentMockUpdateIndex]
    }
  };
}
