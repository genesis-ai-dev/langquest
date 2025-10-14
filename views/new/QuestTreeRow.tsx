import { DownloadIndicator } from '@/components/DownloadIndicator';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import type { quest as questTable } from '@/db/drizzleSchema';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import type { WithSource } from '@/utils/dbUtils';
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
import { useItemDownload } from './useHybridData';

type Quest = typeof questTable.$inferSelect;

export interface QuestTreeRowProps {
  quest: WithSource<Quest>;
  depth: number;
  hasChildren: boolean;
  isOpen: boolean;
  onToggleExpand?: () => void;
  onAddChild: (parentId: string) => void;
}

export const QuestTreeRow: React.FC<QuestTreeRowProps> = ({
  quest,
  depth,
  hasChildren,
  isOpen,
  onToggleExpand,
  onAddChild
}) => {
  const { goToQuest, currentProjectId } = useAppNavigation();
  const { currentUser } = useAuth();

  const { mutate: downloadQuest, isPending: isDownloading } = useItemDownload(
    'quest',
    quest.id
  );

  console.log('quest', quest);

  const Component = hasChildren ? Pressable : View;
  return (
    <View
      className={cn(
        'flex flex-row items-center gap-1 py-1',
        !quest.visible && 'opacity-50'
      )}
      style={{ paddingLeft: depth * 12 }}
    >
      {(depth > 0 || hasChildren) && (
        <Component
          {...(hasChildren && { onPress: onToggleExpand })}
          className="w-8 p-1"
        >
          {hasChildren && (
            <Icon
              as={isOpen ? ChevronDown : ChevronRight}
              className="text-muted-foreground"
            />
          )}
        </Component>
      )}
      <View className="flex flex-row items-center gap-2">
        {!quest.visible && (
          <Icon as={EyeOffIcon} className="text-muted-foreground" />
        )}
        {quest.source === 'local' && (
          <Icon as={HardDriveIcon} className="text-muted-foreground" />
        )}
        <Icon as={FolderIcon} className="mr-2 text-muted-foreground" />
      </View>
      <Pressable
        className="flex-1 overflow-hidden"
        onPress={() =>
          goToQuest({
            id: quest.id,
            project_id: currentProjectId!,
            name: quest.name
          })
        }
      >
        <View className="flex flex-1 flex-row items-center gap-2">
          <View>
            <Text numberOfLines={1}>{quest.name}</Text>
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
      {/* Download status indicator */}
      <View className="ml-2 flex flex-row items-center gap-1">
        {quest.source !== 'local' && (
          <DownloadIndicator
            isFlaggedForDownload={quest.source === 'synced'}
            isLoading={isDownloading}
            onPress={() => {
              if (quest.source === 'cloud') {
                if (!currentUser?.id) return;
                downloadQuest({ userId: currentUser.id, download: true });
              }
              // If local, this is just a hard drive icon -- not actionable
            }}
            className="text-muted-foreground"
            downloadType="quest"
            // For now, no stats; could be passed as needed
            // For local-only: just shows a hard drive, non-pressable
            showProgress={false}
          />
        )}
      </View>
      <Button
        size="icon"
        variant="outline"
        className="ml-2 size-7"
        onPress={() => onAddChild(quest.id)}
      >
        <Icon as={Plus} />
      </Button>
    </View>
  );
};

export default QuestTreeRow;
