import { DownloadIndicator } from '@/components/DownloadIndicator';
import { PageHeader } from '@/components/PageHeader';
import { PrivateAccessGate } from '@/components/PrivateAccessGate';
import { ProgressBars } from '@/components/ProgressBars';
import { ProjectDetails } from '@/components/ProjectDetails';
import { ProjectMembershipModal } from '@/components/ProjectMembershipModal';
import { ProjectSettingsModal } from '@/components/ProjectSettingsModal';
import { QuestFilterModal } from '@/components/QuestFilterModal';
import { useAuth } from '@/contexts/AuthContext';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useSystem } from '@/contexts/SystemContext';
import type { Quest } from '@/database_services/questService';
import type { Tag } from '@/database_services/tagService';
import { profile_project_link } from '@/db/drizzleSchema';
import { useAttachmentAssetDownloadStatus } from '@/hooks/useAssetDownloadStatus';
import { useDownload } from '@/hooks/useDownloads';
import { useLocalization } from '@/hooks/useLocalization';
import {
  borderRadius,
  colors,
  fontSizes,
  sharedStyles,
  spacing
} from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAssetsWithTranslationsAndVotesByQuestId } from '@/hooks/db/useAssets';
import type { Project } from '@/hooks/db/useProjects';
import { useProjectById } from '@/hooks/db/useProjects';
import { useInfiniteQuestsWithTagsByProjectId } from '@/hooks/db/useQuests';
import { calculateQuestProgress } from '@/utils/progressUtils';
import { sortItems } from '@/utils/sortingUtils';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useQuery as useTanstackQuery } from '@powersync/tanstack-react-query';
import { and, eq } from 'drizzle-orm';

interface SortingOption {
  field: string;
  order: 'asc' | 'desc';
}

// Helper functions outside component to prevent recreation
const filterQuests = <T extends Quest>(
  quests: T[],
  questTags: Record<string, Tag[]>,
  searchQuery: string,
  activeFilters: Record<string, string[]>
) => {
  return quests.filter((quest) => {
    // Search filter
    const matchesSearch =
      quest.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (quest.description?.toLowerCase().includes(searchQuery.toLowerCase()) ??
        false);

    // Tag filters
    const matchesFilters = Object.entries(activeFilters).every(
      ([category, selectedOptions]) => {
        if (selectedOptions.length === 0) return true;
        return questTags[quest.id]?.some((tag) => {
          const [tagCategory, tagValue] = tag.name.split(':');
          return (
            tagCategory?.toLowerCase() === category.toLowerCase() &&
            selectedOptions.includes(
              `${category.toLowerCase()}:${tagValue?.toLowerCase()}`
            )
          );
        });
      }
    );

    return matchesSearch && matchesFilters;
  });
};

const QuestCard: React.FC<{
  project: Project;
  quest: Quest & { tags: { tag: Tag }[] };
}> = ({ quest, project }) => {
  const { currentUser } = useAuth();

  // Use the new download hook
  const {
    isDownloaded,
    isLoading: isDownloadLoading,
    toggleDownload
  } = useDownload('quest', quest.id);

  const handleDownloadToggle = async () => {
    await toggleDownload();
  };

  const { assets: assetsData } = useAssetsWithTranslationsAndVotesByQuestId(
    quest.id
  );
  const assets = assetsData ?? [];

  const assetIds = assets.map((asset) => asset.id).filter(Boolean);

  const { isDownloaded: assetsDownloaded, isLoading } =
    useAttachmentAssetDownloadStatus(assetIds);

  const progress =
    false && calculateQuestProgress(assets, currentUser?.id ?? null);

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
          projectName={project?.name || ''}
          isPrivate={project?.private || false}
          action="download"
          allowBypass={true}
          onBypass={handleDownloadToggle}
          renderTrigger={({ onPress, hasAccess }) => (
            <DownloadIndicator
              isDownloaded={isDownloaded && assetsDownloaded}
              isLoading={isLoading && isDownloadLoading}
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

      {false && (
        <ProgressBars
          approvedPercentage={progress.approvedPercentage}
          userContributedPercentage={progress.userContributedPercentage}
          pickaxeCount={progress.pendingTranslationsCount}
        />
      )}

      {quest.tags.length > 0 && (
        <View style={sharedStyles.cardInfo}>
          {quest.tags.slice(0, 3).map((tag, index) => (
            <Text key={tag.tag.id} style={sharedStyles.cardInfoText}>
              {tag.tag.name.split(':')[1]}
              {index < Math.min(quest.tags.length - 1, 2) && ' • '}
            </Text>
          ))}
          {quest.tags.length > 3 && (
            <Text style={sharedStyles.cardInfoText}> ...</Text>
          )}
        </View>
      )}
    </View>
  );
};

export default function Quests() {
  const { t } = useLocalization();
  const { projectId, projectName } = useLocalSearchParams<{
    projectId: string;
    projectName: string;
  }>();
  const [searchQuery, setSearchQuery] = useState('');
  const { db } = useSystem();
  const { currentUser } = useAuth();

  // Feature flags to toggle button visibility
  const SHOW_SETTINGS_BUTTON = true; // Set to false to hide settings button
  const SHOW_MEMBERSHIP_BUTTON = true; // Set to false to hide membership button

  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>(
    {}
  );
  const [activeSorting, setActiveSorting] = useState<SortingOption[]>([]);
  const [showProjectStats, setShowProjectStats] = useState(false);
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const { goToQuest } = useProjectContext();

  const { project: selectedProject } = useProjectById(projectId);

  // Use the new hybrid infinite query hook for better performance and offline support
  const {
    data: infiniteData,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch
  } = useInfiniteQuestsWithTagsByProjectId(
    projectId,
    20, // pageSize
    activeSorting[0]?.field === 'name' ? activeSorting[0].field : undefined,
    activeSorting[0]?.order
  );

  // Extract all quests from pages and apply client-side filtering
  const allQuests = useMemo(() => {
    if (!infiniteData?.pages) {
      return [];
    }
    const flattened = infiniteData.pages.flatMap((page) => page.data);
    return flattened;
  }, [infiniteData]);

  // Query to check if current user is an owner
  const { data: [currentUserLink] = [] } = useTanstackQuery({
    queryKey: ['current-user-project-link', projectId, currentUser?.id],
    query: toCompilableQuery(
      db.query.profile_project_link.findFirst({
        where: and(
          eq(profile_project_link.project_id, projectId),
          eq(profile_project_link.profile_id, currentUser?.id || ''),
          eq(profile_project_link.active, true)
        )
      })
    ),
    enabled: !!currentUser?.id && !!projectId
  });

  const isOwner = currentUserLink?.membership === 'owner';

  const questTags = useMemo(() => {
    return allQuests.reduce(
      (acc, quest) => {
        // Handle the case where quest.tags might be undefined from the type perspective
        const tags = quest.tags as { tag: Tag }[] | undefined;
        acc[quest.id] = tags?.map((tag) => tag.tag) ?? [];
        return acc;
      },
      {} as Record<string, Tag[]>
    );
  }, [allQuests]);

  // Apply client-side filtering and sorting (consider moving search to server-side for better performance)
  const filteredQuests = useMemo(() => {
    if (!allQuests.length) return [];

    // Type the quests properly for filtering
    const typedQuests = allQuests as (Quest & { tags: { tag: Tag }[] })[];

    const filtered = filterQuests(
      typedQuests,
      questTags,
      searchQuery,
      activeFilters
    );

    // Apply additional sorting if needed (beyond what's handled by the query)
    return sortItems(
      filtered,
      activeSorting,
      (questId: string) => questTags[questId] ?? []
    );
  }, [allQuests, questTags, searchQuery, activeFilters, activeSorting]);

  const getActiveOptionsCount = () => {
    const filterCount = Object.values(activeFilters).flat().length;
    const sortCount = activeSorting.length;
    return filterCount + sortCount;
  };

  const handleQuestPress = (quest: Quest) => {
    goToQuest(quest);
  };

  const handleCloseDetails = () => {
    setShowProjectStats(false);
  };

  const handleApplyFilters = (filters: Record<string, string[]>) => {
    setActiveFilters(filters);
    setIsFilterModalVisible(false);
  };

  const handleApplySorting = (sorting: SortingOption[]) => {
    setActiveSorting(sorting);
  };

  const toggleProjectStats = () => {
    setShowProjectStats((prev) => !prev);
  };

  // Load more data when user reaches end of list - TKDodo's best practice
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage && !isFetching) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, isFetching, fetchNextPage]);

  // Refresh data
  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  // Render footer with loading indicator - TKDodo's pattern
  const renderFooter = () => {
    if (!isFetchingNextPage) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.footerText}>Loading more...</Text>
      </View>
    );
  };

  // Handle back button press
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (isFilterModalVisible) {
          setIsFilterModalVisible(false);
          return true;
        }
        return false;
      }
    );

    return () => backHandler.remove();
  }, [isFilterModalVisible]);

  // Loading state with better UX
  if (isLoading) {
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
              Loading quests...
            </Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // Error state with retry option
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
              Error loading quests: {error.message}
            </Text>
            <TouchableOpacity
              onPress={handleRefresh}
              style={[styles.retryButton, { marginTop: spacing.medium }]}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <View
          style={[sharedStyles.container, { backgroundColor: 'transparent' }]}
        >
          <View style={styles.headerContainer}>
            <PageHeader title={`${projectName} ${t('quests')}`} />
          </View>

          <View style={styles.searchContainer}>
            <Ionicons
              name="search"
              size={20}
              color={colors.text}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder={t('searchQuests')}
              placeholderTextColor={colors.text}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <TouchableOpacity
              onPress={() => setIsFilterModalVisible(true)}
              style={styles.filterIcon}
            >
              <Ionicons name="filter" size={20} color={colors.text} />
              {getActiveOptionsCount() > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {getActiveOptionsCount()}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <FlatList
            data={filteredQuests}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => handleQuestPress(item)}>
                <QuestCard
                  quest={item as Quest & { tags: { tag: Tag }[] }}
                  project={selectedProject!}
                />
              </TouchableOpacity>
            )}
            keyExtractor={(item) => item.id}
            style={sharedStyles.list}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={renderFooter}
            refreshControl={
              <RefreshControl
                refreshing={isFetching && !isFetchingNextPage}
                onRefresh={handleRefresh}
                colors={[colors.primary]}
                tintColor={colors.primary}
              />
            }
            showsVerticalScrollIndicator={false}
            // Performance optimizations from TKDodo's guide
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={100}
            initialNumToRender={10}
            windowSize={10}
          />
          <View style={styles.floatingButtonsContainer}>
            {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
            {isOwner && SHOW_SETTINGS_BUTTON && (
              <TouchableOpacity
                onPress={() => setShowSettingsModal(true)}
                style={styles.settingsButton}
              >
                <Ionicons name="settings" size={24} color={colors.text} />
              </TouchableOpacity>
            )}
            {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
            {SHOW_MEMBERSHIP_BUTTON && (
              <TouchableOpacity
                onPress={() => setShowMembershipModal(true)}
                style={styles.membersButton}
              >
                <Ionicons name="people" size={24} color={colors.text} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={toggleProjectStats}
              style={styles.statsButton}
            >
              <Ionicons name="stats-chart" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
      <Modal
        visible={isFilterModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsFilterModalVisible(false)}
      >
        <View style={{ flex: 1 }}>
          {allQuests.length > 0 && (
            <QuestFilterModal
              onClose={() => setIsFilterModalVisible(false)}
              questTags={questTags}
              onApplyFilters={handleApplyFilters}
              onApplySorting={handleApplySorting}
              initialFilters={activeFilters}
              initialSorting={activeSorting}
            />
          )}
        </View>
      </Modal>
      {showProjectStats && selectedProject && (
        <ProjectDetails
          project={selectedProject}
          onClose={handleCloseDetails}
        />
      )}
      <ProjectMembershipModal
        isVisible={showMembershipModal}
        onClose={() => setShowMembershipModal(false)}
        projectId={projectId}
      />
      <ProjectSettingsModal
        isVisible={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        projectId={projectId}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.medium,
    paddingHorizontal: spacing.medium,
    marginBottom: spacing.medium
  },
  searchIcon: {
    marginRight: spacing.small
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: fontSizes.medium,
    paddingVertical: spacing.medium
  },
  filterIcon: {
    marginLeft: spacing.small,
    padding: spacing.small,
    position: 'relative'
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: colors.primary,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center'
  },
  badgeText: {
    color: colors.buttonText,
    fontSize: fontSizes.small,
    fontWeight: 'bold'
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: spacing.medium,
    width: '100%'
  },
  floatingButtonsContainer: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    gap: spacing.small
  },
  settingsButton: {
    padding: spacing.small
  },
  membersButton: {
    padding: spacing.small
  },
  statsButton: {
    padding: spacing.small
  },
  title: {
    fontSize: fontSizes.xxlarge,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
    textAlign: 'center'
  },
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.medium,
    gap: spacing.small
  },
  footerText: {
    color: colors.textSecondary,
    fontSize: fontSizes.small
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.large,
    paddingVertical: spacing.medium,
    borderRadius: borderRadius.medium
  },
  retryButtonText: {
    color: colors.buttonText,
    fontSize: fontSizes.medium,
    fontWeight: 'bold'
  }
});
