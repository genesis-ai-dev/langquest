import { QuestDetails } from '@/components/QuestDetails';
import { QuestFilterModal } from '@/components/QuestFilterModal';
import { ProjectDetails } from '@/components/ProjectDetails';
import { PageHeader } from '@/components/PageHeader';
import { useProjectContext } from '@/contexts/ProjectContext';
import { Quest, questService } from '@/database_services/questService';
import { Project, projectService } from '@/database_services/projectService';
import { Tag, tagService } from '@/database_services/tagService';
import { useTranslation } from '@/hooks/useTranslation';
import { project } from '@/db/drizzleSchema';
import {
  borderRadius,
  colors,
  fontSizes,
  sharedStyles,
  spacing
} from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
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
import { Asset, assetService } from '@/database_services/assetService';
import {
  Translation,
  translationService
} from '@/database_services/translationService';
import { Vote, voteService } from '@/database_services/voteService';
import { calculateQuestProgress } from '@/utils/progressUtils';
import { useAuth } from '@/contexts/AuthContext';
import { GemIcon } from '@/components/GemIcon';

interface SortingOption {
  field: string;
  order: 'asc' | 'desc';
}

const QuestCard: React.FC<{ quest: Quest }> = ({ quest }) => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [translations, setTranslations] = useState<
    Record<string, Translation[]>
  >({});
  const [votes, setVotes] = useState<Record<string, Vote[]>>({});
  const { currentUser } = useAuth();

  useEffect(() => {
    const loadQuestData = async () => {
      try {
        // Load tags
        const questTags = await tagService.getTagsByQuestId(quest.id);
        setTags(questTags);

        // Load assets
        const questAssets = await assetService.getAssetsByQuestId(quest.id);
        setAssets(questAssets);

        // Load translations and votes for each asset
        const translationsMap: Record<string, Translation[]> = {};
        const votesMap: Record<string, Vote[]> = {};

        await Promise.all(
          questAssets.map(async (asset) => {
            const assetTranslations =
              await translationService.getTranslationsByAssetId(asset.id);
            translationsMap[asset.id] = assetTranslations;

            // Load votes for each translation
            await Promise.all(
              assetTranslations.map(async (translation) => {
                const translationVotes =
                  await voteService.getVotesByTranslationId(translation.id);
                votesMap[translation.id] = translationVotes;
              })
            );
          })
        );

        setTranslations(translationsMap);
        setVotes(votesMap);
      } catch (error) {
        console.error('Error loading quest data:', error);
      }
    };

    loadQuestData();
  }, [quest.id]);

  const progress = calculateQuestProgress(
    assets,
    translations,
    votes,
    currentUser?.id || null
  );

  return (
    <View style={sharedStyles.card}>
      <Text style={sharedStyles.cardTitle}>{quest.name}</Text>
      {quest.description && (
        <Text style={sharedStyles.cardDescription}>{quest.description}</Text>
      )}

      {/* Progress bars */}
      <View style={styles.progressContainer}>
        {/* Approved translations progress bar */}
        <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBar,
              styles.approvedBar,
              { width: `${progress.approvedPercentage}%` }
            ]}
          />
          {/* User's pending translations progress bar */}
          <View
            style={[
              styles.progressBar,
              styles.userPendingBar,
              { width: `${progress.userContributedPercentage}%` }
            ]}
          />
        </View>

        {/* Pending translations gem */}
        {progress.pendingTranslationsCount > 0 && (
          <View style={styles.gemContainer}>
            <GemIcon color={colors.alert} width={16} height={16} />
            <Text style={styles.gemCount}>
              {progress.pendingTranslationsCount}
            </Text>
          </View>
        )}
      </View>

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
  const router = useRouter();
  const { projectId, projectName } = useLocalSearchParams<{
    projectId: string;
    projectName: string;
  }>();
  const [searchQuery, setSearchQuery] = useState('');
  const [quests, setQuests] = useState<Quest[]>([]);
  const [questToTags, setQuestToTags] = useState<Record<string, Tag[]>>({});
  const [filteredQuests, setFilteredQuests] = useState<Quest[]>([]);
  const [questTags, setQuestTags] = useState<Record<string, Tag[]>>({});
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>(
    {}
  );
  const [activeSorting, setActiveSorting] = useState<SortingOption[]>([]);
  // const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);
  const [showProjectStats, setShowProjectStats] = useState(false);
  const [selectedProject, setSelectedProject] = useState<
    typeof project.$inferSelect | null
  >(null);

  const { goToQuest } = useProjectContext();

  useEffect(() => {
    loadQuests();
    loadProject();
  }, [projectId]);

  const loadQuests = async () => {
    try {
      if (!projectId) return;
      const loadedQuests = await questService.getQuestsByProjectId(projectId);
      setQuests(loadedQuests);
      setFilteredQuests(loadedQuests);

      // Load tags for all quests
      const tagsMap: Record<string, Tag[]> = {};
      await Promise.all(
        loadedQuests.map(async (quest) => {
          tagsMap[quest.id] = await tagService.getTagsByQuestId(quest.id);
        })
      );
      setQuestTags(tagsMap);
    } catch (error) {
      console.error('Error loading quests:', error);
      Alert.alert('Error', t('failedLoadQuests'));
    }
  };

  const loadProject = async () => {
    try {
      if (!projectId) return;
      const project = await projectService.getProjectById(projectId);
      setSelectedProject(project);
    } catch (error) {
      console.error('Error loading project:', error);
    }
  };

  const applyFilters = useCallback(
    (
      questsToFilter: Quest[],
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
        const questTags = questToTags[quest.id] || [];
        const matchesFilters = Object.entries(filters).every(
          ([category, selectedOptions]) => {
            if (selectedOptions.length === 0) return true;
            return questTags.some((tag) => {
              const [tagCategory, tagValue] = tag.name.split(':');
              return (
                tagCategory.toLowerCase() === category.toLowerCase() &&
                selectedOptions.includes(
                  `${category.toLowerCase()}:${tagValue.toLowerCase()}`
                )
              );
            });
          }
        );

        return matchesSearch && matchesFilters;
      });
    },
    [questToTags]
  );

  const applySorting = useCallback(
    (questsToSort: Quest[], sorting: SortingOption[]) => {
      return [...questsToSort].sort((a, b) => {
        for (const { field, order } of sorting) {
          if (field === 'name') {
            const comparison = a.name.localeCompare(b.name);
            return order === 'asc' ? comparison : -comparison;
          } else {
            const tagsA = questTags[a.id] || [];
            const tagsB = questTags[b.id] || [];
            const tagA =
              tagsA
                .find((tag) => tag.name.startsWith(`${field}:`))
                ?.name.split(':')[1] || '';
            const tagB =
              tagsB
                .find((tag) => tag.name.startsWith(`${field}:`))
                ?.name.split(':')[1] || '';
            const comparison = tagA.localeCompare(tagB);
            if (comparison !== 0)
              return order === 'asc' ? comparison : -comparison;
          }
        }
        return 0;
      });
    },
    [questTags]
  );

  // Load tags when quests change
  useEffect(() => {
    const loadTags = async () => {
      const tagsMap: Record<string, Tag[]> = {};
      await Promise.all(
        quests.map(async (quest) => {
          tagsMap[quest.id] = await tagService.getTagsByQuestId(quest.id);
        })
      );
      setQuestToTags(tagsMap);
    };
    loadTags();
  }, [quests]);

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
    // setSelectedQuest(null);
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
        // if (selectedQuest) {
        //   setSelectedQuest(null);
        //   return true;
        // }
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
          <TouchableOpacity
            onPress={toggleProjectStats}
            style={styles.statsButton}
          >
            <Ionicons name="stats-chart" size={24} color={colors.text} />
          </TouchableOpacity>
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
            visible={isFilterModalVisible}
            onClose={() => setIsFilterModalVisible(false)}
            quests={quests}
            // questTags={questTags}
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
  statsButton: {
    padding: spacing.small,
    alignSelf: 'flex-end'
  },
  title: {
    fontSize: fontSizes.xxlarge,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
    textAlign: 'center'
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.small,
    gap: spacing.small
  },
  progressBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.small,
    overflow: 'hidden',
    flexDirection: 'row'
  },
  progressBar: {
    height: '100%'
  },
  approvedBar: {
    backgroundColor: colors.success
  },
  userPendingBar: {
    backgroundColor: colors.textSecondary
  },
  gemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xsmall
  },
  gemCount: {
    color: colors.text,
    fontSize: fontSizes.small
  }
});
