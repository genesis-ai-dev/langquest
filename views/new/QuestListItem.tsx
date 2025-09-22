import { DownloadIndicator } from '@/components/DownloadIndicator';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import { LayerType, useStatusContext } from '@/contexts/StatusContext';
import type { LayerStatus } from '@/database_services/types';
import type { quest, quest_closure } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useLocalization } from '@/hooks/useLocalization';
import { cn } from '@/utils/styleUtils';
import { HardDriveIcon } from 'lucide-react-native';
import React from 'react';
import { Pressable, View } from 'react-native';
import type { HybridDataSource } from './useHybridData';
import {
  useHybridData,
  useItemDownload,
  useItemDownloadStatus
} from './useHybridData';

type Quest = typeof quest.$inferSelect;
type QuestClosure = typeof quest_closure.$inferSelect;

// Define props locally to avoid require cycle
export interface QuestListItemProps {
  quest: Quest & { source?: HybridDataSource };
  className?: string;
  onAddSubquest?: (quest: Quest) => void;
}

export const QuestListItem: React.FC<QuestListItemProps> = ({
  quest,
  className,
  onAddSubquest
}) => {
  // Fetch child quests (one level) for display
  const { data: childQuests } = useHybridData<Quest>({
    dataType: 'quests',
    queryKeyParams: [quest.project_id, quest.id, 'children'],
    offlineQuery: `SELECT * FROM quest WHERE project_id = '${quest.project_id}' AND parent_id = '${quest.id}'`,
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('quest')
        .select('*')
        .eq('project_id', quest.project_id)
        .eq('parent_id', quest.id)
        .overrideTypes<Quest[]>();
      if (error) {
        console.warn('Error fetching child quests from cloud:', error);
        return [];
      }
      return data;
    },
    getItemId: (item) => item.id
  });
  const { goToQuest } = useAppNavigation();
  const { currentUser } = useAuth();
  const { t } = useLocalization();
  const isDownloaded = useItemDownloadStatus(quest, currentUser?.id);

  // Fetch quest closure data for download stats
  const { data: questClosureData } = useHybridData<QuestClosure>({
    dataType: 'quest_closure',
    queryKeyParams: [quest.id],
    offlineQuery: `SELECT * FROM quest_closure WHERE quest_id = '${quest.id}' LIMIT 1`,
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('quest_closure')
        .select('*')
        .eq('quest_id', quest.id)
        .limit(1)
        .overrideTypes<QuestClosure[]>();

      if (error) {
        console.warn('Error fetching quest closure from cloud:', error);
        return [];
      }

      return data;
    },
    getItemId: (item) => item.quest_id
  });

  const questClosure = questClosureData[0];

  const { mutate: downloadQuest, isPending: isDownloading } = useItemDownload(
    'quest',
    quest.id
  );

  const currentStatus = useStatusContext();
  const { allowEditing, invisible } = currentStatus.getStatusParams(
    LayerType.ASSET,
    quest.id || '',
    quest as LayerStatus
  );

  // Determine if this is a cloud quest that needs downloading
  const isCloudQuest = quest.source === 'cloud';
  const needsDownload = isCloudQuest && !isDownloaded;

  const handlePress = () => {
    if (!needsDownload) {
      currentStatus.setLayerStatus(
        LayerType.QUEST,
        quest as LayerStatus,
        quest.id
      );
      goToQuest({
        id: quest.id,
        project_id: quest.project_id,
        name: quest.name
      });
    }
  };

  const handleDownloadToggle = () => {
    if (!currentUser?.id) return;
    if (!isDownloaded) {
      downloadQuest({ userId: currentUser.id, download: true });
    }
  };

  const downloadStats = {
    totalAssets: questClosure?.total_assets || 0,
    totalTranslations: questClosure?.total_translations || 0
  };

  const cardDisabled = needsDownload || !allowEditing;

  return (
    <Pressable
      onPress={handlePress}
      disabled={cardDisabled}
      className={className}
    >
      <Card
        className={cn(
          cardDisabled && 'opacity-50',
          invisible && 'opacity-20',
          'flex-1'
        )}
      >
        <CardHeader className="flex flex-row items-start justify-between">
          <View className="flex flex-1 flex-col">
            <View className="flex flex-row">
              <View className="flex flex-1 flex-row items-center gap-1.5">
                <View>
                  {quest.source === 'local' && (
                    <Icon
                      as={HardDriveIcon}
                      className="text-secondary-foreground"
                    />
                  )}
                </View>
                <CardTitle numberOfLines={2} className="flex flex-1">
                  {quest.name}
                </CardTitle>
              </View>
              <DownloadIndicator
                isFlaggedForDownload={isDownloaded}
                isLoading={isDownloading}
                onPress={handleDownloadToggle}
                downloadType="quest"
                stats={downloadStats}
              />
            </View>
            <CardDescription>
              {needsDownload && (
                <Text className="text-sm italic text-muted-foreground">
                  {t('downloadRequired')}
                </Text>
              )}
              {!!quest.parent_id && (
                <Text className="text-xs text-muted-foreground">
                  Parent: {quest.parent_id}
                </Text>
              )}
            </CardDescription>
          </View>
        </CardHeader>
        {quest.description && (
          <CardContent>
            <Text numberOfLines={4}>{quest.description}</Text>
          </CardContent>
        )}
        <CardContent>
          <View className="mt-2 flex flex-col gap-2">
            {!!childQuests?.length && (
              <View className="flex flex-col gap-1">
                <Text className="text-xs text-muted-foreground">
                  Sub-quests
                </Text>
                {childQuests.map((child) => (
                  <Pressable
                    key={child.id}
                    onPress={() =>
                      goToQuest({
                        id: child.id,
                        project_id: child.project_id,
                        name: child.name
                      })
                    }
                  >
                    <Text className="text-sm">• {child.name}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            {onAddSubquest && (
              <Button
                variant="outline"
                size="sm"
                onPress={() => onAddSubquest(quest)}
              >
                <Text className="text-xs">Add sub-quest</Text>
              </Button>
            )}
          </View>
        </CardContent>
      </Card>
    </Pressable>
  );
};
