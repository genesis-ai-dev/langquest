import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useLocalization } from '@/hooks/useLocalization';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import type { QuestDownloadAction } from '@/utils/questDownloadGate';
import { useThemeColor } from '@/utils/styleUtils';
import { CircleArrowDownIcon } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator } from 'react-native';

interface QuestDownloadButtonProps {
  action: QuestDownloadAction;
  isDownloading: boolean;
  onDownload: () => void;
}

/**
 * Labelled download control for a quest's own screen. The label names the
 * action the press will take, never the current status. Downloading needs a
 * connection.
 */
export function QuestDownloadButton({
  action,
  isDownloading,
  onDownload
}: QuestDownloadButtonProps) {
  const { t } = useLocalization();
  const isConnected = useNetworkStatus();
  const primaryColor = useThemeColor('primary');

  if (isDownloading) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        testID="quest-header-download"
      >
        <ActivityIndicator size="small" color={primaryColor} />
        <Text>{t('download')}</Text>
      </Button>
    );
  }

  if (action !== 'download') return null;

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={!isConnected}
      onPress={onDownload}
      testID="quest-header-download"
      accessibilityLabel={t('download')}
    >
      <Icon as={CircleArrowDownIcon} size={16} className="text-foreground" />
      <Text>{t('download')}</Text>
    </Button>
  );
}
