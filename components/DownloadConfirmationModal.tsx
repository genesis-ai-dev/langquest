import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer';
import { Text } from '@/components/ui/text';
import { useLocalization } from '@/hooks/useLocalization';
import React from 'react';

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

  const title =
    downloadType === 'project'
      ? t('downloadProject') || 'Download Project'
      : t('downloadQuest') || 'Download Quest';

  return (
    <Drawer
      open={visible}
      onOpenChange={(open) => {
        if (!open) {
          onCancel();
        }
      }}
    >
      <DrawerContent className="pb-safe">
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
        </DrawerHeader>

        <Text className="mb-4 text-base leading-6">
          {getConfirmationText()}
        </Text>

        <DrawerFooter className="gap-3">
          <Button variant="default" onPress={onConfirm}>
            <Text>Download</Text>
          </Button>

          <Button variant="outline" onPress={onCancel}>
            <Text>Cancel</Text>
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
