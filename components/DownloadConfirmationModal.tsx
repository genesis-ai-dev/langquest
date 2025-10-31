import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { useLocalization } from '@/hooks/useLocalization';
import React from 'react';
import { Modal, View } from 'react-native';

interface DownloadConfirmationModalProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  downloadType: 'project' | 'quest';
  stats?: {
    totalAssets: number;
    totalTranslations?: number;
    totalQuests?: number;
  };
  discoveredCounts?: Record<string, number>;
}

export const DownloadConfirmationModal: React.FC<
  DownloadConfirmationModalProps
> = ({
  visible,
  onConfirm,
  onCancel,
  downloadType,
  stats,
  discoveredCounts
}) => {
  const { t } = useLocalization();

  const getConfirmationText = () => {
    // Use discoveredCounts if available (from new discovery system)
    if (discoveredCounts) {
      const items = Object.entries(discoveredCounts)
        .filter(([_, count]) => count > 0)
        .map(([category, count]) => `• ${count} ${category}`)
        .join('\n');

      const confirmMsg =
        downloadType === 'project'
          ? t('downloadProjectConfirmation')
          : t('downloadQuestConfirmation');

      return `${confirmMsg}\n\n${t('thisWillDownload')}\n${items}`;
    }

    // Fallback to old stats format
    if (downloadType === 'project') {
      return `${t('downloadProjectConfirmation')}\n\n${t('thisWillDownload')}\n• ${stats?.totalQuests || 0} ${t('quests')}\n• ${stats?.totalAssets || 0} ${t('assets')}\n• ${stats?.totalTranslations || 0} ${t('translations')}`;
    } else {
      return `${t('downloadQuestConfirmation')}\n\n${t('thisWillDownload')}\n• ${stats?.totalAssets || 0} ${t('assets')}\n• ${stats?.totalTranslations || 0} ${t('translations')}`;
    }
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onCancel}
    >
      <View className="flex-1 items-center justify-center bg-black/50 px-5">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">
              Download {downloadType === 'project' ? 'Project' : 'Quest'}
            </CardTitle>
          </CardHeader>

          <CardContent>
            <Text className="text-base leading-6">{getConfirmationText()}</Text>
          </CardContent>

          <CardFooter className="flex-row justify-between gap-3">
            <Button variant="outline" onPress={onCancel} className="flex-1">
              <Text>Cancel</Text>
            </Button>

            <Button variant="default" onPress={onConfirm} className="flex-1">
              <Text>Download</Text>
            </Button>
          </CardFooter>
        </Card>
      </View>
    </Modal>
  );
};
