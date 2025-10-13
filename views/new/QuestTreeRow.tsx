import { DownloadIndicator } from '@/components/DownloadIndicator';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import type { quest as questTable } from '@/db/drizzleSchema';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import type { WithSource } from '@/utils/dbUtils';
import {
  ChevronDown,
  ChevronRight,
  Folder,
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
  const { goToQuest } = useAppNavigation();
  const { currentUser } = useAuth();

  const { mutate: downloadQuest, isPending: isDownloading } = useItemDownload(
    'quest',
    quest.id
  );

  return (
    <View
      className="flex flex-row items-center gap-1 py-1"
      style={{ paddingLeft: depth * 12 }}
    >
      {hasChildren && (
        <Pressable onPress={onToggleExpand} className="w-8 p-1">
          <Icon
            as={isOpen ? ChevronDown : ChevronRight}
            className="text-muted-foreground"
          />
        </Pressable>
      )}
      <Icon as={Folder} className="mr-2 text-muted-foreground" />
      <Pressable
        className="flex-1 overflow-hidden"
        onPress={() =>
          goToQuest({
            id: quest.id,
            project_id: quest.project_id,
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
        {!!quest.parent_id && (
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            Parent: {quest.parent_id}
          </Text>
        )}
      </Pressable>
      {/* Download status indicator */}
      <View className="ml-2 flex flex-row items-center gap-1">
        {quest.source === 'local' ? (
          <Icon as={HardDriveIcon} className="text-muted-foreground" />
        ) : (
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
