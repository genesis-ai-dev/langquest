/**
 * ProjectsView - Migrated from app/(root)/(drawer)/(stack)/index.tsx
 * Now works with state-driven navigation instead of routes
 */

import { ProjectSkeleton } from '@/components/ProjectSkeleton';
import { useAuth } from '@/contexts/AuthContext';
import type { project } from '@/db/drizzleSchema';
import { useLanguages } from '@/hooks/db/useLanguages';
import { useUserMemberships } from '@/hooks/db/useProfiles';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useDownload, useProjectDownloadStatus } from '@/hooks/useDownloads';
import { useLocalization } from '@/hooks/useLocalization';
import {
  borderRadius,
  colors,
  fontSizes,
  sharedStyles,
  spacing
} from '@/styles/theme';
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { ProjectListSkeleton } from '@/components/ProjectListSkeleton';
import { useInfiniteProjects } from '@/hooks/db/useProjects';
import { useLocalStore } from '@/store/localStore';
import { useRenderCounter } from '@/utils/performanceUtils';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';

// type Project = typeof project.$inferSelect;

const ProjectCard: React.FC<{ project: typeof project.$inferSelect }> = ({
  project
}) => {
  const { languages } = useLanguages();
  const { getUserMembership } = useUserMemberships();
  const { goToProject } = useAppNavigation();

  // Create helper function for getting language by ID
  const getLanguageById = (languageId: string) => {
    return languages.find((lang) => lang.id === languageId);
  };

  // Use the new download hook
  const {
    isFlaggedForDownload: _isFlaggedForDownload,
    isLoading: _isDownloadLoading,
    toggleDownload: _toggleDownload
  } = useDownload('project', project.id);

  // Get project download stats for confirmation modal
  const { projectClosure: _projectClosure } = useProjectDownloadStatus(
    project.id
  );

  // Get languages from session cache instead of individual queries
  const sourceLanguage = getLanguageById(project.source_language_id);
  const targetLanguage = getLanguageById(project.target_language_id);

  // Get membership from session cache instead of individual query
  const membership = getUserMembership(project.id);
  const membershipRole = membership?.membership;

  const _handleDownloadToggle = async () => {
    await _toggleDownload();
  };

  const handleProjectPress = () => {
    // if (project.active || membership?.membership === 'owner') {
    goToProject({ id: project.id, name: project.name });
    // }
  };

  return (
    <TouchableOpacity onPress={handleProjectPress}>
      <View
        style={[
          sharedStyles.card,
          !project.active && sharedStyles.disabled,
          !project.visible && sharedStyles.invisible
        ]}
      >
        <View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: spacing.small
            }}
          >
            <View
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.xsmall
              }}
            >
              <Text style={sharedStyles.cardTitle}>{project.name}</Text>
              {project.private && (
                <Ionicons
                  name="lock-closed"
                  size={16}
                  color={colors.textSecondary}
                />
              )}
              {membershipRole === 'owner' && (
                <Ionicons name="ribbon" size={16} color={colors.primary} />
              )}
              {membershipRole === 'member' && (
                <Ionicons name="person" size={16} color={colors.primary} />
              )}
            </View>
            {/* <PrivateAccessGate
              projectId={project.id}
              projectName={project.name}
              isPrivate={project.private}
              action="download"
              allowBypass={true}
              onBypass={handleDownloadToggle}
              renderTrigger={({ onPress, hasAccess }) => (
                <DownloadIndicator
                  isFlaggedForDownload={isFlaggedForDownload}
                  isLoading={isDownloadLoading}
                  onPress={
                    hasAccess || isFlaggedForDownload
                      ? handleDownloadToggle
                      : onPress
                  }
                  downloadType="project"
                  stats={{
                    totalAssets: projectClosure?.total_assets || 0,
                    totalTranslations: projectClosure?.total_translations || 0,
                    totalQuests: projectClosure?.total_quests || 0
                  }}
                />
              )}
            /> */}
          </View>
          <Text style={sharedStyles.cardLanguageText}>
            {sourceLanguage?.native_name ?? sourceLanguage?.english_name} →{' '}
            {targetLanguage?.native_name ?? targetLanguage?.english_name}
          </Text>
        </View>

        {project.description && (
          <Text style={sharedStyles.cardDescription}>
            {project.description}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

// Create Project Button Component
const CreateProjectButton: React.FC = () => {
  const { navigate } = useAppNavigation();

  const handleCreateProject = () => {
    navigate({ view: 'project-creation' });
  };

  return (
    <TouchableOpacity style={styles.createButton} onPress={handleCreateProject}>
      <View style={styles.createButtonContent}>
        <Ionicons
          name="add-circle-outline"
          size={24}
          color={colors.primary}
          style={styles.createButtonIcon}
        />
        <Text style={styles.createButtonText}>Create New Project</Text>
      </View>
    </TouchableOpacity>
  );
};

export default function ProjectsView() {
  const { t } = useLocalization();
  const { currentUser: _currentUser } = useAuth();

  // Add performance tracking
  useRenderCounter('ProjectsView');

  // Use local DB for languages instead of session cache
  const { languages: _languages } = useLanguages();
  const { getUserMembership: _getUserMembership } = useUserMemberships();

  // Create helper functions similar to the old session cache
  const _getLanguageById = (languageId: string) => {
    return _languages.find((lang) => lang.id === languageId);
  };

  const _sourceFilter = useLocalStore((state) => state.projectSourceFilter);
  const _targetFilter = useLocalStore((state) => state.projectTargetFilter);
  const _setSourceFilter = useLocalStore(
    (state) => state.setProjectSourceFilter
  );
  const _setTargetFilter = useLocalStore(
    (state) => state.setProjectTargetFilter
  );
  const [_openDropdown, _setOpenDropdown] = useState<
    'source' | 'target' | null
  >(null);

  // Use the new infinite projects hook
  const {
    data: infiniteData,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isLoading: isProjectsLoading,
    isError,
    error: _error,
    refetch
  } = useInfiniteProjects(10, 'name', 'asc');

  const allProjects = infiniteData?.pages.flatMap((page) => page.data) ?? [];

  // For now, show all projects without filtering
  const filteredProjects = allProjects;

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={{ paddingVertical: spacing.medium }}>
        <ProjectSkeleton />
        <ProjectSkeleton />
        <ProjectSkeleton />
      </View>
    );
  };

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetching) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetching, fetchNextPage]);

  // Show skeleton loading for initial load or when no projects are available yet
  if ((isProjectsLoading || isFetching) && !filteredProjects.length) {
    return (
      <View style={styles.container}>
        <ProjectListSkeleton />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{t('error')}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Projects List */}
      {filteredProjects.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No projects found</Text>
        </View>
      ) : (
        <>
          <FlashList
            data={filteredProjects}
            renderItem={({ item }) => <ProjectCard project={item} />}
            keyExtractor={(item) => item.id}
            onEndReached={onEndReached}
            onEndReachedThreshold={0.3}
            ListFooterComponent={() => (
              <View>
                <CreateProjectButton />
                {renderFooter()}
              </View>
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingHorizontal: spacing.medium
  },
  filtersContainer: {
    flexDirection: 'row',
    gap: spacing.small,
    marginBottom: spacing.medium
  },
  dropdown: {
    flex: 1
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.medium
  },
  loadingText: {
    fontSize: fontSizes.medium,
    color: colors.text
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.medium
  },
  errorText: {
    fontSize: fontSizes.medium,
    color: colors.error,
    textAlign: 'center'
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.large,
    paddingVertical: spacing.medium,
    borderRadius: borderRadius.medium
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: fontSizes.medium,
    fontWeight: '600'
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  emptyText: {
    fontSize: fontSizes.medium,
    color: colors.textSecondary,
    textAlign: 'center'
  },
  listContent: {
    paddingBottom: spacing.large
  },
  loadingFooter: {
    paddingVertical: spacing.medium,
    alignItems: 'center'
  },
  createButton: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.medium,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    padding: spacing.large,
    marginBottom: spacing.medium,
    marginHorizontal: spacing.medium
  },
  createButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  createButtonIcon: {
    marginRight: spacing.small
  },
  createButtonText: {
    color: colors.primary,
    fontSize: fontSizes.medium,
    fontWeight: '600'
  }
});
