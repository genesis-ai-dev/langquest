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
import { eq } from 'drizzle-orm';
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
  // Fetch multiple source languages via project_language_link and single target via project
  const { data: sourceLanguages = [] } = useHybridData<Language, Language>({
    dataType: 'project-source-languages',
    queryKeyParams: [project.id],
    offlineQuery: toCompilableQuery(
      system.db.query.language.findMany({
        where: (language) => eq(language.id, language.id),
        // Placeholder; PowerSync offline query requires a compilable query; we will not use offline here
        limit: 0
      })
    ),
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('project_language_link')
        .select('language:language_id(id, native_name, english_name)')
        .eq('project_id', project.id)
        .eq('language_type', 'source')
        .overrideTypes<{ language: Language }[]>();
      if (error) throw error;
      return data.map((row) => row.language);
    }
  });

  const { data: targetLangArr = [] } = useHybridData<Language>({
    dataType: 'project-target-language',
    queryKeyParams: [project.target_language_id],
    offlineQuery: toCompilableQuery(
      system.db.query.language.findMany({
        where: eq(languageTable.id, project.target_language_id)
      })
    ),
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('language')
        .select('*')
        .eq('id', project.target_language_id)
        .overrideTypes<Language[]>();
      if (error) throw error;
      return data;
    }
  });

  const targetLanguage = targetLangArr[0];

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
            {sourceLanguages.length
              ? sourceLanguages.map((l) => getLanguageDisplayName(l)).join(', ')
              : '—'}{' '}
            → {getLanguageDisplayName(targetLanguage)}
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
