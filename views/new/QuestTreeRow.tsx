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
  Download,
  FolderIcon,
  HardDriveIcon,
  Plus,
  Share2Icon
} from 'lucide-react-native';
import React from 'react';
import { Alert, Pressable, View } from 'react-native';
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

  const Component = hasChildren ? Pressable : View;
  return (
    <View
      className="flex flex-row items-center gap-1 py-1"
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
        {!!quest.parent_id && (
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            Parent: {quest.parent_id}
          </Text>
        )}
      </Pressable>
      {quest.source === 'local' ? (
        <View className="ml-2 flex flex-row items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            onPress={() =>
              Alert.alert(
                'Mock Publish',
                'This is a mock public publish function.'
              )
            }
          >
            <Icon as={Share2Icon} />
          </Button>
        </View>
      ) : quest.source === 'cloud' ? (
        <View className="ml-2 flex flex-row items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            disabled={isDownloading || !currentUser?.id}
            onPress={() => {
              if (!currentUser?.id) return;
              downloadQuest({ userId: currentUser.id, download: true });
            }}
          >
            <Icon as={Download} />
          </Button>
        </View>
      ) : null}
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
