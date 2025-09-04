import { DownloadIndicator } from '@/components/DownloadIndicator';
import { useAuth } from '@/contexts/AuthContext';
import { LayerType, useStatusContext } from '@/contexts/StatusContext';
import type { LayerStatus } from '@/database_services/types';
import type { quest, quest_closure } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useLocalization } from '@/hooks/useLocalization';
import { colors, sharedStyles } from '@/styles/theme';
import { SHOW_DEV_ELEMENTS } from '@/utils/devConfig';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { styles } from './NextGenQuestsView';
import {
  useHybridData,
  useItemDownload,
  useItemDownloadStatus
} from './useHybridData';

type Quest = typeof quest.$inferSelect;
type QuestClosure = typeof quest_closure.$inferSelect;

// Define props locally to avoid require cycle
export interface QuestListItemProps {
  quest: Quest & { source?: string };
}

function renderSourceTag(source: string | undefined) {
  if (source === 'cloudSupabase') {
    return <Text style={{ color: 'red' }}>Cloud</Text>;
  }
  return <Text style={{ color: 'blue' }}>Offline</Text>;
}

export const QuestListItem: React.FC<QuestListItemProps> = ({ quest }) => {
  const { goToQuest } = useAppNavigation();
  const { currentUser } = useAuth();
  const { t } = useLocalization();
  // Check if quest is downloaded
  const isDownloaded = useItemDownloadStatus(quest, currentUser?.id);

  // Fetch quest closure data for download stats
  const { data: questClosureData } = useHybridData<QuestClosure>({
    dataType: 'quest_closure',
    queryKeyParams: [quest.id],
    offlineQuery: `SELECT * FROM quest_closure WHERE quest_id = '${quest.id}' LIMIT 1`,
    cloudQueryFn: async () => {
      // Cloud query for quest closure
      const { data, error } = await system.supabaseConnector.client
        .from('quest_closure')
        .select('*')
        .eq('quest_id', quest.id)
        .single();

      if (error) {
        console.warn('Error fetching quest closure from cloud:', error);
        return [];
      }

      return data ? [data] : [];
    },
    getItemId: (item) => item.quest_id
  });

  // Get the first (and only) quest closure record
  const questClosure = questClosureData[0];

  // Download mutation
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
    // Only allow navigation if quest is downloaded or not from cloud
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

    // Always download for now (undownload not yet implemented)
    if (!isDownloaded) {
      downloadQuest({ userId: currentUser.id, download: true });
    }
  };

  // Use actual stats from quest_closure if available, otherwise fallback to 0
  const downloadStats = {
    totalAssets: questClosure?.total_assets || 0,
    totalTranslations: questClosure?.total_translations || 0
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={needsDownload ? 1 : 0.8}
      disabled={needsDownload}
    >
      <View
        style={[
          styles.listItem,
          needsDownload && {
            opacity: 0.5,
            backgroundColor: colors.inputBackground + '80' // More muted background
          },
          !allowEditing && sharedStyles.disabled,
          invisible && sharedStyles.invisible
        ]}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            {/* Only show source tag for offline quests when dev elements enabled */}
            {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
            {SHOW_DEV_ELEMENTS &&
              !isCloudQuest &&
              renderSourceTag(quest.source)}
            <Text
              style={[
                styles.questName,
                {
                  /* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */
                  marginLeft: SHOW_DEV_ELEMENTS && !isCloudQuest ? 8 : 0,
                  flexShrink: 1,
                  color: needsDownload ? colors.textSecondary : colors.text
                }
              ]}
            >
              {quest.name}
            </Text>
            {needsDownload && (
              <Text
                style={{
                  marginLeft: 8,
                  fontSize: 12,
                  color: colors.textSecondary,
                  fontStyle: 'italic'
                }}
              >
                {t('downloadRequired')}
              </Text>
            )}
          </View>

          <DownloadIndicator
            isFlaggedForDownload={isDownloaded}
            isLoading={isDownloading}
            onPress={handleDownloadToggle}
            downloadType="quest"
            stats={downloadStats}
            size={needsDownload ? 28 : 24} // Slightly larger for emphasis when download needed
          />
        </View>

        {quest.description && (
          <Text
            style={[
              styles.description,
              needsDownload && { color: colors.textSecondary }
            ]}
            numberOfLines={2}
          >
            {quest.description}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};
