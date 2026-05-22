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
import { useChapterExport, useExportStatus } from '@/hooks/useChapterExport';
import { useLocalization } from '@/hooks/useLocalization';
import * as Clipboard from 'expo-clipboard';
import { CopyIcon, GlobeIcon, Share2Icon } from 'lucide-react-native';
import React, { useState } from 'react';
import { View } from 'react-native';
import RNAlert from '@blazejkustra/react-native-alert';

import { FEATURE_FLAG_SHOW_FEEDBACK_EXPORT } from '@/utils/featureFlags';

interface ExportTypeSelectorProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (type: 'local' | 'feedback' | 'distribution') => void;
  showFeedbackExport: boolean;
  showDistributionExport: boolean;
  questId: string;
}

export function ExportTypeSelector({
  visible,
  onClose,
  onSelect,
  showFeedbackExport,
  showDistributionExport,
  questId
}: ExportTypeSelectorProps) {
  const { t } = useLocalization();
  const exportMutation = useChapterExport();
  const [feedbackExportId, setFeedbackExportId] = useState<string | null>(null);
  const [isCopyingLink, setIsCopyingLink] = useState(false);

  // Fetch export status if we have an export ID
  const { data: exportData } = useExportStatus(feedbackExportId);

  const handleCopyFeedbackLink = async () => {
    setIsCopyingLink(true);
    // Extract optional chaining before try/catch for React Compiler optimization
    const shareUrl = exportData?.share_url;
    // Extract logical expressions before try/catch for React Compiler optimization
    const successTitle = t('success');
    const linkCopiedMessage = t('linkCopied');
    const errorTitle = t('error');
    const exportFailedMessage = t('exportFailed');
    try {
      // If we already have an export with a share_url, use it
      if (shareUrl) {
        await Clipboard.setStringAsync(shareUrl);
        RNAlert.alert(successTitle, linkCopiedMessage);
        setIsCopyingLink(false);
        return;
      }

      // Otherwise, create a new export
      exportMutation.mutate(
        {
          quest_id: questId,
          export_type: 'feedback'
        },
        {
          onSuccess: (data) => {
            setFeedbackExportId(data.id);
            // If export is ready immediately, copy the link
            if (data.status === 'ready' && data.share_url) {
              Clipboard.setStringAsync(data.share_url)
                .then(() => {
                  RNAlert.alert(successTitle, linkCopiedMessage);
                  setIsCopyingLink(false);
                })
                .catch((error) => {
                  const errorMessage =
                    error instanceof Error
                      ? error.message
                      : exportFailedMessage;
                  RNAlert.alert(errorTitle, errorMessage);
                  setIsCopyingLink(false);
                });
            } else {
              // Export is processing, we'll copy when ready (handled by useExportStatus polling)
              setIsCopyingLink(false);
            }
          },
          onError: (error) => {
            const errorMessage = error.message || exportFailedMessage;
            RNAlert.alert(errorTitle, errorMessage);
            setIsCopyingLink(false);
          }
        }
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : exportFailedMessage;
      RNAlert.alert(errorTitle, errorMessage);
      setIsCopyingLink(false);
    }
  };

  // Copy link when export becomes ready
  React.useEffect(() => {
    if (
      exportData?.status === 'ready' &&
      exportData.share_url &&
      isCopyingLink
    ) {
      Clipboard.setStringAsync(exportData.share_url)
        .then(() => {
          RNAlert.alert(t('success'), t('linkCopied'));
          setIsCopyingLink(false);
        })
        .catch((error) => {
          RNAlert.alert(
            t('error'),
            error instanceof Error ? error.message : t('exportFailed')
          );
          setIsCopyingLink(false);
        });
    }
  }, [exportData, isCopyingLink, t]);

  return (
    <Drawer open={visible} onOpenChange={onClose} snapPoints={[300]}>
      <DrawerContent className="bg-background">
        <DrawerHeader className="flex-row items-center justify-between">
          <DrawerTitle>{t('selectExportType')}</DrawerTitle>
        </DrawerHeader>

        <View className="flex-col gap-3">
          <Button
            variant="outline"
            onPress={() => onSelect('local')}
            className="w-full flex-row items-center gap-3 p-4"
          >
            <Icon as={Share2Icon} size={20} />
            <View className="min-w-0 flex-1 flex-shrink flex-col gap-1">
              <Text className="font-semibold">{t('shareLocally')}</Text>
              <Text className="flex-shrink text-sm text-muted-foreground">
                {t('shareLocallyDescription')}
              </Text>
            </View>
          </Button>

          {FEATURE_FLAG_SHOW_FEEDBACK_EXPORT && showFeedbackExport && (
            <>
              <Button
                variant="outline"
                onPress={handleCopyFeedbackLink}
                disabled={isCopyingLink || exportMutation.isPending}
                className="w-full flex-row items-center gap-3 p-4"
              >
                <Icon as={CopyIcon} size={20} />
                <View className="min-w-0 flex-1 flex-shrink flex-col gap-1">
                  <Text className="font-semibold">{t('copyFeedbackLink')}</Text>
                  <Text className="flex-shrink text-sm text-muted-foreground">
                    {t('copyFeedbackLinkDescription')}
                  </Text>
                </View>
              </Button>
              <View className="rounded-lg bg-muted/50 p-3">
                <Text className="text-xs text-muted-foreground">
                  {t('feedbackLinkNote')}
                </Text>
              </View>
            </>
          )}

          {showDistributionExport && (
            <Button
              variant="outline"
              onPress={() => onSelect('distribution')}
              className="w-full flex-row items-center gap-3 p-4"
            >
              <Icon as={GlobeIcon} size={20} />
              <View className="min-w-0 flex-1 flex-shrink flex-col gap-1">
                <Text className="font-semibold">
                  {t('exportForDistribution')}
                </Text>
                <Text className="flex-shrink text-sm text-muted-foreground">
                  {t('exportForDistributionDescription')}
                </Text>
              </View>
            </Button>
          )}

          <DrawerClose className="flex flex-row gap-2">
            <Text>{t('cancel')}</Text>
          </DrawerClose>
        </View>
      </DrawerContent>
    </Drawer>
  );
}
