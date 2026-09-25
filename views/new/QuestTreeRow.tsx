import { DownloadIndicator } from '@/components/DownloadIndicator';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import type { quest as questTable } from '@/db/drizzleSchema';
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
  Plus
} from 'lucide-react-native';
import React from 'react';
import { Pressable, View } from 'react-native';

type Quest = typeof questTable.$inferSelect;

export interface QuestTreeRowProps {
  quest: WithSource<Quest>;
  depth: number;
  hasChildren: boolean;
  isOpen: boolean;
  canCreateNew: boolean;
  onToggleExpand?: () => void;
  onAddChild: (parentId: string) => void;
  onOpenQuest: (quest: WithSource<Quest>) => void;
  onDownloadClick?: (questId: string) => void;
  downloadingQuestId?: string | null;
  downloadingQuestIds?: Set<string>;
  downloadedQuestIds?: Set<string>;
}

export const QuestTreeRow: React.FC<QuestTreeRowProps> = ({
  quest,
  depth,
  hasChildren,
  isOpen,
  canCreateNew,
  onToggleExpand,
  onAddChild,
  onOpenQuest,
  onDownloadClick,
  downloadingQuestId,
  downloadingQuestIds = new Set(),
  downloadedQuestIds = new Set()
}) => {
  const { currentUser } = useAuth();
  const isSignedIn = Boolean(currentUser);

  const liveDownloaded = useQuestDownloadStatusLive(quest.id);
  const isDownloaded = liveDownloaded || downloadedQuestIds.has(quest.id);

  const isLoading =
    (downloadingQuestIds.has(quest.id) || downloadingQuestId === quest.id) &&
    !isDownloaded;

  const handleQuestPress = () => onOpenQuest(quest);

  const Component = hasChildren ? Pressable : View;
  return (
    <View
      className={cn(
        'flex flex-row items-center gap-2 px-2 py-2', // more vertical and horizontal padding, larger gap
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
      {isSignedIn ? (
        <View className="flex min-w-[40px] flex-row items-center gap-2">
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
      ) : null}
      <Pressable
        className="flex-1 justify-center rounded-lg px-1 active:scale-[0.98] active:bg-accent/50"
        testID="quest-list-item"
        accessibilityLabel={quest.name || 'quest-list-item'}
        onPress={handleQuestPress}
        hitSlop={10}
      >
        <View className="flex flex-1 flex-row items-center gap-2">
          <View style={{ minWidth: 40 }}>
            <Text numberOfLines={1} className="text-base">
              {quest.name}
            </Text>
          </View>
          {quest.description && (
            <View className="flex-1 truncate">
              <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                {quest.description}
              </Text>
            </View>
          )}
        </View>
        {/* {!!quest.parent_id && (
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            Parent: {quest.parent_id}
          </Text>
        )} */}
      </Pressable>
      {isSignedIn && quest.source !== 'local' ? (
        <View className="ml-2 flex flex-row items-center gap-1">
          <DownloadIndicator
            isFlaggedForDownload={isDownloaded}
            isLoading={isLoading}
            onPress={() => {
              if (onDownloadClick) {
                onDownloadClick(quest.id);
              }
            }}
            className="text-muted-foreground"
            size={24}
            testID="quest-download"
          />
        </View>
      ) : null}
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
