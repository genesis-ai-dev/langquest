import { DownloadIndicator } from '@/components/DownloadIndicator';
import { useAuth } from '@/contexts/AuthContext';
import type { project } from '@/db/drizzleSchema';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { colors } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { styles } from './NextGenProjectsView';
import { useItemDownload, useItemDownloadStatus } from './useHybridData';

type Project = typeof project.$inferSelect;

// Define props locally to avoid require cycle
export interface ProjectListItemProps {
  project: Project & { source?: string };
}

function renderSourceTag(source: string | undefined) {
  if (source === 'cloudSupabase') {
    return <Text style={{ color: 'red' }}>Cloud</Text>;
  }
  return <Text style={{ color: 'blue' }}>Offline</Text>;
}

export const ProjectListItem: React.FC<ProjectListItemProps> = ({
  project
}) => {
  const { goToProject } = useAppNavigation();
  const { currentUser } = useAuth();

  // Check if project is downloaded
  const isDownloaded = useItemDownloadStatus(project, currentUser?.id);

  // Download mutation
  const { mutate: downloadProject, isPending: isDownloading } = useItemDownload(
    'project',
    project.id
  );

  const handlePress = () => {
    goToProject({
      id: project.id,
      name: project.name
    });
  };

  const handleDownloadToggle = () => {
    if (!currentUser?.id) return;

    // Always download for now (undownload not fully implemented)
    if (!isDownloaded) {
      downloadProject({ userId: currentUser.id, download: true });
    }
  };

  // TODO: Get actual stats for download confirmation
  const downloadStats = {
    totalAssets: 0,
    totalQuests: 0
  };

  return (
    <TouchableOpacity onPress={handlePress}>
      <View style={styles.listItem}>
        <View style={styles.listItemHeader}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              flex: 1
            }}
          >
            {renderSourceTag(project.source)}
            {project.private && (
              <Ionicons
                name="lock-closed"
                size={16}
                color={colors.textSecondary}
              />
            )}
          </View>

          <DownloadIndicator
            isFlaggedForDownload={isDownloaded}
            isLoading={isDownloading}
            onPress={handleDownloadToggle}
            downloadType="project"
            stats={downloadStats}
          />
        </View>
        <Text style={styles.projectName}>{project.name}</Text>
        <Text style={styles.languagePair}>
          Languages: {project.source_language_id.substring(0, 8)}... →{' '}
          {project.target_language_id.substring(0, 8)}...
        </Text>
        {project.description && (
          <Text style={styles.description} numberOfLines={2}>
            {project.description}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};
