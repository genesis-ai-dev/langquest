import { DownloadIndicator } from '@/components/DownloadIndicator';
import { PrivateAccessGate } from '@/components/PrivateAccessGate';
import type { Quest } from '@/database_services/questService';
import type { Tag } from '@/database_services/tagService';
import type { Project } from '@/hooks/db/useProjects';
import { useDownload, useQuestDownloadStatus } from '@/hooks/useDownloads';
import { sharedStyles, spacing } from '@/styles/theme';
import React, { useCallback, useMemo } from 'react';
import { Text, View } from 'react-native';

export const QuestCard: React.FC<{
  project: Project;
  quest: Quest & { tags: { tag: Tag }[] };
}> = React.memo(({ quest, project }) => {
  const {
    isFlaggedForDownload,
    isLoading: isDownloadLoading,
    toggleDownload
  } = useDownload('quest', quest.id);

  // Get quest download stats for confirmation modal
  const { questClosure } = useQuestDownloadStatus(quest.id);

  // Keep the original download hook for the mutation functionality
  const { isLoading: isDownloadMutationLoading } = useDownload(
    'quest',
    quest.id
  );
  const isLoading = isDownloadLoading || isDownloadMutationLoading;

  const handleDownloadToggle = useCallback(async () => {
    console.log(
      `🎯 [QUEST CARD] User tapped download button for quest: ${quest.id} (${quest.name})`
    );
    await toggleDownload();
  }, [toggleDownload, quest.id, quest.name]);

  // Memoize tag processing for performance
  const displayTags = useMemo(() => {
    if (!quest.tags.length) return [];
    return quest.tags.slice(0, 3).map((tag) => ({
      id: tag.tag.id,
      displayName: tag.tag.name.split(':')[1] || tag.tag.name
    }));
  }, [quest.tags]);

  const hasMoreTags = quest.tags.length > 3;

  return (
    <View style={sharedStyles.card}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: spacing.small
        }}
      >
        <Text style={[sharedStyles.cardTitle, { flex: 1 }]}>{quest.name}</Text>
        <PrivateAccessGate
          projectId={quest.project_id}
          projectName={project.name || ''}
          isPrivate={project.private || false}
          action="download"
          allowBypass={true}
          onBypass={handleDownloadToggle}
          renderTrigger={({ onPress, hasAccess }) => (
            <DownloadIndicator
              isFlaggedForDownload={isFlaggedForDownload}
              isLoading={isLoading} // FIXME: for now, we are not showing download progress
              onPress={
                hasAccess || isFlaggedForDownload
                  ? handleDownloadToggle
                  : onPress
              }
              downloadType="quest"
              stats={{
                totalAssets: questClosure?.total_assets || 0,
                totalTranslations: questClosure?.total_translations || 0
              }}
              // FIXME: for now, we are not showing download progress
              // progressPercentage={progressPercentage}
              // showProgress={totalAssets > 0 && !isDownloaded}
            />
          )}
        />
      </View>
      {quest.description && (
        <Text style={sharedStyles.cardDescription}>{quest.description}</Text>
      )}

      {/* Render optimized tags */}
      {displayTags.length > 0 && (
        <View style={sharedStyles.cardInfo}>
          {displayTags.map((tag, index) => (
            <Text key={tag.id} style={sharedStyles.cardInfoText}>
              {tag.displayName}
              {index < displayTags.length - 1 && ' • '}
            </Text>
          ))}
          {hasMoreTags && <Text style={sharedStyles.cardInfoText}> ...</Text>}
        </View>
      )}
    </View>
  );
});
