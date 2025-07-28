import { DownloadIndicator } from '@/components/DownloadIndicator';
import { PrivateAccessGate } from '@/components/PrivateAccessGate';
import { useAuth } from '@/contexts/AuthContext';
import type { language, project } from '@/db/drizzleSchema';
import { language as languageTable } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useLocalization } from '@/hooks/useLocalization';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { colors } from '@/styles/theme';
import { SHOW_DEV_ELEMENTS } from '@/utils/devConfig';
import { Ionicons } from '@expo/vector-icons';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { inArray } from 'drizzle-orm';
import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { styles } from './NextGenProjectsView';
import { useHybridData, useItemDownloadStatus } from './useHybridData';

type Project = typeof project.$inferSelect;
type Language = typeof language.$inferSelect;

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
  const [showPrivateModal, setShowPrivateModal] = useState(false);
  const { t } = useLocalization();

  // Check if project is downloaded
  const isDownloaded = useItemDownloadStatus(project, currentUser?.id);

  // Check user permissions for the project
  const { hasAccess, membership } = useUserPermissions(
    project.id,
    'open_project',
    project.private
  );

  // Fetch language information for source and target languages
  const { data: languages = [] } = useHybridData<Language>({
    dataType: 'project-languages',
    queryKeyParams: [project.source_language_id, project.target_language_id],
    offlineQuery: toCompilableQuery(
      system.db.query.language.findMany({
        where: inArray(languageTable.id, [
          project.source_language_id,
          project.target_language_id
        ])
      })
    ),
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('language')
        .select('*')
        .in('id', [project.source_language_id, project.target_language_id])
        .overrideTypes<Language[]>();
      if (error) throw error;
      return data;
    }
  });

  // Find the specific languages
  const sourceLanguage = languages.find(
    (lang) => lang.id === project.source_language_id
  );
  const targetLanguage = languages.find(
    (lang) => lang.id === project.target_language_id
  );

  // Helper function to get display name for a language
  const getLanguageDisplayName = (language: Language | undefined) => {
    if (!language) return 'Unknown';
    return language.native_name || language.english_name || 'Unknown';
  };

  const handlePress = () => {
    // If project is private and user doesn't have access, show the modal
    if (project.private && !hasAccess) {
      setShowPrivateModal(true);
    } else {
      goToProject({
        id: project.id,
        name: project.name
      });
    }
  };

  const handleMembershipGranted = () => {
    // Navigate to project after membership is granted
    goToProject({
      id: project.id,
      name: project.name
    });
  };

  const handleBypass = () => {
    // Allow viewing the project even without membership
    goToProject({
      id: project.id,
      name: project.name
    });
  };

  // TODO: Get actual stats for download confirmation
  const downloadStats = {
    totalAssets: 0,
    totalQuests: 0
  };

  return (
    <>
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
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                {project.private && (
                  <Ionicons
                    name="lock-closed"
                    size={16}
                    color={colors.textSecondary}
                  />
                )}
                {membership === 'owner' && (
                  <Ionicons name="ribbon" size={16} color={colors.primary} />
                )}
                {membership === 'member' && (
                  <Ionicons name="person" size={16} color={colors.primary} />
                )}
              </View>
              <Text style={styles.projectName}>{project.name}</Text>
            </View>

            {/* Only show download indicator when project is downloaded */}
            {isDownloaded && (
              <DownloadIndicator
                isFlaggedForDownload={true}
                isLoading={false}
                onPress={() => undefined} // Non-interactive
                downloadType="project"
                stats={downloadStats}
              />
            )}
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginTop: 4
            }}
          >
            {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
            {SHOW_DEV_ELEMENTS && renderSourceTag(project.source)}
          </View>

          <Text style={styles.languagePair}>
            {getLanguageDisplayName(sourceLanguage)} →{' '}
            {getLanguageDisplayName(targetLanguage)}
          </Text>
          {project.description && (
            <Text style={styles.description} numberOfLines={2}>
              {project.description}
            </Text>
          )}
        </View>
      </TouchableOpacity>

      {/* Private Access Gate Modal */}
      <PrivateAccessGate
        projectId={project.id}
        projectName={project.name}
        isPrivate={project.private || false}
        action="contribute"
        modal={true}
        isVisible={showPrivateModal}
        onClose={() => setShowPrivateModal(false)}
        onMembershipGranted={handleMembershipGranted}
        onBypass={handleBypass}
        showViewProjectButton={true}
        viewProjectButtonText={t('viewProjectLimitedAccess')}
      />
    </>
  );
};
