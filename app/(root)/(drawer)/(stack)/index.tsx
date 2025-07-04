import { CustomDropdown } from '@/components/CustomDropdown';
import { DownloadIndicator } from '@/components/DownloadIndicator';
import { PageHeader } from '@/components/PageHeader';
import { PrivateAccessGate } from '@/components/PrivateAccessGate';
import { useAuth } from '@/contexts/AuthContext';
import {
  useSessionLanguages,
  useSessionMemberships
} from '@/contexts/SessionCacheContext';
import type { project } from '@/db/drizzleSchema';
import { useDownload } from '@/hooks/useDownloads';
import { useLocalization } from '@/hooks/useLocalization';
import { useNavigation } from '@/hooks/useNavigation';
import {
  borderRadius,
  colors,
  fontSizes,
  sharedStyles,
  spacing
} from '@/styles/theme';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useInfiniteProjects } from '@/hooks/db/useProjects';
import { useLocalStore } from '@/store/localStore';
import { useRenderCounter } from '@/utils/performanceUtils';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';

type Project = typeof project.$inferSelect;

const ProjectCard: React.FC<{ project: typeof project.$inferSelect }> = ({
  project
}) => {
  const { getLanguageById } = useSessionLanguages();
  const { getUserMembership } = useSessionMemberships();

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

  return (
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
                isDownloaded={isDownloaded}
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
        <Text style={sharedStyles.cardDescription}>{project.description}</Text>
      )}
    </View>
  );
};

export default function Projects() {
  const { t } = useLocalization();
  const { goToProject } = useNavigation();
  const { currentUser } = useAuth();

  // Add performance tracking
  useRenderCounter('Projects');

  // Use session cache for languages instead of individual queries
  const { languages: allLanguages, isLanguagesLoading } = useSessionLanguages();
  const { isUserMember } = useSessionMemberships();

  const sourceFilter = useLocalStore((state) => state.projectSourceFilter);
  const targetFilter = useLocalStore((state) => state.projectTargetFilter);
  const setSourceFilter = useLocalStore(
    (state) => state.setProjectSourceFilter
  );
  const setTargetFilter = useLocalStore(
    (state) => state.setProjectTargetFilter
  );
  const [openDropdown, setOpenDropdown] = useState<'source' | 'target' | null>(
    null
  );
  const [privateProjectModal, setPrivateProjectModal] = useState<{
    isVisible: boolean;
    project: Project | null;
  }>({ isVisible: false, project: null });

  // Use the new infinite projects hook
  const {
    data: infiniteData,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isLoading: isProjectsLoading,
    isError,
    error,
    refetch
  } = useInfiniteProjects(10, 'name', 'asc');

  const allProjects = infiniteData?.pages.flatMap((page) => page.data) ?? [];

  // const { languages: allLanguages } = useLanguageNames(
  //   Array.from(
  //     new Set(
  //       allProjects
  //         .map((project) => project.source_language_id)
  //         .concat(allProjects.map((project) => project.target_language_id))
  //     )
  //   )
  // );

  // Apply client-side filtering based on language filters
  const filteredProjects = useMemo(() => {
    if (!allProjects.length) return [];

    return allProjects.filter((project) => {
      // Find the source and target language objects
      const sourceLanguage = allLanguages?.find(
        (l) => l.id === project.source_language_id
      );
      const targetLanguage = allLanguages?.find(
        (l) => l.id === project.target_language_id
      );

      // Get language names (prefer native name, fall back to English name)
      const sourceName =
        sourceLanguage?.native_name ?? sourceLanguage?.english_name ?? '';
      const targetName =
        targetLanguage?.native_name ?? targetLanguage?.english_name ?? '';

      // Check if this project matches the filters
      const sourceMatch = sourceFilter === 'All' || sourceFilter === sourceName;
      const targetMatch = targetFilter === 'All' || targetFilter === targetName;

      return sourceMatch && targetMatch;
    });
  }, [allProjects, allLanguages, sourceFilter, targetFilter]);

  const toggleDropdown = (dropdown: 'source' | 'target') => {
    setOpenDropdown(openDropdown === dropdown ? null : dropdown);
  };

  const handleExplore = (project: Project) => {
    console.log('handleExplore clicked at', performance.now());
    // Check if project is private
    if (project.private) {
      if (currentUser) {
        // Use session cache to check membership
        const isMember = isUserMember(project.id);

        if (!isMember) {
          // Show private project modal
          setPrivateProjectModal({ isVisible: true, project });
          return;
        }
      } else {
        // User not logged in, show private project modal
        setPrivateProjectModal({ isVisible: true, project });
        return;
      }
    }

    // Proceed with navigation
    goToProject(project);
  };

  // Load more data when user reaches end of list
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage && !isFetching) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, isFetching, fetchNextPage]);

  // Render footer with loading indicator
  const renderFooter = () => {
    if (!isFetchingNextPage) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.footerText}>Loading more...</Text>
      </View>
    );
  };

  if (isProjectsLoading || isLanguagesLoading) {
    return (
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
          <View
            style={[
              sharedStyles.container,
              {
                backgroundColor: 'transparent',
                justifyContent: 'center',
                alignItems: 'center'
              }
            ]}
          >
            <ActivityIndicator size="large" color={colors.primary} />
            <Text
              style={{
                color: colors.text,
                fontSize: fontSizes.medium,
                marginTop: spacing.medium
              }}
            >
              Loading projects...
            </Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (isError) {
    return (
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
          <View
            style={[
              sharedStyles.container,
              {
                backgroundColor: 'transparent',
                justifyContent: 'center',
                alignItems: 'center'
              }
            ]}
          >
            <Text
              style={{
                color: colors.error,
                fontSize: fontSizes.medium,
                textAlign: 'center'
              }}
            >
              Error loading projects: {error.message}
            </Text>
            <TouchableOpacity
              onPress={() => void refetch()}
              style={[styles.retryButton, { marginTop: spacing.medium }]}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const uniqueSourceLanguageIds = [
    ...new Set(filteredProjects.map((project) => project.source_language_id))
  ];

  // Get unique target languages from projects
  const uniqueTargetLanguageIds = [
    ...new Set(filteredProjects.map((project) => project.target_language_id))
  ];

  // Filter and map source languages
  const sourceLanguages = uniqueSourceLanguageIds
    .map((id) => {
      const lang = allLanguages?.find((l) => l.id === id);
      return lang?.native_name ?? lang?.english_name ?? null;
    })
    .filter((name): name is string => name !== null);

  // Filter and map target languages
  const targetLanguages = uniqueTargetLanguageIds
    .map((id) => {
      const lang = allLanguages?.find((l) => l.id === id);
      return lang?.native_name ?? lang?.english_name ?? null;
    })
    .filter((name): name is string => name !== null);

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <View
          style={[sharedStyles.container, { backgroundColor: 'transparent' }]}
        >
          <PageHeader title={t('projects')} showBackButton={false} />

          <View style={sharedStyles.filtersContainer}>
            <CustomDropdown
              label={t('source')}
              value={sourceFilter}
              options={[t('all'), ...sourceLanguages]}
              onSelect={setSourceFilter}
              isOpen={openDropdown === 'source'}
              onToggle={() => toggleDropdown('source')}
              fullWidth={false}
              search={true}
            />
            <CustomDropdown
              label={t('target')}
              value={targetFilter}
              options={[t('all'), ...targetLanguages]}
              onSelect={setTargetFilter}
              isOpen={openDropdown === 'target'}
              onToggle={() => toggleDropdown('target')}
              fullWidth={false}
              search={true}
            />
          </View>

          <FlashList
            data={filteredProjects}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => handleExplore(item)}>
                <ProjectCard project={item} />
              </TouchableOpacity>
            )}
            keyExtractor={(item) => item.id}
            estimatedItemSize={200}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={renderFooter}
          />
        </View>
      </SafeAreaView>

      {privateProjectModal.project && (
        <PrivateAccessGate
          modal={true}
          isVisible={privateProjectModal.isVisible}
          onClose={() =>
            setPrivateProjectModal({ isVisible: false, project: null })
          }
          projectId={privateProjectModal.project.id}
          projectName={privateProjectModal.project.name}
          isPrivate={privateProjectModal.project.private}
          action="view-members"
          onMembershipGranted={() => {
            // Navigate to the project when membership is granted
            goToProject(privateProjectModal.project!);
            setPrivateProjectModal({ isVisible: false, project: null });
          }}
          onBypass={() => {
            // Allow viewing the project even without membership
            goToProject(privateProjectModal.project!);
            setPrivateProjectModal({ isVisible: false, project: null });
          }}
          showViewProjectButton={true}
          viewProjectButtonText="View Project"
        />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.medium
  },
  footerText: {
    color: colors.text,
    fontSize: fontSizes.medium,
    marginLeft: spacing.small
  },
  retryButton: {
    padding: spacing.medium,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.medium
  },
  retryButtonText: {
    color: colors.text,
    fontSize: fontSizes.medium,
    fontWeight: 'bold'
  }
});
