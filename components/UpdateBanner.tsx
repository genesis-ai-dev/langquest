import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useExpoUpdates } from '@/hooks/useExpoUpdates';
import { useLocalization } from '@/hooks/useLocalization';
import { CloudDownload, XIcon } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, TouchableOpacity, View } from 'react-native';

// DEV ONLY: Import mock for testing
// To test OTA updates in development, uncomment the next 2 lines:
// import { useExpoUpdatesMock } from '@/hooks/useExpoUpdates.mock';
// const USE_MOCK = true;

export function UpdateBanner() {
  // useLocalization has built-in fallbacks to English, so it should work even before login
  const { t } = useLocalization();
  const {
    updateInfo,
    isDownloadingUpdate,
    downloadUpdate,
    downloadError,
    dismissBanner
  } = useExpoUpdates(); // In production, always use real updates

  // For testing, replace above with: USE_MOCK ? useExpoUpdatesMock() : useExpoUpdates()

  if (!updateInfo.isUpdateAvailable) {
    return null;
  }

  const handleDownload = async () => {
    try {
      await downloadUpdate();
    } catch (error) {
      console.error('[UpdateBanner] Download failed:', error);
      // Error is tracked in downloadError, will show in UI
    }
  };

  return (
    <View className="mt-safe flex-row items-center justify-between border-b border-border bg-card px-4 py-3">
      <View className="flex-1 flex-row items-center gap-2">
        <Icon as={CloudDownload} size={20} className="text-primary" />
        <View className="flex-1">
          <Text className="text-sm font-medium">
            {downloadError ? t('updateFailed') : t('updateAvailable')}
          </Text>
          {downloadError && (
            <Text className="mt-0.5 text-xs text-destructive">
              {t('updateErrorTryAgain')}
            </Text>
          )}
        </View>
      </View>
      <View className="flex-row items-center gap-2">
        <Button
          size="sm"
          onPress={handleDownload}
          disabled={isDownloadingUpdate}
          className="h-8"
        >
          {isDownloadingUpdate ? (
            <ActivityIndicator
              size="small"
              className="text-primary-foreground"
            />
          ) : (
            <Text className="text-sm font-medium text-primary-foreground">
              {downloadError ? t('retry') : t('updateNow')}
            </Text>
          )}
        </Button>
        <TouchableOpacity
          onPress={dismissBanner}
          disabled={isDownloadingUpdate}
          className="p-1"
        >
          <Icon as={XIcon} size={20} className="text-muted-foreground" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
