import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { openAppStore } from '@/constants/storeUrls';
import { useExpoUpdates } from '@/hooks/useExpoUpdates';
import { useLocalization } from '@/hooks/useLocalization';
import { useStoreUpdate } from '@/hooks/useStoreUpdate';
import { CloudDownload, Store, XIcon } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';

// DEV ONLY: Import mock for testing
// To test OTA updates in development, uncomment the next 2 lines:
// import { useExpoUpdatesMock } from '@/hooks/useExpoUpdates.mock';
// const USE_MOCK = true;

export function UpdateBanner() {
  const { t } = useLocalization();
  const {
    updateInfo: otaUpdateInfo,
    isDownloadingUpdate,
    downloadUpdate,
    downloadError,
    dismissBanner: dismissOtaBanner
  } = useExpoUpdates();
  const { updateInfo: storeUpdateInfo, dismissBanner: dismissStoreBanner } =
    useStoreUpdate();

  const isOtaUpdate = otaUpdateInfo.isUpdateAvailable;
  const isStoreUpdate = !isOtaUpdate && storeUpdateInfo.isUpdateAvailable;

  if (!isOtaUpdate && !isStoreUpdate) {
    return null;
  }

  const handleOtaDownload = async () => {
    try {
      await downloadUpdate();
    } catch (error) {
      console.error('[UpdateBanner] OTA download failed:', error);
    }
  };

  const handleStoreUpdate = async () => {
    try {
      await openAppStore();
    } catch (error) {
      console.error('[UpdateBanner] Failed to open store:', error);
    }
  };

  const message = isOtaUpdate
    ? downloadError
      ? t('updateFailed')
      : t('updateAvailable')
    : t('storeUpdateAvailable');

  const handlePrimaryAction = isOtaUpdate
    ? handleOtaDownload
    : handleStoreUpdate;
  const handleDismiss = isOtaUpdate ? dismissOtaBanner : dismissStoreBanner;

  return (
    <View className="mt-safe flex-row items-center justify-between border-b border-border bg-card px-4 py-3">
      <View className="flex-1 flex-row items-center gap-2">
        <Icon
          as={isOtaUpdate ? CloudDownload : Store}
          size={20}
          className="text-primary"
        />
        <View className="flex-1">
          <Text className="text-sm font-medium">{message}</Text>
          {(isStoreUpdate || (isOtaUpdate && !downloadError)) && (
            <Text className="mt-0.5 text-xs text-muted-foreground">
              {t('storeUpdateWorkPreserved')}
            </Text>
          )}
          {isOtaUpdate && downloadError && (
            <Text className="mt-0.5 text-xs text-destructive">
              {t('updateErrorTryAgain')}
            </Text>
          )}
        </View>
      </View>
      <View className="flex-row items-center gap-2">
        <Button
          size="sm"
          onPress={handlePrimaryAction}
          disabled={isOtaUpdate && isDownloadingUpdate}
          className="h-8"
        >
          {isOtaUpdate && isDownloadingUpdate ? (
            <ActivityIndicator
              size="small"
              className="text-primary-foreground"
            />
          ) : (
            <Text className="text-sm font-medium text-primary-foreground">
              {isOtaUpdate && downloadError
                ? t('retry')
                : isOtaUpdate
                  ? t('updateNow')
                  : t('update')}
            </Text>
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onPress={handleDismiss}
          disabled={isOtaUpdate && isDownloadingUpdate}
        >
          <Icon as={XIcon} size={20} className="text-muted-foreground" />
        </Button>
      </View>
    </View>
  );
}
