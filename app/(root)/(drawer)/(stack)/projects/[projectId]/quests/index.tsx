import { DownloadIndicator } from '@/components/DownloadIndicator';
import { PageHeader } from '@/components/PageHeader';
import { ProgressBars } from '@/components/ProgressBars';
import { ProjectDetails } from '@/components/ProjectDetails';
import { ProjectMembershipModal } from '@/components/ProjectMembershipModal';
import { ProjectSettingsModal } from '@/components/ProjectSettingsModal';
import { QuestFilterModal } from '@/components/QuestFilterModal';
import { useAuth } from '@/contexts/AuthContext';
import { useProjectContext } from '@/contexts/ProjectContext';
import { downloadService } from '@/database_services/downloadService';
import { projectService } from '@/database_services/projectService';
import type { Quest } from '@/database_services/questService';
import type { Tag } from '@/database_services/tagService';
import { tagService } from '@/database_services/tagService';
import type { project } from '@/db/drizzleSchema';
import { useAssetDownloadStatus } from '@/hooks/useAssetDownloadStatus';
import { useTranslation } from '@/hooks/useTranslation';
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
import React, { useCallback, useEffect, useState } from 'react';
import {
  BackHandler,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSystem } from '@/contexts/SystemContext';
import { assetService } from '@/database_services/assetService';
import { profile_project_link, quest as questTable } from '@/db/drizzleSchema';
import { calculateQuestProgress } from '@/utils/progressUtils';
import { sortItems } from '@/utils/sortingUtils';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useQuery } from '@powersync/react-native';
import { useQuery as useTanstackQuery } from '@powersync/tanstack-react-query';
import { and, eq } from 'drizzle-orm';

interface SortingOption {
  field: string;
  order: 'asc' | 'desc';
}

// First, let's create a type that represents the shape of our query result
interface QuestWithRelations {
  id: string;
  name: string;
  description: string | null;
  project_id: string;
  active: boolean;
  visible: boolean;
  creator_id: string | null;
  created_at: string;
  last_updated: string;
  tags: {
    tag: {
      name: string;
    };
  }[];
  assets: {
    asset: {
      id: string;
      name: string;
      translations: {
        id: string;
        text: string | null;
        creator_id: string;
        votes: {
          id: string;
          polarity: 'up' | 'down';
          creator_id: string;
        }[];
      }[];
    };
  }[];
}

const QuestCard: React.FC<{ quest: QuestWithRelations }> = ({ quest }) => {
  const { currentUser } = useAuth();
  const [tags, setTags] = useState<Tag[]>([]);
  const [assetIds, setAssetIds] = useState<string[]>([]);
  const [isDownloaded, setIsDownloaded] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [questTags, assets] = await Promise.all([
          tagService.getTagsByQuestId(quest.id),
          assetService.getAssetsByQuestId(quest.id)
        ]);
        setTags(questTags.filter(Boolean));
        setAssetIds(assets.map((asset) => asset?.id).filter(Boolean));

        // Get quest download status
        if (currentUser) {
          const downloadStatus = await downloadService.getQuestDownloadStatus(
            currentUser.id,
            quest.id
          );
          setIsDownloaded(downloadStatus);
        }
      } catch (error) {
        console.error('Error loading quest data:', error);
      }
    };
    void loadData();
  }, [quest.id, currentUser]);

  const { isDownloaded: assetsDownloaded, isLoading } =
    useAssetDownloadStatus(assetIds);

  const handleDownloadToggle = async () => {
    if (!currentUser) return;
    try {
      await downloadService.setQuestDownload(
        currentUser.id,
        quest.id,
        !isDownloaded
      );
      setIsDownloaded(!isDownloaded);
    } catch (error) {
      console.error('Error toggling quest download:', error);
    }
  };

  const progress = calculateQuestProgress(
    quest.assets.map((asset) => asset.asset),

    currentUser?.id ?? null
  );
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
        <DownloadIndicator
          isDownloaded={isDownloaded && assetsDownloaded}
          isLoading={isLoading && isDownloaded}
          onPress={handleDownloadToggle}
        />
      </View>
      {quest.description && (
        <Text style={sharedStyles.cardDescription}>{quest.description}</Text>
      )}

      <ProgressBars
        approvedPercentage={progress.approvedPercentage}
        userContributedPercentage={progress.userContributedPercentage}
        pickaxeCount={progress.pendingTranslationsCount}
      />

      {tags.length > 0 && (
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
      )}
    </View>
  );
};

export default function Quests() {
  const { t } = useTranslation();
  const { projectId, projectName } = useLocalSearchParams<{
    projectId: string;
    projectName: string;
  }>();
  const [searchQuery, setSearchQuery] = useState('');
  const { db } = useSystem();
  const { currentUser } = useAuth();
  const quests: QuestWithRelations[] = useQuery(
    toCompilableQuery(
      db.query.quest.findMany({
        where: eq(questTable.project_id, projectId),
        with: {
          tags: {
            with: {
              tag: {
                columns: {
                  name: true
                }
              }
            }
          },
          assets: {
            with: {
              asset: {
                with: {
                  translations: {
                    with: {
                      votes: true,
                      creator: true
                    }
                  }
                }
              }
            }
          }
        }
      })
    )
  ).data;
  const [filteredQuests, setFilteredQuests] = useState<typeof quests>([]);
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>(
    {}
  );
  const [activeSorting, setActiveSorting] = useState<SortingOption[]>([]);
  const [showProjectStats, setShowProjectStats] = useState(false);
  const [selectedProject, setSelectedProject] = useState<
    typeof project.$inferSelect | null
  >(null);
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const { goToQuest } = useProjectContext();

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

  useEffect(() => {
    void loadProject();
  }, [projectId]);

  const loadProject = async () => {
    try {
      if (!projectId) return;
      const project = await projectService.getProjectById(projectId);
      setSelectedProject(project ?? null);
    } catch (error) {
      console.error('Error loading project:', error);
    }
  };

  const applyFilters = useCallback(
    (
      questsToFilter: typeof quests,
      filters: Record<string, string[]>,
      search: string
    ) => {
      return questsToFilter.filter((quest) => {
        // Search filter
        const matchesSearch =
          quest.name.toLowerCase().includes(search.toLowerCase()) ||
          (quest.description?.toLowerCase().includes(search.toLowerCase()) ??
            false);

        // Tag filters
        const questTags = quest.tags;
        const matchesFilters = Object.entries(filters).every(
          ([category, selectedOptions]) => {
            if (selectedOptions.length === 0) return true;
            return questTags.some(({ tag }) => {
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
    },
    [quests]
  );

  const applySorting = useCallback(
    (questsToSort: typeof quests, sorting: SortingOption[]) => {
      return sortItems(
        questsToSort,
        sorting,
        (questId: string) =>
          quests
            .find((quest) => quest.id === questId)
            ?.tags.map((t) => ({ name: t.tag.name })) ?? []
      );
    },
    [quests]
  );

  // Update filtered quests when search query changes
  useEffect(() => {
    const filtered = applyFilters(quests, activeFilters, searchQuery);
    const sorted = applySorting(filtered, activeSorting);
    setFilteredQuests(sorted);
  }, [
    searchQuery,
    quests,
    activeFilters,
    activeSorting,
    applyFilters,
    applySorting
  ]);

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
    const filtered = applyFilters(quests, filters, searchQuery);
    const sorted = applySorting(filtered, activeSorting);
    setFilteredQuests(sorted);
    setIsFilterModalVisible(false);
  };

  const handleApplySorting = (sorting: SortingOption[]) => {
    setActiveSorting(sorting);
    const filtered = applyFilters(quests, activeFilters, searchQuery);
    const sorted = applySorting(filtered, sorting);
    setFilteredQuests(sorted);
  };

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
                <QuestCard quest={item} />
              </TouchableOpacity>
            )}
            keyExtractor={(item) => item.id}
            style={sharedStyles.list}
          />
          <View style={styles.floatingButtonsContainer}>
            {isOwner && (
              <TouchableOpacity
                onPress={() => setShowSettingsModal(true)}
                style={styles.settingsButton}
              >
                <Ionicons name="settings" size={24} color={colors.text} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => setShowMembershipModal(true)}
              style={styles.membersButton}
            >
              <Ionicons name="people" size={24} color={colors.text} />
            </TouchableOpacity>
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
          <QuestFilterModal
            onClose={() => setIsFilterModalVisible(false)}
            quests={quests}
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
  }
});
