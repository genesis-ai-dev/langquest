import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Progress } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useAttachmentProgress } from '@/hooks/useAttachmentProgress';
import { useLocalization } from '@/hooks/useLocalization';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
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
  const { goToProjects } = useAppNavigation();
  const { isAuthenticated } = useAuth();
  const isConnected = useNetworkStatus();

  // Get PowerSync status (memoized to prevent re-renders)
  const powerSyncStatus = usePowerSyncStatus();

  // Get attachment progress (only when authenticated)
  const { progress, syncProgress, isLoading } =
    useAttachmentProgress(isAuthenticated);

  // Format last sync time
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

  // Format download speed
  const formattedDownloadSpeed = useMemo(() => {
    if (!syncProgress.downloading || !('downloadSpeed' in syncProgress)) {
      return null;
    }

    const speed = (
      syncProgress as typeof syncProgress & {
        downloadSpeed: number;
        downloadBytesPerSec: number;
      }
    ).downloadSpeed;
    if (speed <= 0) {
      return null;
    }

    const bytesPerSec =
      (
        syncProgress as typeof syncProgress & {
          downloadSpeed: number;
          downloadBytesPerSec: number;
        }
      ).downloadBytesPerSec ?? 0;

    const filesPerSec = speed.toFixed(1);

    if (bytesPerSec > 1024 * 1024) {
      return `${filesPerSec} files/s • ${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
    } else if (bytesPerSec > 1024) {
      return `${filesPerSec} files/s • ${(bytesPerSec / 1024).toFixed(1)} KB/s`;
    } else if (bytesPerSec > 0) {
      return `${filesPerSec} files/s`;
    }

    return `${filesPerSec} files/s`;
  }, [
    syncProgress.downloading,
    'downloadSpeed' in syncProgress ? syncProgress.downloadSpeed : 0,
    'downloadBytesPerSec' in syncProgress ? syncProgress.downloadBytesPerSec : 0
  ]);

  // Calculate download progress percentage
  const downloadProgressPercentage = useMemo(() => {
    if (syncProgress.downloadTotal === 0) return 0;
    return (syncProgress.downloadCurrent / syncProgress.downloadTotal) * 100;
  }, [syncProgress.downloadCurrent, syncProgress.downloadTotal]);

  // Calculate attachment sync percentage
  const attachmentSyncPercentage = useMemo(() => {
    if (progress.total === 0) return 0;
    return (progress.synced / progress.total) * 100;
  }, [progress.synced, progress.total]);

  return (
    <ScrollView className="flex-1 bg-background">
      <View className="flex-1 gap-4 p-4">
        {/* Header */}
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-foreground">
            {t('downloadStatus') || 'Download Status'}
          </Text>
          <Button variant="ghost" size="icon" onPress={goToProjects}>
            <Icon as={RefreshCw} size={20} />
          </Button>
        </View>

        {/* PowerSync Connection Status */}
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
                <Text>{t('powersyncStatus') || 'PowerSync Status'}</Text>
              </View>
            </CardTitle>
            <CardDescription>
              {powerSyncStatus.connected
                ? t('connected') || 'Connected'
                : powerSyncStatus.connecting
                  ? t('connecting') || 'Connecting...'
                  : t('disconnected') || 'Disconnected'}
            </CardDescription>
          </CardHeader>
          <View className="gap-2 p-4 pt-0">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-muted-foreground">
                {t('lastSync') || 'Last Sync'}
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
                  {t('notSynced') || 'Not yet synced'}
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
                      {t('downloadingData') || 'Downloading data...'}
                    </Text>
                  </View>
                )}
                {powerSyncStatus.uploading && (
                  <View className="flex-row items-center gap-2">
                    <Icon as={CloudUpload} size={16} className="text-primary" />
                    <Text className="ml-2 text-sm text-foreground">
                      {t('uploadingData') || 'Uploading data...'}
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
                    {t('syncError') || 'Sync Error'}
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

        {/* Network Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex-row items-center gap-2">
              <View className="flex-row items-center gap-2">
                <Icon
                  as={isConnected ? CheckCircle2 : CloudOff}
                  size={20}
                  className={cn(
                    isConnected ? 'text-green-500' : 'text-destructive'
                  )}
                />
                <Text>{t('networkStatus') || 'Network Status'}</Text>
              </View>
            </CardTitle>
            <CardDescription>
              {isConnected
                ? t('online') || 'Online'
                : t('offline') || 'Offline'}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Attachment Download Progress */}
        {isAuthenticated && (
          <Card>
            <CardHeader>
              <CardTitle className="flex-row items-center gap-2">
                <Icon as={CloudDownload} size={20} className="text-primary" />
                <Text className="ml-1">
                  {t('attachmentDownloadProgress') ||
                    'Attachment Download Progress'}
                </Text>
              </CardTitle>
              <CardDescription>
                {isLoading
                  ? t('loading') || 'Loading...'
                  : progress.hasActivity
                    ? t('downloading') || 'Downloading...'
                    : t('allSynced') || 'All files synced'}
              </CardDescription>
            </CardHeader>
            <View className="gap-4 p-4 pt-0">
              {/* Overall Progress */}
              <View className="gap-2">
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-medium text-foreground">
                    {t('overallProgress') || 'Overall Progress'}
                  </Text>
                  <Text className="text-sm text-muted-foreground">
                    {progress.synced}/{progress.total} {t('files') || 'files'}
                  </Text>
                </View>
                <Progress value={attachmentSyncPercentage} className="h-2" />
              </View>

              {/* Current Download Progress */}
              {syncProgress.downloading && (
                <View className="gap-2">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-medium text-foreground">
                      {t('currentDownload') || 'Current Download'}
                    </Text>
                    <Text className="text-sm text-muted-foreground">
                      {syncProgress.downloadCurrent}/
                      {syncProgress.downloadTotal}
                    </Text>
                  </View>
                  <Progress
                    value={downloadProgressPercentage}
                    className="h-2"
                  />
                  {formattedDownloadSpeed && (
                    <View className="flex-row justify-end">
                      <Badge className="bg-muted px-2 py-1">
                        <Text className="text-xs text-muted-foreground">
                          {formattedDownloadSpeed}
                        </Text>
                      </Badge>
                    </View>
                  )}
                </View>
              )}

              {/* Current Upload Progress */}
              {syncProgress.uploading && (
                <View className="gap-2">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-medium text-foreground">
                      {t('currentUpload')}
                    </Text>
                    <Text className="text-sm text-muted-foreground">
                      {syncProgress.uploadCurrent}/{syncProgress.uploadTotal}
                    </Text>
                  </View>
                  <Progress
                    value={
                      syncProgress.uploadTotal === 0
                        ? 0
                        : (syncProgress.uploadCurrent /
                            syncProgress.uploadTotal) *
                          100
                    }
                    className="h-2"
                  />
                </View>
              )}

              {/* Queue Status */}
              <View className="gap-2">
                <Text className="text-sm font-medium text-foreground">
                  {t('queueStatus') || 'Queue Status'}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  <Badge
                    variant={progress.synced > 0 ? 'default' : 'secondary'}
                    className="px-3 py-1"
                  >
                    <Text className="text-xs">
                      {t('synced') || 'Synced'}: {progress.synced}
                    </Text>
                  </Badge>
                  {progress.downloading > 0 && (
                    <Badge variant="default" className="bg-blue-500 px-3 py-1">
                      <Text className="text-xs">
                        {t('downloading') || 'Downloading'}:{' '}
                        {progress.downloading}
                      </Text>
                    </Badge>
                  )}
                  {progress.uploading > 0 && (
                    <Badge variant="default" className="bg-green-500 px-3 py-1">
                      <Text className="text-xs">
                        {t('uploading')}: {progress.uploading}
                      </Text>
                    </Badge>
                  )}
                  {progress.queued > 0 && (
                    <Badge variant="secondary" className="px-3 py-1">
                      <Text className="text-xs">
                        {t('queued') || 'Queued'}: {progress.queued}
                      </Text>
                    </Badge>
                  )}
                  {progress.unsynced > 0 && (
                    <Badge variant="outline" className="px-3 py-1">
                      <Text className="text-xs">
                        {t('unsynced') || 'Unsynced'}: {progress.unsynced}
                      </Text>
                    </Badge>
                  )}
                </View>
              </View>
            </View>
          </Card>
        )}

        {/* Anonymous User Message */}
        {!isAuthenticated && (
          <Card>
            <CardHeader>
              <CardTitle>{t('signInRequired') || 'Sign In Required'}</CardTitle>
              <CardDescription>
                {t('signInToViewDownloadStatus') ||
                  'Please sign in to view download status and sync information.'}
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </View>
    </ScrollView>
  );
}
