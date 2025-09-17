import { DownloadIndicator } from '@/components/DownloadIndicator';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import { LayerType, useStatusContext } from '@/contexts/StatusContext';
import type { LayerStatus } from '@/database_services/types';
import type { quest, quest_closure } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useLocalization } from '@/hooks/useLocalization';
import { cn } from '@/utils/styleUtils';
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
}

export const QuestListItem: React.FC<QuestListItemProps> = ({
  quest,
  className
}) => {
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
  const isCloudQuest = quest.source === 'cloudSupabase';
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
              <CardTitle numberOfLines={2} className="flex flex-1">
                {quest.name}
              </CardTitle>
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
            </CardDescription>
          </View>
        </CardHeader>
        {quest.description && (
          <CardContent>
            <Text numberOfLines={4}>{quest.description}</Text>
          </CardContent>
        )}
      </Card>
    </Pressable>
  );
};
