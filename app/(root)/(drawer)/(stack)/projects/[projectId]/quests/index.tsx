import { PageHeader } from '@/components/PageHeader';
import { ProgressBars } from '@/components/ProgressBars';
// import { PrivateAccessGate } from '@/components/PrivateAccessGate';
import { ProjectDetails } from '@/components/ProjectDetails';
import { ProjectMembershipModal } from '@/components/ProjectMembershipModal';
import { ProjectSettingsModal } from '@/components/ProjectSettingsModal';
import { useAuth } from '@/contexts/AuthContext';
import { useProjectContext } from '@/contexts/ProjectContext';
// import { downloadService } from '@/database_services/downloadService';
import type { Quest } from '@/database_services/questService';
// import type { Tag } from '@/database_services/tagService';
// import { tagService } from '@/database_services/tagService';
import type { project } from '@/db/drizzleSchema';
// import { useAssetDownloadStatus } from '@/hooks/useAssetDownloadStatus';
import { useLocalization } from '@/hooks/useLocalization';
import { useQuestProgress } from '@/hooks/useQuestProgress';
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
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSystem } from '@/contexts/SystemContext';
import { profile_project_link, quest as questTable } from '@/db/drizzleSchema';
import { compareByNumericReference } from '@/utils/sortingUtils';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useQuery as useTanstackQuery } from '@powersync/tanstack-react-query';
import { and, asc, eq } from 'drizzle-orm';

interface SortingOption {
  field: string;
  order: 'asc' | 'desc';
}

interface ProfileProjectLink {
  id: string;
  active: boolean;
  created_at: string;
  last_updated: string;
  profile_id: string;
  project_id: string;
  membership: string | null;
}

// Simplified quest type - just the basic quest data
type SimpleQuest = typeof questTable.$inferSelect;

const QuestCard: React.FC<{ quest: SimpleQuest }> = ({ quest }) => {
  // const { currentUser } = useAuth();
  // const { activeProject } = useProjectContext();
  // const [tags, setTags] = useState<Tag[]>([]);
  // const [assetIds, setAssetIds] = useState<string[]>([]);
  // const [isDownloaded, setIsDownloaded] = useState(false);

  // Get quest progress data
  const { progress, isLoading } = useQuestProgress(quest.id);

  // Comment out the data loading for now
  // useEffect(() => {
  //   const loadData = async () => {
  //     try {
  //       const [questTags, assets] = await Promise.all([
  //         tagService.getTagsByQuestId(quest.id),
  //         assetService.getAssetsByQuestId(quest.id)
  //       ]);
  //       setTags(questTags.filter(Boolean));
  //       setAssetIds(assets.map((asset) => asset?.id).filter(Boolean));

  //       // Get quest download status
  //       if (currentUser) {
  //         const downloadStatus = await downloadService.getQuestDownloadStatus(
  //           currentUser.id,
  //           quest.id
  //         );
  //         setIsDownloaded(downloadStatus);
  //       }
  //     } catch (error) {
  //       console.error('Error loading quest data:', error);
  //     }
  //   };
  //   void loadData();
  // }, [quest.id, currentUser]);

  // const { isDownloaded: assetsDownloaded, isLoading } =
  //   useAssetDownloadStatus(assetIds);

  // const handleDownloadToggle = async () => {
  //   if (!currentUser) return;
  //   try {
  //     await downloadService.setQuestDownload(
  //       currentUser.id,
  //       quest.id,
  //       !isDownloaded
  //     );
  //     setIsDownloaded(!isDownloaded);
  //   } catch (error) {
  //     console.error('Error toggling quest download:', error);
  //   }
  // };

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
        {/* Comment out download indicator for now */}
        {/* <PrivateAccessGate
          projectId={quest.project_id}
          projectName={activeProject?.name || ''}
          isPrivate={activeProject?.private || false}
          action="download"
          allowBypass={true}
          onBypass={handleDownloadToggle}
          renderTrigger={({ onPress, hasAccess }) => (
            <DownloadIndicator
              isDownloaded={isDownloaded && assetsDownloaded}
              isLoading={isLoading && isDownloaded}
              onPress={
                hasAccess || isDownloaded ? handleDownloadToggle : onPress
              }
            />
          )}
        /> */}
      </View>
      {quest.description && (
        <Text style={sharedStyles.cardDescription}>{quest.description}</Text>
      )}

      {/* Show progress bars if data is loaded */}
      {!isLoading && progress && progress.totalAssets > 0 && (
        <ProgressBars
          approvedPercentage={progress.approvedPercentage}
          userContributedPercentage={progress.userContributedPercentage}
          pickaxeCount={progress.pendingTranslationsCount}
        />
      )}

      {/* {tags.length > 0 && (
        <View style={sharedStyles.cardInfo}>
          {tags.slice(0, 3).map((tag, index) => (
            <Text key={tag.id} style={sharedStyles.cardInfoText}>
              {tag.name.split(':')[1]}
              {index < Math.min(tags.length - 1, 2) && ' • '}
            </Text>
          ))}
          {tags.length > 3 && (
            <Text style={sharedStyles.cardInfoText}> ...</Text>
          )}
        </View>
      )} */}
    </View>
  );
};

export default function Quests() {
  const { t } = useLocalization();
  const { projectId, projectName } = useLocalSearchParams<{
    projectId: string;
    projectName: string;
  }>();
  const { db } = useSystem();
  const { currentUser } = useAuth();

  // Feature flags to toggle button visibility
  const SHOW_SETTINGS_BUTTON = true; // Set to false to hide settings button
  const SHOW_MEMBERSHIP_BUTTON = true; // Set to false to hide membership button

  const PAGE_SIZE = 10;
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [activeFilters] = useState<Record<string, string[]>>({});
  const [activeSorting] = useState<SortingOption[]>([]);
  const [showProjectStats, setShowProjectStats] = useState(false);
  const [selectedProject] = useState<typeof project.$inferSelect | null>(null);
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Infinite scroll state
  const [allQuests, setAllQuests] = useState<SimpleQuest[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const { goToQuest } = useProjectContext();

  // Query to check if current user is an owner
  const { data: currentUserLinkData } = useTanstackQuery({
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

  // Handle the case where data might be an array
  const currentUserLink = Array.isArray(currentUserLinkData)
    ? currentUserLinkData[0]
    : currentUserLinkData;

  const isOwner =
    (currentUserLink as ProfileProjectLink | undefined)?.membership === 'owner';

  // Simplified query for quests - just basic data
  const { data: questsData } = useTanstackQuery({
    queryKey: ['quests-simple', projectId],
    query: toCompilableQuery(
      db
        .select()
        .from(questTable)
        .where(eq(questTable.project_id, projectId))
        .orderBy(asc(questTable.name))
    ),
    enabled: !!projectId
  });

  // Process and filter quests whenever data changes
  useEffect(() => {
    if (!questsData) return;

    let processedQuests = [...questsData];

    // Apply search filter
    if (searchQuery) {
      processedQuests = processedQuests.filter(
        (quest) =>
          quest.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (quest.description
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase()) ??
            false)
      );
    }

    // Apply tag filters - commented out for now since we're not loading tags
    // if (Object.keys(activeFilters).length > 0) {
    //   processedQuests = processedQuests.filter((quest) => {
    //     return Object.entries(activeFilters).every(
    //       ([category, selectedOptions]) => {
    //         if (selectedOptions.length === 0) return true;
    //         return quest.tags.some(({ tag }) => {
    //           const [tagCategory, tagValue] = tag.name.split(':');
    //           return (
    //             tagCategory?.toLowerCase() === category.toLowerCase() &&
    //             selectedOptions.includes(
    //               `${category.toLowerCase()}:${tagValue?.toLowerCase()}`
    //             )
    //           );
    //         });
    //       }
    //     );
    //   });
    // }

    // Apply sorting
    if (activeSorting.length === 0) {
      // Default sorting using numeric reference comparison
      processedQuests.sort((a, b) => compareByNumericReference(a.name, b.name));
    } else {
      // Apply custom sorting - commented out for now since we're not loading tags
      // processedQuests = sortItems(
      //   processedQuests,
      //   activeSorting,
      //   (questId: string) =>
      //     processedQuests
      //       .find((quest) => quest.id === questId)
      //       ?.tags.map((t) => ({ name: t.tag.name })) ?? []
      // );
    }

    // Reset when filters change (currentPage === 0) or append for pagination
    if (currentPage === 0) {
      setAllQuests(processedQuests.slice(0, PAGE_SIZE));
    } else {
      const startIndex = currentPage * PAGE_SIZE;
      const endIndex = startIndex + PAGE_SIZE;
      const pageQuests = processedQuests.slice(startIndex, endIndex);
      setAllQuests((prev) => [...prev, ...pageQuests]);
      setHasMore(pageQuests.length === PAGE_SIZE);
    }

    setIsLoadingMore(false);
  }, [questsData, searchQuery, activeFilters, activeSorting, currentPage]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(0);
    setHasMore(true);
  }, [searchQuery, activeFilters, activeSorting]);

  const loadMore = () => {
    if (!isLoadingMore && hasMore) {
      setIsLoadingMore(true);
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handleQuestPress = (quest: Quest) => {
    goToQuest(quest);
  };

  const handleCloseDetails = () => {
    setShowProjectStats(false);
  };

  // const handleApplyFilters = (filters: Record<string, string[]>) => {
  //   setActiveFilters(filters);
  //   setIsFilterModalVisible(false);
  // };

  // const handleApplySorting = (sorting: SortingOption[]) => {
  //   setActiveSorting(sorting);
  // };

  const toggleProjectStats = () => {
    setShowProjectStats((prev) => !prev);
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
            {/* Comment out filter button for now */}
            {/* <TouchableOpacity
              onPress={() => setIsFilterModalVisible(true)}
              style={styles.filterIcon}
            >
              <Ionicons name="filter" size={20} color={colors.text} />
              {Object.values(activeFilters).flat().length > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {Object.values(activeFilters).flat().length}
                  </Text>
                </View>
              )}
            </TouchableOpacity> */}
          </View>

          <FlatList
            data={allQuests}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => handleQuestPress(item)}>
                <QuestCard quest={item} />
              </TouchableOpacity>
            )}
            keyExtractor={(item) => item.id}
            style={sharedStyles.list}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              isLoadingMore ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : null
            }
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
      {/* Comment out filter modal for now */}
      {/* <Modal
        visible={isFilterModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsFilterModalVisible(false)}
      >
        <View style={{ flex: 1 }}>
          <QuestFilterModal
            onClose={() => setIsFilterModalVisible(false)}
            quests={allQuests}
            onApplyFilters={handleApplyFilters}
            onApplySorting={handleApplySorting}
            initialFilters={activeFilters}
            initialSorting={activeSorting}
          />
        </View>
      </Modal> */}
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
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.medium,
    marginVertical: spacing.small
  }
});
