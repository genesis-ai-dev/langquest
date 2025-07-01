import { DownloadIndicator } from '@/components/DownloadIndicator';
import { PrivateAccessGate } from '@/components/PrivateAccessGate';
import { useAuth } from '@/contexts/AuthContext';
import type { Quest } from '@/database_services/questService';
import type { Tag } from '@/database_services/tagService';
import type { Project } from '@/hooks/db/useProjects';
import { useDownload } from '@/hooks/useDownloads';
import { sharedStyles, spacing } from '@/styles/theme';
import React, { useCallback, useMemo } from 'react';
import { Text, View } from 'react-native';

export const QuestCard: React.FC<{
  project: Project;
  quest: Quest & { tags: { tag: Tag }[] };
}> = React.memo(({ quest, project }) => {
  const { currentUser: _currentUser } = useAuth();

  // Use the new download hook
  const {
    isDownloaded,
    isLoading: _isDownloadLoading,
    toggleDownload
  } = useDownload('quest', quest.id);

  const handleDownloadToggle = useCallback(async () => {
    await toggleDownload();
  }, [toggleDownload]);

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
              // isDownloaded={isDownloaded && assetsDownloaded}
              isDownloaded={false}
              // isLoading={isLoading && isDownloadLoading}
              isLoading={false}
              onPress={
                hasAccess || isDownloaded ? handleDownloadToggle : onPress
              }
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
