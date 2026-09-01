import {
  compareVersions,
  fetchServerSchemaInfo
} from '@/db/schemaVersionService';
import { system } from '@/db/powersync/system';
import { useLocalStore } from '@/store/localStore';
import { getInstalledAppVersion } from '@/utils/appVersion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

const DISMISSAL_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export function useStoreUpdate() {
  const queryClient = useQueryClient();
  const dismissedStoreUpdateTimestamp = useLocalStore(
    (state) => state.dismissedStoreUpdateTimestamp
  );
  const dismissedStoreUpdateVersion = useLocalStore(
    (state) => state.dismissedStoreUpdateVersion
  );
  const dismissStoreUpdate = useLocalStore((state) => state.dismissStoreUpdate);
  const resetStoreUpdateDismissal = useLocalStore(
    (state) => state.resetStoreUpdateDismissal
  );

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (dismissedStoreUpdateTimestamp) {
      const timeSinceDismissal = Date.now() - dismissedStoreUpdateTimestamp;
      const timeRemaining = DISMISSAL_DURATION - timeSinceDismissal;

      if (timeRemaining > 0) {
        timerRef.current = setTimeout(() => {
          void queryClient.invalidateQueries({ queryKey: ['store-updates'] });
        }, timeRemaining);
      }
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [dismissedStoreUpdateTimestamp, queryClient]);

  const { data: updateInfo, isLoading, refetch, error } = useQuery({
    queryKey: ['store-updates'],
    queryFn: async () => {
      const installedVersion = getInstalledAppVersion();

      try {
        const schemaInfo = await fetchServerSchemaInfo(
          system.supabaseConnector.client
        );
        const latestVersion = schemaInfo.latest_app_version;

        if (!latestVersion) {
          return {
            isUpdateAvailable: false,
            latestVersion: null,
            installedVersion
          };
        }

        const isUpdateAvailable =
          compareVersions(installedVersion, latestVersion) < 0;

        return {
          isUpdateAvailable,
          latestVersion,
          installedVersion
        };
      } catch (checkError) {
        console.warn('[StoreUpdate] Failed to check store version:', checkError);
        return {
          isUpdateAvailable: false,
          latestVersion: null,
          installedVersion
        };
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false
  });

  const shouldShowBanner = () => {
    if (!updateInfo?.isUpdateAvailable || !updateInfo.latestVersion) {
      return false;
    }

    const currentVersion = updateInfo.latestVersion;

    if (!dismissedStoreUpdateTimestamp || !dismissedStoreUpdateVersion) {
      return true;
    }

    if (currentVersion !== dismissedStoreUpdateVersion) {
      return true;
    }

    const timeSinceDismissal = Date.now() - dismissedStoreUpdateTimestamp;
    return timeSinceDismissal >= DISMISSAL_DURATION;
  };

  const handleDismiss = () => {
    if (updateInfo?.latestVersion) {
      dismissStoreUpdate(updateInfo.latestVersion);
    }
  };

  return {
    updateInfo: {
      ...updateInfo,
      isUpdateAvailable: shouldShowBanner()
    },
    isLoading,
    checkForUpdate: refetch,
    dismissBanner: handleDismiss,
    resetDismissal: resetStoreUpdateDismissal,
    error
  };
}
