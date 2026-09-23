import { OfflineUndownloadWarning } from '@/components/OfflineUndownloadWarning';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useLocalization } from '@/hooks/useLocalization';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import type { QuestDownloadAction } from '@/utils/questDownloadGate';
import { storage } from '@/utils/storage';
import { useThemeColor } from '@/utils/styleUtils';
import { CircleArrowDownIcon, CloudUploadIcon } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator } from 'react-native';

interface QuestDownloadButtonProps {
  action: QuestDownloadAction;
  isDownloading: boolean;
  onDownload: () => void;
  onOffload: () => void;
}

/**
 * Labelled download control for a quest's own screen. The label names the
 * action the press will take, never the current status. Downloading needs a connection; offloading can start offline because the
 * offload drawer waits for one.
 */
export function QuestDownloadButton({
  action,
  isDownloading,
  onDownload,
  onOffload
}: QuestDownloadButtonProps) {
  const { t } = useLocalization();
  const isConnected = useNetworkStatus();
  const primaryColor = useThemeColor('primary');
  const [showOfflineWarning, setShowOfflineWarning] = React.useState(false);

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

  if (action === 'download') {
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

  if (action !== 'offload') return null;

  const handleOffloadPress = async () => {
    if (!isConnected && (await storage.getOfflineUndownloadWarningEnabled())) {
      setShowOfflineWarning(true);
      return;
    }
    onOffload();
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onPress={() => void handleOffloadPress()}
        testID="quest-header-offload"
        accessibilityLabel={t('offload')}
      >
        <Icon as={CloudUploadIcon} size={16} className="text-foreground" />
        <Text>{t('offload')}</Text>
      </Button>
      <OfflineUndownloadWarning
        visible={showOfflineWarning}
        onConfirm={() => {
          setShowOfflineWarning(false);
          onOffload();
        }}
        onCancel={() => setShowOfflineWarning(false)}
      />
    </>
  );
}
