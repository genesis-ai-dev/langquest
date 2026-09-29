import { Icon } from '@/components/ui/icon';
import { useLocalization } from '@/hooks/useLocalization';
import { cn, useThemeColor } from '@/utils/styleUtils';
import { CircleArrowDownIcon, CircleCheckIcon } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';

export type DownloadStatus = 'cloud' | 'downloading' | 'downloaded';

interface DownloadStatusBadgeProps {
  status: DownloadStatus;
  size?: number;
  className?: string;
}

/**
 * Read-only download status. A check in a circle means the quest is on
 * the device. A down arrow in a circle means it is only in the cloud.
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
          as={status === 'downloaded' ? CircleCheckIcon : CircleArrowDownIcon}
          size={size}
          className={cn('text-muted-foreground', className)}
        />
      )}
    </View>
  );
}
