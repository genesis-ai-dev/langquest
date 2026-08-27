import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer';
import { Icon } from '@/components/ui/icon';
import { Progress } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';
import { useLocalization } from '@/hooks/useLocalization';
import type {
  QuestUploadProgress,
  UploadCategoryProgress
} from '@/hooks/useQuestUploadProgress';
import { cn } from '@/utils/styleUtils';
import type { LucideIcon } from 'lucide-react-native';
import {
  AudioLinesIcon,
  CheckCircleIcon,
  DatabaseIcon,
  XIcon
} from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';

interface QuestUploadDetailsDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  questName?: string;
  progress: QuestUploadProgress;
  /** Omit to hide the publish action (e.g. quest is already published). */
  onPublishPress?: () => void;
  canPublish?: boolean;
  isPublishing?: boolean;
}

function ProgressBarRow({
  label,
  icon,
  progress
}: {
  label: string;
  icon: LucideIcon;
  progress: UploadCategoryProgress;
}) {
  const { total, confirmed } = progress;
  const isComplete = total > 0 && confirmed >= total;
  const percent = total === 0 ? 0 : Math.round((confirmed / total) * 100);

  return (
    <View className="gap-1.5 py-2">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Icon as={icon} size={16} className="text-muted-foreground" />
          <Text className="text-sm">{label}</Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <Text className="font-mono text-xs text-muted-foreground">
            {confirmed}/{total}
          </Text>
          {isComplete && (
            <Icon as={CheckCircleIcon} size={14} className="text-green-600" />
          )}
        </View>
      </View>
      <Progress
        value={percent}
        indicatorClassName={cn(isComplete ? 'bg-green-600' : 'bg-primary')}
      />
    </View>
  );
}

/**
 * Bottom drawer showing upload confirmation for a published quest: one bar
 * for information records (all synced tables combined) and one for audio
 * files. Also hosts the publish action (the toolbar button now opens this
 * drawer instead of publishing directly).
 */
export function QuestUploadDetailsDrawer({
  isOpen,
  onOpenChange,
  questName,
  progress,
  onPublishPress,
  canPublish = false,
  isPublishing = false
}: QuestUploadDetailsDrawerProps) {
  const { t } = useLocalization();
  const { breakdown } = progress;

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange} snapPoints={[420]}>
      <DrawerContent className="pb-safe">
        <DrawerHeader>
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <DrawerTitle>{t('uploadStatus')}</DrawerTitle>
              <Text className="text-sm text-muted-foreground">
                {progress.isEmpty
                  ? t('nothingPublishedYet')
                  : progress.isComplete
                    ? t('allUploadsConfirmed')
                    : t('percentConfirmedByServer').replace(
                        '{percent}',
                        String(progress.percent)
                      )}
                {questName ? ` · ${questName}` : ''}
              </Text>
            </View>
            <DrawerClose variant="ghost" size="icon">
              <Icon as={XIcon} size={24} />
            </DrawerClose>
          </View>
        </DrawerHeader>

        <View className="flex-col pb-2">
          <ProgressBarRow
            label={t('informationRecords')}
            icon={DatabaseIcon}
            progress={{
              total: progress.totalRecords,
              confirmed: progress.confirmedRecords
            }}
          />
          <ProgressBarRow
            label={t('audioFiles')}
            icon={AudioLinesIcon}
            progress={breakdown.audio}
          />
        </View>

        <View className="flex-row items-center justify-between rounded-lg bg-muted p-3">
          <Text className="text-sm font-semibold">{t('totalRecords')}:</Text>
          <Text className="font-mono text-sm text-muted-foreground">
            {progress.confirmedRecords + progress.confirmedAudio}/
            {progress.totalRecords + progress.totalAudio}
          </Text>
        </View>

        <DrawerFooter>
          {onPublishPress && (
            <Button
              onPress={onPublishPress}
              disabled={!canPublish}
              loading={isPublishing}
            >
              <Text className="font-bold">{t('publish')}</Text>
            </Button>
          )}
          <DrawerClose variant="outline">
            <Text>{t('cancel')}</Text>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
