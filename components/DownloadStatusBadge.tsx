import { Icon } from '@/components/ui/icon';
import { useLocalization } from '@/hooks/useLocalization';
import { cn, useThemeColor } from '@/utils/styleUtils';
import { CloudIcon, HardDriveDownloadIcon } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';

export type DownloadStatus = 'cloud' | 'downloading' | 'downloaded';

interface DownloadStatusBadgeProps {
  status: DownloadStatus;
  size?: number;
  className?: string;
}

/**
 * Read-only download status. Uses different glyphs from the download
 * buttons so it never looks pressable.
 */
export function DownloadStatusBadge({
  status,
  size = 14,
  className
}: DownloadStatusBadgeProps) {
  const { t } = useLocalization();
  const primaryColor = useThemeColor('primary');

  const label =
    status === 'downloaded'
      ? t('downloaded')
      : status === 'downloading'
        ? t('download')
        : t('notDownloaded');

  return (
    <View
      accessible
      accessibilityLabel={label}
      pointerEvents="none"
      testID={`download-status-${status}`}
    >
      {status === 'downloading' ? (
        <ActivityIndicator size="small" color={primaryColor} />
      ) : (
        <Icon
          as={status === 'downloaded' ? HardDriveDownloadIcon : CloudIcon}
          size={size}
          className={cn('text-muted-foreground', className)}
        />
      )}
    </View>
  );
}
