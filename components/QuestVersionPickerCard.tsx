import type { CardMenuAction } from '@/components/CardMenu';
import { CardMenu } from '@/components/CardMenu';
import { DownloadIndicator } from '@/components/DownloadIndicator';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { updateQuestStatus } from '@/database_services/status/quest';
import { useLocalization } from '@/hooks/useLocalization';
import type { LocalizationKey } from '@/services/localizations';
import { formatRelativeDate } from '@/utils/dateUtils';
import { cn } from '@/utils/styleUtils';
import type { HybridDataSource } from '@/views/new/useHybridData';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import RNAlert from '@blazejkustra/react-native-alert';
import {
  EyeIcon,
  EyeOffIcon,
  HardDriveIcon,
  TrashIcon
} from 'lucide-react-native';
import React from 'react';
import { Pressable, View } from 'react-native';

function noop() {
  return undefined;
}

function getCardMenuActions(
  isPublished: boolean,
  canManage: boolean,
  isHidden: boolean,
  t: (key: LocalizationKey) => string,
  onHide: () => void,
  onUnhide: () => void
): CardMenuAction[] {
  if (!isPublished) {
    return [
      {
        id: 'delete',
        icon: TrashIcon,
        onPress: noop,
        confirmTitle: t('deleteQuestTitle'),
        confirmMessage: t('deleteQuestDescription'),
        tone: 'destructive'
      }
    ];
  }
  if (canManage && isHidden) {
    return [
      {
        id: 'unhide',
        icon: EyeIcon,
        onPress: onUnhide,
        confirmTitle: t('unhideQuestTitle'),
        confirmMessage: t('unhideQuestDescription')
      }
    ];
  }
  if (canManage) {
    return [
      {
        id: 'hide',
        icon: EyeOffIcon,
        onPress: onHide,
        confirmTitle: t('hideQuestTitle'),
        confirmMessage: t('hideQuestDescription')
      }
    ];
  }
  return [];
}

function resolveQuestSource(
  isLocal: boolean,
  isCloud: boolean
): HybridDataSource {
  if (isLocal) return 'local';
  if (isCloud) return 'cloud';
  return 'synced';
}

export interface QuestVersionPickerCardProps {
  questId: string;
  versionLabel?: string | null;
  creatorName?: string | null;
  isCurrentUser: boolean;
  createdAt: string;
  isLocal: boolean;
  isCloud: boolean;
  isDownloaded: boolean;
  isDownloading: boolean;
  visible?: boolean;
  canManage: boolean;
  onPress: () => void;
  onDownloadClick: () => void;
}

function buildPrimaryLabel(
  creatorName: string,
  isCurrentUser: boolean,
  versionLabel: string | null | undefined
): string {
  const creatorLine = `${creatorName}${isCurrentUser ? ' (you)' : ''}`;
  const trimmedLabel = versionLabel?.trim();
  return trimmedLabel ? `${creatorLine} · ${trimmedLabel}` : creatorLine;
}

function buildSecondaryLabel(
  isCurrentUser: boolean,
  isLocal: boolean,
  createdAt: string
): string {
  const parts: string[] = [];
  if (isCurrentUser && isLocal) {
    parts.push('Draft');
  }
  parts.push(formatRelativeDate(createdAt));
  return parts.join(' · ');
}

/**
 * Card for picking among multiple quest versions (Bible chapter / FIA pericope).
 */
export function QuestVersionPickerCard({
  questId,
  versionLabel,
  creatorName,
  isCurrentUser,
  createdAt,
  isLocal,
  isCloud,
  isDownloaded,
  isDownloading,
  visible = true,
  canManage,
  onPress,
  onDownloadClick
}: QuestVersionPickerCardProps) {
  const { t } = useLocalization();
  const queryClient = useQueryClient();
  const questSource = resolveQuestSource(isLocal, isCloud);

  const { mutate: setQuestVisibility } = useMutation({
    mutationFn: async (nextVisible: boolean) => {
      await updateQuestStatus(questId, { visible: nextVisible }, questSource);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['bible-chapters'] });
      await queryClient.invalidateQueries({
        queryKey: ['fia-pericope-quests']
      });
      await queryClient.invalidateQueries({ queryKey: ['quest-settings'] });
      await queryClient.invalidateQueries({ queryKey: ['quest'] });
    },
    onError: () => {
      RNAlert.alert(t('error'), t('failedToUpdateQuestSettings'));
    }
  });

  const handleHide = () => {
    setQuestVisibility(false);
  };

  const handleUnhide = () => {
    setQuestVisibility(true);
  };

  const displayCreator = creatorName?.trim() || 'Unknown';
  const isPublished = !isLocal;
  const menuActions = getCardMenuActions(
    isPublished,
    canManage,
    !visible,
    t,
    handleHide,
    handleUnhide
  );
  const needsDownload = isCloud && !isDownloaded;
  const avatarInitial = displayCreator.charAt(0).toUpperCase();
  const primaryLabel = buildPrimaryLabel(
    displayCreator,
    isCurrentUser,
    versionLabel
  );
  const secondaryLabel = buildSecondaryLabel(isCurrentUser, isLocal, createdAt);

  return (
    <Pressable
      onPress={needsDownload ? onDownloadClick : onPress}
      data-can-manage={canManage ? 'true' : 'false'}
      className={cn(
        'flex-row items-center gap-3 rounded-lg border border-border bg-card p-4 active:opacity-70',
        needsDownload && 'border-dashed',
        !visible && 'opacity-50'
      )}
    >
      <View
        className={cn(
          'h-10 w-10 items-center justify-center rounded-full',
          isLocal ? 'bg-chart-2' : needsDownload ? 'bg-muted' : 'bg-primary'
        )}
      >
        <Text
          className={cn(
            'font-semibold',
            isLocal || needsDownload
              ? 'text-secondary-foreground'
              : 'text-primary-foreground'
          )}
        >
          {avatarInitial}
        </Text>
      </View>
      <View className="flex-1">
        <Text className="font-semibold">{primaryLabel}</Text>
        <Text className="text-sm text-muted-foreground">{secondaryLabel}</Text>
      </View>
      <View className="flex-row items-center gap-2">
        {isLocal && (
          <Icon as={HardDriveIcon} size={18} className="text-chart-2" />
        )}
        {!isLocal && (
          <DownloadIndicator
            isFlaggedForDownload={isDownloaded}
            isLoading={isDownloading && !isDownloaded}
            onPress={onDownloadClick}
            size={18}
          />
        )}
        <CardMenu direction="left" actions={menuActions} />
      </View>
    </Pressable>
  );
}
