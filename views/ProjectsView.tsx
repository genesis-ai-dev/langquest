/**
 * ProjectsView - Migrated from app/(root)/(drawer)/(stack)/index.tsx
 * Now works with state-driven navigation instead of routes
 */

import { DownloadIndicator } from '@/components/DownloadIndicator';
import { PrivateAccessGate } from '@/components/PrivateAccessGate';
import { ProjectSkeleton } from '@/components/ProjectSkeleton';
import { useAuth } from '@/contexts/AuthContext';
import {
  useSessionLanguages,
  useSessionMemberships
} from '@/contexts/SessionCacheContext';
import type { project } from '@/db/drizzleSchema';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useDownload } from '@/hooks/useDownloads';
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
  const { getLanguageById } = useSessionLanguages();
  const { getUserMembership } = useSessionMemberships();
  const { goToProject } = useAppNavigation();

  // Use the new download hook
  const {
    isDownloaded,
    isLoading: isDownloadLoading,
    toggleDownload
  } = useDownload('project', project.id);

  // Get languages from session cache instead of individual queries
  const sourceLanguage = getLanguageById(project.source_language_id);
  const targetLanguage = getLanguageById(project.target_language_id);

  // Get membership from session cache instead of individual query
  const membership = getUserMembership(project.id);
  const membershipRole = membership?.membership;

  const handleDownloadToggle = async () => {
    await toggleDownload();
  };

  const handleProjectPress = () => {
    goToProject({ id: project.id, name: project.name });
  };

  return (
    <TouchableOpacity onPress={handleProjectPress}>
      <View style={sharedStyles.card}>
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
            <PrivateAccessGate
              projectId={project.id}
              projectName={project.name}
              isPrivate={project.private}
              action="download"
              allowBypass={true}
              onBypass={handleDownloadToggle}
              renderTrigger={({ onPress, hasAccess }) => (
                <DownloadIndicator
                  isFlaggedForDownload={isDownloaded}
                  isLoading={isDownloadLoading}
                  onPress={
                    hasAccess || isDownloaded ? handleDownloadToggle : onPress
                  }
                />
              )}
            />
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

export default function ProjectsView() {
  const { t } = useLocalization();
  const { currentUser: _currentUser } = useAuth();

  // Add performance tracking
  useRenderCounter('ProjectsView');

  // Use session cache for languages instead of individual queries
  const { languages: _allLanguages, isLanguagesLoading: _isLanguagesLoading } =
    useSessionLanguages();
  const { isUserMember: _isUserMember } = useSessionMemberships();

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

  if (isProjectsLoading && !filteredProjects.length) {
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
        <FlashList
          data={filteredProjects}
          renderItem={({ item }) => <ProjectCard project={item} />}
          keyExtractor={(item) => item.id}
          estimatedItemSize={120}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
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
  }
});
