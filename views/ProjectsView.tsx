/**
 * ProjectsView - Migrated from app/(root)/(drawer)/(stack)/index.tsx
 * Now works with state-driven navigation instead of routes
 */

import { ProjectSkeleton } from '@/components/ProjectSkeleton';
import { useAuth } from '@/contexts/AuthContext';
import {
  useSessionLanguages,
  useSessionMemberships
} from '@/contexts/SessionCacheContext';
import type { project } from '@/db/drizzleSchema';
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
import type { BibleReference } from '@/constants/bibleStructure';
import { BibleRecordingModal } from '@/features/bible-recording/BibleRecordingModal';
import { NewBibleProjectModal } from '@/features/bible-recording/NewBibleProjectModal';
import { useInfiniteProjects } from '@/hooks/db/useProjects';
import { useLocalStore } from '@/store/localStore';
import { useRenderCounter } from '@/utils/performanceUtils';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';

// New project type selection modal
interface NewProjectTypeModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectBibleProject: () => void;
  onSelectOralRecording: () => void;
}

const NewProjectTypeModal: React.FC<NewProjectTypeModalProps> = ({
  visible: _visible,
  onClose,
  onSelectBibleProject,
  onSelectOralRecording
}) => {
  const { t: _t } = useLocalization();

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.projectTypeModal}>
        <View style={styles.projectTypeHeader}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.projectTypeTitle}>New Project</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.projectTypeContent}>
          <TouchableOpacity
            style={styles.projectTypeOption}
            onPress={onSelectBibleProject}
          >
            <View style={styles.projectTypeIcon}>
              <Ionicons name="book" size={32} color={colors.primary} />
            </View>
            <Text style={styles.projectTypeOptionTitle}>Bible Translation</Text>
            <Text style={styles.projectTypeOptionDescription}>
              Record verse-by-verse Bible translations with voice activity
              detection
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.projectTypeOption}
            onPress={onSelectOralRecording}
          >
            <View style={styles.projectTypeIcon}>
              <Ionicons name="mic" size={32} color={colors.primary} />
            </View>
            <Text style={styles.projectTypeOptionTitle}>Oral Recording</Text>
            <Text style={styles.projectTypeOptionDescription}>
              Record stories, language samples, and other unstructured content
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const ProjectCard: React.FC<{ project: typeof project.$inferSelect }> = ({
  project
}) => {
  const { getLanguageById } = useSessionLanguages();
  const { getUserMembership } = useSessionMemberships();
  const { goToProject } = useAppNavigation();

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

  // New project creation state
  const [showNewProjectTypeModal, setShowNewProjectTypeModal] = useState(false);
  const [showNewBibleProjectModal, setShowNewBibleProjectModal] =
    useState(false);
  const [showBibleRecordingModal, setShowBibleRecordingModal] = useState(false);
  const [newProjectData, setNewProjectData] = useState<{
    projectName: string;
    sourceLanguageId: string;
    targetLanguageId: string;
    initialReference: BibleReference;
  } | null>(null);

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

  // Handle new project creation
  const handleNewProjectPress = () => {
    setShowNewProjectTypeModal(true);
  };

  const handleBibleProjectSelect = () => {
    setShowNewProjectTypeModal(false);
    setShowNewBibleProjectModal(true);
  };

  const handleOralRecordingSelect = () => {
    setShowNewProjectTypeModal(false);
    // TODO: Implement generic oral recording project creation
    console.log('Oral recording project selected');
  };

  const handleBibleProjectCreate = (project: {
    id: string;
    name: string;
    sourceLanguageId: string;
    targetLanguageId: string;
    initialReference: BibleReference;
  }) => {
    setNewProjectData({
      projectName: project.name,
      sourceLanguageId: project.sourceLanguageId,
      targetLanguageId: project.targetLanguageId,
      initialReference: project.initialReference
    });
    setShowNewBibleProjectModal(false);
    setShowBibleRecordingModal(true);
  };

  const handleBibleRecordingComplete = () => {
    setShowBibleRecordingModal(false);
    setNewProjectData(null);
    // Refresh projects list
    void refetch();
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Text style={styles.headerTitle}>{t('projects')}</Text>
      </View>
      <TouchableOpacity
        style={styles.headerButton}
        onPress={handleNewProjectPress}
      >
        <Ionicons name="add" size={24} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );

  const renderFooter = () => {
    if (isFetchingNextPage) {
      return (
        <View style={{ paddingVertical: spacing.medium }}>
          <ProjectSkeleton />
          <ProjectSkeleton />
          <ProjectSkeleton />
        </View>
      );
    }

    return (
      <View style={styles.footerContainer}>
        <TouchableOpacity
          style={styles.newProjectButton}
          onPress={handleNewProjectPress}
        >
          <Ionicons name="add-circle" size={24} color={colors.primary} />
          <Text style={styles.newProjectButtonText}>
            {t('createNewProject')}
          </Text>
        </TouchableOpacity>
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
        {renderHeader()}
        <ProjectListSkeleton />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{t('error')}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => refetch()}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderHeader()}

      {/* Projects List */}
      {filteredProjects.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No projects found</Text>
          <TouchableOpacity
            style={styles.emptyActionButton}
            onPress={handleNewProjectPress}
          >
            <Ionicons name="add-circle" size={32} color={colors.primary} />
            <Text style={styles.emptyActionText}>
              {t('createFirstProject')}
            </Text>
          </TouchableOpacity>
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

      {/* New Project Type Selection Modal */}
      {showNewProjectTypeModal && (
        <NewProjectTypeModal
          visible={showNewProjectTypeModal}
          onClose={() => setShowNewProjectTypeModal(false)}
          onSelectBibleProject={handleBibleProjectSelect}
          onSelectOralRecording={handleOralRecordingSelect}
        />
      )}

      {/* New Bible Project Modal */}
      {showNewBibleProjectModal && (
        <NewBibleProjectModal
          isVisible={showNewBibleProjectModal}
          onClose={() => setShowNewBibleProjectModal(false)}
          onProjectCreated={handleBibleProjectCreate}
        />
      )}

      {/* Bible Recording Modal */}
      {showBibleRecordingModal && newProjectData && (
        <BibleRecordingModal
          isVisible={showBibleRecordingModal}
          onClose={() => setShowBibleRecordingModal(false)}
          projectName={newProjectData.projectName}
          sourceLanguageId={newProjectData.sourceLanguageId}
          targetLanguageId={newProjectData.targetLanguageId}
          initialReference={newProjectData.initialReference}
          onSave={handleBibleRecordingComplete}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: colors.inputBorder,
    marginBottom: spacing.medium
  },
  headerLeft: {
    flex: 1
  },
  headerTitle: {
    fontSize: fontSizes.xlarge,
    fontWeight: '600',
    color: colors.text
  },
  headerButton: {
    padding: spacing.small,
    borderRadius: borderRadius.small,
    backgroundColor: colors.inputBackground
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  projectTypeModal: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.large,
    padding: spacing.large,
    margin: spacing.large,
    maxWidth: 400,
    width: '90%'
  },
  projectTypeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.large
  },
  projectTypeTitle: {
    fontSize: fontSizes.large,
    fontWeight: '600',
    color: colors.text
  },
  projectTypeContent: {
    gap: spacing.medium
  },
  projectTypeOption: {
    padding: spacing.large,
    borderRadius: borderRadius.medium,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    alignItems: 'center',
    gap: spacing.small
  },
  projectTypeIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center'
  },
  projectTypeOptionTitle: {
    fontSize: fontSizes.medium,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center'
  },
  projectTypeOptionDescription: {
    fontSize: fontSizes.small,
    color: colors.textSecondary,
    textAlign: 'center'
  },
  footerContainer: {
    paddingVertical: spacing.large,
    alignItems: 'center'
  },
  newProjectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    paddingVertical: spacing.medium,
    paddingHorizontal: spacing.large,
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.medium,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderStyle: 'dashed'
  },
  newProjectButtonText: {
    fontSize: fontSizes.medium,
    color: colors.primary,
    fontWeight: '500'
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.large
  },
  emptyText: {
    fontSize: fontSizes.medium,
    color: colors.textSecondary,
    textAlign: 'center'
  },
  emptyActionButton: {
    alignItems: 'center',
    gap: spacing.small,
    paddingVertical: spacing.large,
    paddingHorizontal: spacing.large,
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.medium,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderStyle: 'dashed'
  },
  emptyActionText: {
    fontSize: fontSizes.medium,
    color: colors.primary,
    fontWeight: '500'
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
  listContent: {
    paddingBottom: spacing.large
  },
  loadingFooter: {
    paddingVertical: spacing.medium,
    alignItems: 'center'
  }
});
