import { DownloadIndicator } from '@/components/DownloadIndicator';
import { useAuth } from '@/contexts/AuthContext';
import type { quest } from '@/db/drizzleSchema';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { colors } from '@/styles/theme';
import { SHOW_DEV_ELEMENTS } from '@/utils/devConfig';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { styles } from './NextGenQuestsView';
import { useItemDownload, useItemDownloadStatus } from './useHybridData';

type Quest = typeof quest.$inferSelect;

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

  // Check if quest is downloaded
  const isDownloaded = useItemDownloadStatus(quest, currentUser?.id);

  // Download mutation
  const { mutate: downloadQuest, isPending: isDownloading } = useItemDownload(
    'quest',
    quest.id
  );

  // Determine if this is a cloud quest that needs downloading
  const isCloudQuest = quest.source === 'cloudSupabase';
  const needsDownload = isCloudQuest && !isDownloaded;

  const handlePress = () => {
    // Only allow navigation if quest is downloaded or not from cloud
    if (!needsDownload) {
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

  // TODO: Get actual stats for download confirmation
  const downloadStats = {
    totalAssets: 0,
    totalTranslations: 0
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
          }
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
                (Download required)
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
