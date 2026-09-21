import { compareVersions } from '@/db/schemaVersionService';
import { system } from '@/db/powersync/system';
import {
  STORE_UPDATE_DISMISSAL_MS,
  getLatestStoreVersion,
  getStoreUrl,
  shouldShowStoreUpdateBanner,
  type SystemInfoRow
} from '@/hooks/storeUpdateAvailability';
import { useLocalStore } from '@/store/localStore';
import { getInstalledAppVersion } from '@/utils/appVersion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

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
      const timeRemaining = STORE_UPDATE_DISMISSAL_MS - timeSinceDismissal;

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

  const {
    data: updateInfo,
    isLoading,
    refetch,
    error
  } = useQuery({
    queryKey: ['store-updates'],
    queryFn: async () => {
      const installedVersion = getInstalledAppVersion();

      try {
        const { data, error: fetchError } =
          await system.supabaseConnector.client
            .from('system_info')
            .select(
              'ios_latest_version, android_latest_version, ios_store_url, android_store_url, banner_enabled'
            )
            .eq('id', 1)
            .single()
            .overrideTypes<SystemInfoRow>();

        const latestVersion = data ? getLatestStoreVersion(data) : null;

        console.log('[StoreUpdate]', {
          installedVersion,
          latestVersion,
          bannerEnabled: data?.banner_enabled,
          row: data,
          fetchError
        });

        if (fetchError) {
          throw fetchError;
        }

        const storeUrl = data ? getStoreUrl(data) : null;
        const bannerEnabled = data?.banner_enabled ?? false;

        if (!latestVersion) {
          return {
            isUpdateAvailable: false,
            latestVersion: null,
            storeUrl,
            installedVersion,
            bannerEnabled
          };
        }

        const isUpdateAvailable =
          compareVersions(installedVersion, latestVersion) < 0;

        return {
          isUpdateAvailable,
          latestVersion,
          storeUrl,
          installedVersion,
          bannerEnabled
        };
      } catch (checkError) {
        console.warn(
          '[StoreUpdate] Failed to check store version:',
          checkError
        );
        return {
          isUpdateAvailable: false,
          latestVersion: null,
          storeUrl: null,
          installedVersion,
          bannerEnabled: false
        };
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false
  });

  const handleDismiss = () => {
    if (updateInfo?.latestVersion) {
      dismissStoreUpdate(updateInfo.latestVersion);
    }
  };

  return {
    updateInfo: {
      storeUrl: null,
      ...updateInfo,
      isUpdateAvailable: shouldShowStoreUpdateBanner({
        bannerEnabled: updateInfo?.bannerEnabled ?? false,
        isUpdateAvailable: updateInfo?.isUpdateAvailable ?? false,
        latestVersion: updateInfo?.latestVersion ?? null,
        dismissedTimestamp: dismissedStoreUpdateTimestamp,
        dismissedVersion: dismissedStoreUpdateVersion
      })
    },
    isLoading,
    checkForUpdate: refetch,
    dismissBanner: handleDismiss,
    resetDismissal: resetStoreUpdateDismissal,
    error
  };
}
