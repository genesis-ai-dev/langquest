import { Button } from '@/components/ui/button';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useNavigationHelpers } from '@/hooks/useNavigation';
import { useLocalization } from '@/hooks/useLocalization';
import { usePowerSyncStatus } from '@/hooks/usePowerSyncStatus';
import { cn } from '@/utils/styleUtils';
import {
  AlertTriangle,
  CheckCircle2,
  CloudDownload,
  CloudOff,
  CloudUpload,
  RefreshCw,
  XCircle
} from 'lucide-react-native';
import React, { useMemo } from 'react';
import { ScrollView, View } from 'react-native';

export default function DownloadStatusView() {
  const { t } = useLocalization();
  const { goToProjects } = useNavigationHelpers();
  const powerSyncStatus = usePowerSyncStatus();

  const formattedLastSync = useMemo(() => {
    if (!powerSyncStatus.lastSyncedAt) {
      return t('never');
    }
    try {
      return powerSyncStatus.lastSyncedAt.toLocaleString();
    } catch {
      return powerSyncStatus.lastSyncedAt.toISOString();
    }
  }, [powerSyncStatus.lastSyncedAt, t]);

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="pb-safe android:pb-[calc(env(safe-area-inset-bottom)+1rem)]"
      testID="download-status-screen"
    >
      <View className="flex-1 gap-4 p-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-foreground">
            {t('downloadStatus')}
          </Text>
          <Button variant="ghost" size="icon" onPress={goToProjects}>
            <Icon as={RefreshCw} size={20} />
          </Button>
        </View>

        <Card>
          <CardHeader>
            <CardTitle className="flex-row items-center gap-2">
              <View className="flex-row items-center gap-2">
                <Icon
                  as={
                    powerSyncStatus.connected
                      ? CheckCircle2
                      : powerSyncStatus.connecting
                        ? RefreshCw
                        : CloudOff
                  }
                  size={20}
                  className={cn(
                    powerSyncStatus.connected
                      ? 'text-green-500'
                      : powerSyncStatus.connecting
                        ? 'text-yellow-500'
                        : 'text-destructive'
                  )}
                />
                <Text>{t('powersyncStatus')}</Text>
              </View>
            </CardTitle>
            <CardDescription>
              {powerSyncStatus.connected
                ? t('connected')
                : powerSyncStatus.connecting
                  ? t('connecting')
                  : t('disconnected')}
            </CardDescription>
          </CardHeader>
          <View className="gap-2 p-4 pt-0">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-muted-foreground">
                {t('lastSync')}
              </Text>
              <Text className="text-sm font-medium text-foreground">
                {formattedLastSync}
              </Text>
            </View>
            {powerSyncStatus.hasSynced === false && (
              <View className="flex-row items-center gap-2 rounded-md bg-yellow-500/20 p-2">
                <Icon
                  as={AlertTriangle}
                  size={16}
                  className="text-yellow-500"
                />
                <Text className="ml-2 flex-1 text-sm text-yellow-500">
                  {t('notSynced')}
                </Text>
              </View>
            )}
            {(powerSyncStatus.downloading || powerSyncStatus.uploading) && (
              <View className="flex-row items-center gap-2">
                {powerSyncStatus.downloading && (
                  <View className="flex-row items-center gap-2">
                    <Icon
                      as={CloudDownload}
                      size={16}
                      className="text-primary"
                    />
                    <Text className="ml-2 text-sm text-foreground">
                      {t('downloadingData')}
                    </Text>
                  </View>
                )}
                {powerSyncStatus.uploading && (
                  <View className="flex-row items-center gap-2">
                    <Icon as={CloudUpload} size={16} className="text-primary" />
                    <Text className="ml-2 text-sm text-foreground">
                      {t('uploadingData')}
                    </Text>
                  </View>
                )}
              </View>
            )}
            {(powerSyncStatus.downloadError || powerSyncStatus.uploadError) && (
              <View className="flex-row items-start gap-2 rounded-md bg-destructive/20 p-2">
                <Icon as={XCircle} size={16} className="text-destructive" />
                <View className="ml-2 flex-1">
                  <Text className="text-sm font-semibold text-destructive">
                    {t('syncError')}
                  </Text>
                  {powerSyncStatus.downloadError && (
                    <Text className="text-xs text-destructive">
                      Download: {powerSyncStatus.downloadError.message}
                    </Text>
                  )}
                  {powerSyncStatus.uploadError && (
                    <Text className="text-xs text-destructive">
                      Upload: {powerSyncStatus.uploadError.message}
                    </Text>
                  )}
                </View>
              </View>
            )}
          </View>
        </Card>
      </View>
    </ScrollView>
  );
}
