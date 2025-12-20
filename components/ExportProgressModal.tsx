import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { shareExportLink, useExportStatus } from '@/hooks/useChapterExport';
import { useLocalization } from '@/hooks/useLocalization';
import {
  CheckCircleIcon,
  Share2Icon,
  XCircleIcon,
  XIcon
} from 'lucide-react-native';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

interface ExportProgressModalProps {
  exportId: string;
  visible: boolean;
  onClose: () => void;
}

export function ExportProgressModal({
  exportId,
  visible,
  onClose
}: ExportProgressModalProps) {
  const { t } = useLocalization();
  const { data: exportData, isLoading } = useExportStatus(exportId);

  useEffect(() => {
    // Auto-close when export is ready or failed
    if (exportData?.status === 'ready' || exportData?.status === 'failed') {
      // Don't auto-close, let user see the result
    }
  }, [exportData?.status]);

  const handleShare = async () => {
    if (exportData?.share_url) {
      await shareExportLink(exportData.share_url);
    }
  };

  return (
    <Drawer open={visible} onOpenChange={onClose} snapPoints={[300]}>
      <DrawerContent className="bg-background">
        <DrawerHeader className="flex-row items-center justify-between">
          <DrawerTitle>{t('exportProgress') || 'Export Progress'}</DrawerTitle>
          <DrawerClose variant="ghost" size="icon">
            <Icon as={XIcon} size={24} />
          </DrawerClose>
        </DrawerHeader>

        <View className="flex-col items-center gap-4 p-4">
          {isLoading ||
          exportData?.status === 'processing' ||
          exportData?.status === 'pending' ? (
            <>
              <ActivityIndicator size="large" />
              <Text className="text-center">
                {t('exporting') ||
                  'Exporting chapter... This may take a few moments.'}
              </Text>
            </>
          ) : exportData?.status === 'ready' ? (
            <>
              <Icon as={CheckCircleIcon} size={48} className="text-chart-3" />
              <Text className="text-center font-semibold">
                {t('exportReady') || 'Export is ready!'}
              </Text>
              {exportData.share_url && (
                <Button
                  onPress={handleShare}
                  className="w-full flex-row items-center gap-2"
                >
                  <Icon as={Share2Icon} size={16} />
                  <Text>{t('share') || 'Share'}</Text>
                </Button>
              )}
            </>
          ) : exportData?.status === 'failed' ? (
            <>
              <Icon as={XCircleIcon} size={48} className="text-destructive" />
              <Text className="text-center font-semibold">
                {t('exportFailed') || 'Export failed'}
              </Text>
              {exportData.error_message && (
                <Text className="text-center text-sm text-muted-foreground">
                  {exportData.error_message}
                </Text>
              )}
            </>
          ) : null}

          <Button variant="ghost" onPress={onClose} className="mt-2">
            <Text>{t('close') || 'Close'}</Text>
          </Button>
        </View>
      </DrawerContent>
    </Drawer>
  );
}
