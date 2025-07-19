import { DownloadIndicator } from '@/components/DownloadIndicator';
import { useAuth } from '@/contexts/AuthContext';
import type { Quest } from '@/hooks/db/useQuests';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { styles } from './NextGenQuestsView';
import { useItemDownload, useItemDownloadStatus } from './useHybridData';

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

  const handlePress = () => {
    goToQuest({
      id: quest.id,
      project_id: quest.project_id,
      name: quest.name
    });
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
    <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
      <View style={styles.listItem}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            {renderSourceTag(quest.source)}
            <Text style={[styles.questName, { marginLeft: 8, flexShrink: 1 }]}>
              {quest.name}
            </Text>
          </View>

          <DownloadIndicator
            isFlaggedForDownload={isDownloaded}
            isLoading={isDownloading}
            onPress={handleDownloadToggle}
            downloadType="quest"
            stats={downloadStats}
          />
        </View>

        {quest.description && (
          <Text style={styles.description} numberOfLines={2}>
            {quest.description}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};
