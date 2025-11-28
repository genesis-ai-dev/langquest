import { DownloadIndicator } from '@/components/DownloadIndicator';
import { Button } from '@/components/ui/button';
import { ContextMenu } from '@/components/ui/context-menu';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import type { quest as questTable } from '@/db/drizzleSchema';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useLocalization } from '@/hooks/useLocalization';
import { useQuestDownloadStatusLive } from '@/hooks/useQuestDownloadStatusLive';
import type { WithSource } from '@/utils/dbUtils';
import { FEATURE_FLAG_SHOW_CREATE_NESTED_QUEST } from '@/utils/featureFlags';
import { cn } from '@/utils/styleUtils';
import {
  ChevronDown,
  ChevronRight,
  EyeOffIcon,
  FolderIcon,
  HardDriveIcon,
  Plus,
  TrashIcon
} from 'lucide-react-native';
import React from 'react';
import { Alert, Pressable, View } from 'react-native';

type Quest = typeof questTable.$inferSelect;

export interface QuestTreeRowProps {
  quest: WithSource<Quest>;
  depth: number;
  hasChildren: boolean;
  isOpen: boolean;
  canCreateNew: boolean;
  isDownloading?: boolean;
  onToggleExpand?: () => void;
  onAddChild: (parentId: string) => void;
  onDownloadClick?: (questId: string) => void;
  onOffloadClick?: (questId: string) => void;
  downloadingQuestId?: string | null;
  downloadingQuestIds?: Set<string>;
}

export const QuestTreeRow: React.FC<QuestTreeRowProps> = ({
  quest,
  depth,
  hasChildren,
  isOpen,
  canCreateNew,
  isDownloading: _isDownloading = false,
  onToggleExpand,
  onAddChild,
  onDownloadClick,
  onOffloadClick,
  downloadingQuestId,
  downloadingQuestIds = new Set()
}) => {
  const { goToQuest, currentProjectId } = useAppNavigation();
  const { currentUser } = useAuth();
  const { t } = useLocalization();

  // Query SQLite directly - single source of truth, no cache, no race conditions
  const isDownloaded = useQuestDownloadStatusLive(quest.id);
  const isCloudQuest = quest.source === 'cloud';

  // Show loading if we're downloading AND not yet downloaded
  // Loading automatically clears when SQL watch detects isDownloaded becomes true
  const isOptimisticallyDownloading =
    downloadingQuestIds.has(quest.id) || downloadingQuestId === quest.id;
  const isLoading = isOptimisticallyDownloading && !isDownloaded;

  const handleQuestPress = () => {
    // Anonymous users can navigate directly to cloud records (cloud-only browsing)
    // Authenticated users need to download cloud quests before viewing
    if (currentUser && isCloudQuest && !isDownloaded) {
      Alert.alert(t('downloadRequired'), t('downloadQuestToView'), [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('downloadNow'),
          onPress: () => {
            if (onDownloadClick) {
              onDownloadClick(quest.id);
            }
          }
        }
      ]);
      return;
    }

    // Quest is downloaded, local, or user is anonymous (cloud-only), navigate to it
    goToQuest({
      id: quest.id,
      project_id: currentProjectId!,
      name: quest.name
    });
  };

  const Component = hasChildren ? Pressable : View;
  return (
    <View
      className={cn(
        'flex flex-row items-start py-3',
        !quest.visible && 'opacity-50'
      )}
      style={{ paddingLeft: depth * 16 }} // increase indent
    >
      {(depth > 0 || hasChildren) && (
        <Component
          {...(hasChildren && { onPress: onToggleExpand })}
          className="w-10 items-center justify-center rounded-md active:bg-accent" // bigger hit area, round, ripple feedback
          hitSlop={8}
        >
          {hasChildren && (
            <Icon
              as={isOpen ? ChevronDown : ChevronRight}
              className="text-muted-foreground"
              size={22} // bump icon size
            />
          )}
        </Component>
      )}
      <View className="flex flex-row items-center gap-2">
        {!quest.visible && (
          <Icon as={EyeOffIcon} className="text-muted-foreground" size={19} />
        )}
        {quest.source === 'local' && (
          <Icon
            as={HardDriveIcon}
            className="text-muted-foreground"
            size={19}
          />
        )}
        <Icon
          as={FolderIcon}
          className="mr-2 text-muted-foreground"
          size={22}
        />
      </View>
      <Pressable
        className="flex-1 justify-start rounded-lg px-1 active:scale-[0.98] active:bg-accent/50"
        onPress={handleQuestPress}
        hitSlop={10}
      >
        <View className="-mt-1 flex flex-1 flex-col">
          <Text numberOfLines={1} className="text-base">
            {quest.name}
          </Text>
          {quest.description && (
            <Text className="text-sm text-muted-foreground" numberOfLines={1}>
              {quest.description}
            </Text>
          )}
        </View>
        {/* {!!quest.parent_id && (
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            Parent: {quest.parent_id}
          </Text>
        )} */}
      </Pressable>
      {/* Download status indicator and menu */}
      <View className="ml-2 flex flex-row items-center gap-1">
        {quest.source !== 'local' && (
          <>
            <DownloadIndicator
              isFlaggedForDownload={isDownloaded}
              isLoading={isLoading}
              onPress={() => {
                if (isDownloaded) {
                  // Show info alert for downloaded quest
                  Alert.alert(
                    t('questDownloadedAlertTitle'),
                    t('questDownloadedMessage'),
                    [
                      ...(onOffloadClick
                        ? [
                            {
                              text: t('removeQuestFromDevice'),
                              style: 'default' as const,
                              onPress: () => onOffloadClick(quest.id)
                            }
                          ]
                        : []),
                      {
                        text: t('ok') || 'OK',
                        style: 'cancel'
                      }
                    ]
                  );
                } else if (onDownloadClick) {
                  onDownloadClick(quest.id);
                }
              }}
              className="text-muted-foreground"
              size={24}
            />
            <ContextMenu
              side="top"
              align="end"
              triggerIconSize={24}
              items={[
                ...(isDownloaded && onOffloadClick
                  ? [
                      {
                        label: t('offloadQuest') || 'Remove Download',
                        icon: TrashIcon,
                        onPress: () => onOffloadClick(quest.id)
                      }
                    ]
                  : [])
              ]}
            />
          </>
        )}
      </View>
      {FEATURE_FLAG_SHOW_CREATE_NESTED_QUEST && canCreateNew && (
        <Button
          size="icon"
          variant="outline"
          className="ml-2 size-9 rounded-lg"
          onPress={() => onAddChild(quest.id)}
        >
          <Icon as={Plus} size={22} />
        </Button>
      )}
    </View>
  );
};

export default QuestTreeRow;
