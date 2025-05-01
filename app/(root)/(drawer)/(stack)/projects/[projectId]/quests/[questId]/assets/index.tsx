import { AssetFilterModal } from '@/components/AssetFilterModal';
import { DownloadIndicator } from '@/components/DownloadIndicator';
import { PageHeader } from '@/components/PageHeader';
import { QuestDetails } from '@/components/QuestDetails';
import { useAuth } from '@/contexts/AuthContext';
import { useProjectContext } from '@/contexts/ProjectContext';
import type { Asset } from '@/database_services/assetService';
import { assetService } from '@/database_services/assetService';
import { downloadService } from '@/database_services/downloadService';
import type { Quest } from '@/database_services/questService';
import { questService } from '@/database_services/questService';
import type { Tag } from '@/database_services/tagService';
import { tagService } from '@/database_services/tagService';
import type { Translation } from '@/database_services/translationService';
import { translationService } from '@/database_services/translationService';
import type { Vote } from '@/database_services/voteService';
import { voteService } from '@/database_services/voteService';
import type { asset_content_link } from '@/db/drizzleSchema';
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
import { useGlobalSearchParams } from 'expo-router';
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

import { GemIcon } from '@/components/GemIcon';
import PickaxeIcon from '@/components/PickaxeIcon';
import { getGemColor } from '@/utils/progressUtils';
import { sortItems } from '@/utils/sortingUtils';

interface SortingOption {
  field: string;
  order: 'asc' | 'desc';
}

type AggregatedGems = Record<string, number>;

function AssetCard({ asset }: { asset: Asset }) {
  const { currentUser } = useAuth();
  const { isDownloaded: assetsDownloaded, isLoading: isLoadingDownloadStatus } =
    useAssetDownloadStatus([asset.id]);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [translationVotes, setTranslationVotes] = useState<
    Record<string, Vote[]>
  >({});

  useEffect(() => {
    const loadDownloadStatus = async () => {
      if (currentUser) {
        const downloadStatus = await downloadService.getAssetDownloadStatus(
          currentUser.id,
          asset.id
        );
        setIsDownloaded(downloadStatus);
      }
    };
    void loadDownloadStatus();
  }, [asset.id, currentUser]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const assetTranslations =
          await translationService.getTranslationsByAssetId(
            asset.id,
            currentUser?.id
          );
        setTranslations(assetTranslations);

        // Load votes for each translation
        const votesMap: Record<string, Vote[]> = {};
        await Promise.all(
          assetTranslations.map(async (translation) => {
            votesMap[translation.id] =
              await voteService.getVotesByTranslationId(translation.id);
          })
        );
        setTranslationVotes(votesMap);
      } catch (error) {
        console.error('Error loading asset data:', error);
      }
    };
    void loadData();
  }, [asset.id, currentUser]);

  // const { data: tags } = useQuery({
  //   queryKey: ['asset-tags', asset.id],
  //   queryFn: () => tagService.getTagsByAssetId(asset.id)
  // });

  const handleDownloadToggle = async () => {
    if (!currentUser) return;
    try {
      await downloadService.setAssetDownload(
        currentUser.id,
        asset.id,
        !isDownloaded
      );
      setIsDownloaded(!isDownloaded);
    } catch (error) {
      console.error('Error toggling asset download:', error);
    }
  };

  // Aggregate translations by gem color
  const aggregatedGems = translations.reduce<AggregatedGems>(
    (acc, translation) => {
      const gemColor = getGemColor(
        translation,
        translationVotes[translation.id] ?? [],
        currentUser?.id ?? null
      );

      if (gemColor !== null) {
        acc[gemColor] = (acc[gemColor] ?? 0) + 1;
      }

      return acc;
    },
    {}
  );

  return (
    <View style={sharedStyles.card}>
      <DownloadIndicator
        isDownloaded={isDownloaded && assetsDownloaded}
        isLoading={isLoadingDownloadStatus && isDownloaded}
        onPress={handleDownloadToggle}
      />
      <Text style={sharedStyles.cardTitle}>{asset.name}</Text>
      <View style={styles.translationCount}>
        {Object.entries(aggregatedGems).map(([color, count]) => (
          <View key={color} style={styles.gemContainer}>
            {count < 4 ? (
              // If count is less than 4, display that many gems
              Array.from({ length: count }).map((_, index) =>
                color === colors.alert ? (
                  <PickaxeIcon
                    key={index}
                    color={color}
                    width={26}
                    height={20}
                  />
                ) : (
                  <GemIcon key={index} color={color} width={26} height={20} />
                )
              )
            ) : (
              // If count is 4 or more, display one gem with the count
              <>
                {color === colors.alert ? (
                  <PickaxeIcon color={color} width={26} height={20} />
                ) : (
                  <GemIcon color={color} width={26} height={20} />
                )}
                <Text style={{ ...styles.gemCount, marginRight: 8 }}>
                  {count}
                </Text>
              </>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

export default function Assets() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetToTags, setAssetToTags] = useState<Record<string, Tag[]>>({});
  const [filteredAssets, setFilteredAssets] = useState<Asset[]>([]);
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [assetTags, setAssetTags] = useState<Record<string, Tag[]>>({});
  const [assetContents, setAssetContents] = useState<
    Record<string, (typeof asset_content_link.$inferSelect)[]>
  >({});

  const { t } = useTranslation();
  const { goToAsset } = useProjectContext();
  const { questId, projectId } = useGlobalSearchParams<{
    questId: string;
    projectId: string;
  }>();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>(
    {}
  );
  const [activeSorting, setActiveSorting] = useState<SortingOption[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [showQuestStats, setShowQuestStats] = useState(false);
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);

  useEffect(() => {
    void loadAssets();
    void loadQuest();
  }, [questId]);

  const loadAssets = async () => {
    try {
      if (!questId) return;
      const loadedAssets = await assetService.getAssetsByQuestId(questId);
      // Filter out undefined assets
      const validAssets = loadedAssets.filter(
        (asset): asset is Asset => !!asset
      );
      setAssets(validAssets);

      // Load tags and content for all assets
      const tagsMap: Record<string, Tag[]> = {};
      const contentsMap: Record<
        string,
        (typeof asset_content_link.$inferSelect)[]
      > = {};

      await Promise.all(
        validAssets.map(async (asset) => {
          const [tags, content] = await Promise.all([
            tagService.getTagsByAssetId(asset.id),
            assetService.getAssetContent(asset.id)
          ]);
          tagsMap[asset.id] = tags.filter(Boolean);
          contentsMap[asset.id] = content;
        })
      );

      console.log('Tags found for asset: ', tagsMap);
      setAssetTags(tagsMap);
      setAssetContents(contentsMap);

      // Apply default sorting immediately after loading assets and tags
      setTimeout(() => {
        // Using setTimeout to ensure assetTags state is updated before sorting
        const sorted = applySorting(validAssets, []);
        console.log(
          'Sorted assets 0: ',
          sorted.map((asset: Asset) => asset.name)
        );
        // Log the original order for comparison
        console.log(
          'Original assets: ',
          validAssets.map((asset) => asset.name)
        );
        setFilteredAssets(sorted);
      }, 0);
    } catch (error) {
      console.error('Error loading assets:', error);
      Alert.alert('Error', 'Failed to load assets');
    }
  };

  const loadQuest = async () => {
    try {
      if (!questId) return;
      const quest = await questService.getQuestById(questId);
      setSelectedQuest(quest ?? null);
    } catch (error) {
      console.error('Error loading quest:', error);
    }
  };

  const applyFilters = useCallback(
    (
      assetsToFilter: Asset[],
      filters: Record<string, string[]>,
      search: string
    ) => {
      const filteredAssets = [];
      for (const asset of assetsToFilter) {
        // Search filter
        const assetContent = assetContents[asset.id] ?? [];
        const matchesSearch =
          asset.name.toLowerCase().includes(search.toLowerCase()) ||
          assetContent.some((content) =>
            content.text.toLowerCase().includes(search.toLowerCase())
          );

        // Tag filters
        const assetTags = assetToTags[asset.id] ?? [];
        const matchesFilters = Object.entries(filters).every(
          ([category, selectedOptions]) => {
            if (selectedOptions.length === 0) return true;
            return assetTags.some((tag) => {
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

        if (matchesSearch && matchesFilters) {
          filteredAssets.push(asset);
        }
      }
      return filteredAssets;
    },
    [assetToTags, assetContents]
  );

  const applySorting = useCallback(
    (assetsToSort: Asset[], sorting: SortingOption[]) => {
      return sortItems(
        assetsToSort,
        sorting,
        (assetId: string) => assetTags[assetId] ?? []
      );
    },
    [assetTags]
  );

  // Load tags when assets change
  useEffect(() => {
    const loadTags = async () => {
      const tagsMap: Record<string, Tag[]> = {};
      await Promise.all(
        assets.map(async (asset) => {
          tagsMap[asset.id] = (
            await tagService.getTagsByAssetId(asset.id)
          ).filter(Boolean);
        })
      );
      setAssetToTags(tagsMap);
    };
    void loadTags();
  }, [assets]);

  useEffect(() => {
    const updateFilteredAssets = () => {
      const filtered = applyFilters(assets, activeFilters, searchQuery);
      // Always apply sorting, even if activeSorting is empty (which will trigger default sorting)
      const sorted = applySorting(filtered, activeSorting);
      console.log(
        'Sorted assets: ',
        sorted.map((asset: Asset) => asset.name)
      );
      setFilteredAssets(sorted);
    };
    void updateFilteredAssets();
  }, [
    searchQuery,
    activeFilters,
    activeSorting,
    assets,
    applyFilters,
    applySorting
  ]);

  const getActiveOptionsCount = () => {
    const filterCount = Object.values(activeFilters).flat().length;
    const sortCount = activeSorting.length;
    return filterCount + sortCount;
  };

  const handleAssetPress = (asset: Asset) => {
    goToAsset({ asset, questId, projectId });
  };

  const handleCloseDetails = () => {
    setSelectedAsset(null);
    setShowQuestStats(false);
  };

  const handleApplyFilters = (filters: Record<string, string[]>) => {
    setActiveFilters(filters);
    const filtered = applyFilters(assets, filters, searchQuery);
    const sorted = applySorting(filtered, activeSorting);
    console.log(
      'Sorted assets 2: ',
      sorted.map((asset: Asset) => asset.name)
    );
    setFilteredAssets(sorted);
    setIsFilterModalVisible(false);
  };

  const handleApplySorting = (sorting: SortingOption[]) => {
    setActiveSorting(sorting);
    const filtered = applyFilters(assets, activeFilters, searchQuery);
    const sorted = applySorting(filtered, sorting);
    console.log(
      'Sorted assets 3: ',
      sorted.map((asset: Asset) => asset.name)
    );
    setFilteredAssets(sorted);
  };

  const toggleQuestStats = () => {
    setShowQuestStats((prev) => !prev);
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
        if (selectedAsset) {
          setSelectedAsset(null);
          return true;
        }
        return false;
      }
    );

    return () => backHandler.remove();
  }, [isFilterModalVisible, selectedAsset]);

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <View
          style={[sharedStyles.container, { backgroundColor: 'transparent' }]}
        >
          <PageHeader title={selectedQuest?.name ?? ''} />
          <View style={styles.headerContainer}>
            <View style={styles.searchContainer}>
              <Ionicons
                name="search"
                size={20}
                color={colors.text}
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.searchInput}
                placeholder={t('searchAssets')}
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
          </View>

          <FlatList
            data={filteredAssets}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => handleAssetPress(item)}>
                <AssetCard asset={item} />
              </TouchableOpacity>
            )}
            keyExtractor={(item) => item.id}
            style={sharedStyles.list}
          />
          <TouchableOpacity
            onPress={toggleQuestStats}
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
          <AssetFilterModal
            visible={isFilterModalVisible}
            onClose={() => setIsFilterModalVisible(false)}
            assets={assets}
            onApplyFilters={handleApplyFilters}
            onApplySorting={handleApplySorting}
            initialFilters={activeFilters}
            initialSorting={activeSorting}
          />
        </View>
      </Modal>
      {showQuestStats && selectedQuest && (
        <QuestDetails quest={selectedQuest} onClose={handleCloseDetails} />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'column',
    marginBottom: spacing.medium,
    width: '100%'
  },
  statsButton: {
    padding: spacing.small,
    alignSelf: 'flex-end'
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.medium,
    paddingHorizontal: spacing.medium,
    marginTop: spacing.medium,
    marginBottom: spacing.medium,
    width: '100%'
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
  tag: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.small,
    paddingHorizontal: spacing.small,
    marginRight: spacing.small
  },
  translationCount: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    marginTop: spacing.small,
    gap: spacing.xsmall
  },
  gemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xsmall,
    justifyContent: 'center'
  },
  gemCount: {
    color: colors.textSecondary,
    fontSize: fontSizes.small
  }
});
