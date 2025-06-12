import { DownloadIndicator } from '@/components/DownloadIndicator';
import { PageHeader } from '@/components/PageHeader';
import { ProgressBars } from '@/components/ProgressBars';
import { ProjectDetails } from '@/components/ProjectDetails';
import { QuestFilterModal } from '@/components/QuestFilterModal';
import { useAuth } from '@/contexts/AuthContext';
import { useProjectContext } from '@/contexts/ProjectContext';
import type { Quest } from '@/database_services/questService';
import type { Tag } from '@/database_services/tagService';
import { useAttachmentAssetDownloadStatus } from '@/hooks/useAssetDownloadStatus';
import { useQuestDownload } from '@/hooks/useDownloads';
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
import React, { useEffect, useMemo, useState } from 'react';
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

import type { Translation } from '@/database_services/translationService';
import type { Vote } from '@/database_services/voteService';
import { useAssetsWithTranslationsAndVotesByQuestId } from '@/hooks/db/useAssets';
import { useProjectById } from '@/hooks/db/useProjects';
import { useQuestsWithTagsByProjectId } from '@/hooks/db/useQuests';
import { calculateQuestProgress } from '@/utils/progressUtils';
import { sortItems } from '@/utils/sortingUtils';

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

const QuestCard: React.FC<{ quest: Quest & { tags: { tag: Tag }[] } }> = ({
  quest
}) => {
  const { currentUser } = useAuth();

  // Use the new download hook
  const {
    isDownloaded,
    isLoading: _downloadLoading,
    toggleDownload
  } = useQuestDownload(currentUser?.id, quest.id);

  const handleDownloadToggle = () => {
    toggleDownload();
  };

  const { assets: assetsData } = useAssetsWithTranslationsAndVotesByQuestId(
    quest.id
  );
  const assets = assetsData ?? [];

  const assetIds = assets.map((asset) => asset.id).filter(Boolean);

  const { isDownloaded: assetsDownloaded, isLoading } =
    useAttachmentAssetDownloadStatus(assetIds);

  const translationsMap = assets.reduce(
    (acc, asset) => {
      acc[asset.id] = asset.translations;
      return acc;
    },
    {} as Record<string, Translation[]>
  );

  const votesMap = assets.reduce(
    (acc, asset) => {
      acc[asset.id] = asset.translations.flatMap(
        (translation) => translation.votes
      );
      return acc;
    },
    {} as Record<string, Vote[]>
  );

  const progress = calculateQuestProgress(
    assets,
    translationsMap,
    votesMap,
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
          isLoading={isLoading || _downloadLoading}
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
  const { t } = useTranslation();
  const { projectId, projectName } = useLocalSearchParams<{
    projectId: string;
    projectName: string;
  }>();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>(
    {}
  );
  const [activeSorting, setActiveSorting] = useState<SortingOption[]>([]);
  // const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);
  const [showProjectStats, setShowProjectStats] = useState(false);

  const { goToQuest } = useProjectContext();

  const { project: selectedProject } = useProjectById(projectId);
  const { quests: questsData } = useQuestsWithTagsByProjectId(projectId);
  const quests = questsData ?? [];
  const questTags = useMemo(() => {
    return quests.reduce(
      (acc, quest) => {
        acc[quest.id] = quest.tags.map((tag) => tag.tag);
        return acc;
      },
      {} as Record<string, Tag[]>
    );
  }, [quests]);

  // Compute filtered quests directly without useEffect to avoid infinite loop
  const filteredQuests = useMemo(() => {
    const filtered = filterQuests(
      quests,
      questTags,
      searchQuery,
      activeFilters
    );
    return sortItems(
      filtered,
      activeSorting,
      (questId: string) => questTags[questId] ?? []
    );
  }, [quests, questTags, searchQuery, activeFilters, activeSorting]);

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
    setIsFilterModalVisible(false);
  };

  const handleApplySorting = (sorting: SortingOption[]) => {
    setActiveSorting(sorting);
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
          <View style={styles.floatingButtonsContainer}>
            {/* {SHOW_MEMBERSHIP_BUTTON && (
              <TouchableOpacity
                onPress={() => setShowMembershipModal(true)}
                style={styles.membersButton}
              >
                x
                <Ionicons name="people" size={24} color={colors.text} />
              </TouchableOpacity>
            )} */}
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
            questTags={questTags}
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
      {/* {projectId && (
        <ProjectMembershipModal
          isVisible={showMembershipModal}
          onClose={() => setShowMembershipModal(false)}
          projectId={projectId}
        />
      )} */}
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
