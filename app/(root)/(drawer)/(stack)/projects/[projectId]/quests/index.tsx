import { PageHeader } from '@/components/PageHeader';
import { ProjectDetails } from '@/components/ProjectDetails';
import { ProjectMembershipModal } from '@/components/ProjectMembershipModal';
import { ProjectSettingsModal } from '@/components/ProjectSettingsModal';
import { QuestFilterModal } from '@/components/QuestFilterModal';
import { useAuth } from '@/contexts/AuthContext';
import { useProjectContext } from '@/contexts/ProjectContext';
import { system } from '@/db/powersync/system';
import type { Quest } from '@/database_services/questService';
import type { Tag } from '@/database_services/tagService';
import { profile_project_link } from '@/db/drizzleSchema';
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
import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react';
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

import type { Project } from '@/database_services/projectService';
import { useProjectById } from '@/hooks/db/useProjects';
import { useInfiniteQuestsWithTagsByProjectId } from '@/hooks/db/useQuests';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useQuery as useTanstackQuery } from '@powersync/tanstack-react-query';
import { and, eq } from 'drizzle-orm';
import { QuestCard } from '../../../../../../../components/QuestCard';

interface SortingOption {
  field: string;
  order: 'asc' | 'desc';
}

// Memoized quest item component for better performance
const QuestItem = React.memo(
  ({
    quest,
    project,
    onPress
  }: {
    quest: Quest & { tags: { tag: Tag }[] };
    project: Project | null;
    onPress: (quest: Quest) => void;
  }) => {
    const handlePress = useCallback(() => {
      onPress(quest);
    }, [quest, onPress]);

    if (!project) return null;

    return (
      <TouchableOpacity onPress={handlePress}>
        <QuestCard quest={quest} project={project} />
      </TouchableOpacity>
    );
  }
);

// Helper functions outside component to prevent recreation
const filterQuests = <T extends Quest>(
  quests: T[],
  questTags: Record<string, Tag[]>,
  searchQuery: string,
  activeFilters: Record<string, string[]>
) => {
  if (!quests.length) return [];

  return quests.filter((quest) => {
    // Early return if no filters
    if (!searchQuery && Object.keys(activeFilters).length === 0) return true;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        quest.name.toLowerCase().includes(query) ||
        (quest.description?.toLowerCase().includes(query) ?? false);
      if (!matchesSearch) return false;
    }

    // Tag filters - only check if there are active filters
    if (Object.keys(activeFilters).length > 0) {
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
      if (!matchesFilters) return false;
    }

    return true;
  });
};

// Skeleton loader component for better perceived performance
const QuestSkeleton = React.memo(() => (
  <View style={[sharedStyles.card, { opacity: 0.6 }]}>
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.small
      }}
    >
      <View
        style={{
          backgroundColor: colors.inputBackground,
          height: 20,
          flex: 1,
          borderRadius: 4
        }}
      />
      <View
        style={{
          width: 32,
          height: 32,
          backgroundColor: colors.inputBackground,
          borderRadius: 16
        }}
      />
    </View>
    <View
      style={{
        backgroundColor: colors.inputBackground,
        height: 16,
        marginTop: spacing.small,
        borderRadius: 4
      }}
    />
    <View
      style={{
        backgroundColor: colors.inputBackground,
        height: 16,
        width: '60%',
        marginTop: spacing.small,
        borderRadius: 4
      }}
    />
  </View>
));

// Optimized loading state with skeletons
const QuestListSkeleton = React.memo(() => (
  <View style={{ flex: 1 }}>
    {Array.from({ length: 6 }, (_, i) => (
      <QuestSkeleton key={i} />
    ))}
  </View>
));

// Main quest list component with performance optimizations
const QuestList = React.memo(
  ({
    projectId,
    activeSorting,
    searchQuery,
    activeFilters,
    onQuestPress,
    onLoadMore
  }: {
    projectId: string;
    activeSorting: SortingOption[];
    searchQuery: string;
    activeFilters: Record<string, string[]>;
    onQuestPress: (quest: Quest) => void;
    onLoadMore: () => void;
  }) => {
    const { project: selectedProject } = useProjectById(projectId);

    // Use optimized query with better caching
    const {
      data: infiniteData,
      isFetching,
      isFetchingNextPage,
      isLoading,
      isError,
      error,
      refetch
    } = useInfiniteQuestsWithTagsByProjectId(
      projectId,
      15, // Reduced page size for faster initial load
      activeSorting[0]?.field === 'name' ? activeSorting[0].field : undefined,
      activeSorting[0]?.order
    );

    // Extract and memoize quests with better performance
    const { allQuests, questTags, filteredQuests } = useMemo(() => {
      const quests = infiniteData?.pages?.length
        ? infiniteData.pages.flatMap((page) => page.data)
        : [];

      const tags = quests.length
        ? quests.reduce(
            (acc, quest) => {
              const questTags = quest.tags as { tag: Tag }[] | undefined;
              acc[quest.id] = questTags?.map((tag) => tag.tag) ?? [];
              return acc;
            },
            {} as Record<string, Tag[]>
          )
        : {};

      const filtered =
        quests.length && (searchQuery || Object.keys(activeFilters).length > 0)
          ? filterQuests(
              quests as (Quest & { tags: { tag: Tag }[] })[],
              tags,
              searchQuery,
              activeFilters
            )
          : quests;

      return {
        allQuests: quests,
        questTags: tags,
        filteredQuests: filtered
      };
    }, [infiniteData?.pages, searchQuery, activeFilters]);

    // Show skeleton during initial load
    if (isLoading) {
      return <QuestListSkeleton />;
    }

    // Show error state
    if (isError) {
      return (
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: spacing.large
          }}
        >
          <Text
            style={{
              color: colors.error,
              textAlign: 'center',
              marginBottom: spacing.medium
            }}
          >
            Error loading quests: {error.message}
          </Text>
          <TouchableOpacity
            onPress={() => void refetch()}
            style={styles.retryButton}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <FlatList
        data={filteredQuests}
        renderItem={({ item }) => (
          <QuestItem
            quest={item as Quest & { tags: { tag: Tag }[] }}
            project={selectedProject}
            onPress={onQuestPress}
          />
        )}
        keyExtractor={(item) => item.id}
        style={sharedStyles.list}
        // Performance optimizations
        removeClippedSubviews={true}
        windowSize={8}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={16}
        initialNumToRender={6}
        getItemLayout={(data, index) => ({
          length: 120,
          offset: 120 * index,
          index
        })}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isFetchingNextPage}
            onRefresh={() => void refetch()}
            tintColor={colors.text}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    );
  }
);

// Main component with Suspense boundaries
const Quests = React.memo(() => {
  const { t } = useLocalization();
  const { projectId, projectName } = useLocalSearchParams<{
    projectId: string;
    projectName: string;
  }>();
  const [searchQuery, setSearchQuery] = useState('');
  const { db } = system;
  const { currentUser } = useAuth();

  // Feature flags to toggle button visibility
  const SHOW_SETTINGS_BUTTON = true;
  const SHOW_MEMBERSHIP_BUTTON = true;

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

  const handleLoadMore = useCallback(() => {
    // Load more logic will be handled by QuestList component
  }, []);

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

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <View
          style={[sharedStyles.container, { backgroundColor: 'transparent' }]}
        >
          <PageHeader title={projectName || t('quests')} />

          {/* Search and filters */}
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder={t('search')}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={colors.textSecondary}
            />
            <TouchableOpacity
              onPress={() => setIsFilterModalVisible(true)}
              style={styles.filterButton}
            >
              <Ionicons name="filter" size={20} color={colors.text} />
              {getActiveOptionsCount() > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>
                    {getActiveOptionsCount()}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Quest list with Suspense boundary */}
          <Suspense fallback={<QuestListSkeleton />}>
            <QuestList
              projectId={projectId}
              activeSorting={activeSorting}
              searchQuery={searchQuery}
              activeFilters={activeFilters}
              onQuestPress={handleQuestPress}
              onLoadMore={handleLoadMore}
            />
          </Suspense>

          {/* Floating action buttons */}
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
              style={styles.floatingButton}
            >
              <Ionicons name="stats-chart" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Modals remain the same */}
        <Modal
          visible={isFilterModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setIsFilterModalVisible(false)}
        >
          <View style={{ flex: 1 }}>
            <QuestFilterModal
              onClose={() => setIsFilterModalVisible(false)}
              questTags={{}} // Empty for now - could be improved later
              onApplyFilters={handleApplyFilters}
              onApplySorting={handleApplySorting}
              initialFilters={activeFilters}
              initialSorting={activeSorting}
            />
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
      </SafeAreaView>
    </LinearGradient>
  );
});

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
  },
  questCountContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.medium
  },
  questCountText: {
    color: colors.textSecondary,
    fontSize: fontSizes.small
  },
  filterButton: {
    marginLeft: spacing.small,
    padding: spacing.small,
    position: 'relative'
  },
  filterBadge: {
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
  filterBadgeText: {
    color: colors.buttonText,
    fontSize: fontSizes.small,
    fontWeight: 'bold'
  },
  floatingButton: {
    padding: spacing.small
  }
});

export default Quests;
