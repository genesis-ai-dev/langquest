import { AssetFilterModal } from '@/components/AssetFilterModal';
import { QuestDetails } from '@/components/QuestDetails';
import { useProjectContext } from '@/contexts/ProjectContext';
import { Asset, assetService } from '@/database_services/assetService';
import { Tag, tagService } from '@/database_services/tagService';
import { useTranslation } from '@/hooks/useTranslation';
import { asset_content_link } from '@/db/drizzleSchema';
import {
  borderRadius,
  colors,
  fontSizes,
  sharedStyles,
  spacing
} from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { type FC, useCallback, useEffect, useState } from 'react';
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
import { useAuth } from '@/contexts/AuthContext';
import { downloadService } from '@/database_services/downloadService';
import { DownloadIndicator } from '@/components/DownloadIndicator';
import { useAssetDownloadStatus } from '@/hooks/useAssetDownloadStatus';
import { useQuery } from '@tanstack/react-query';
import { Quest, questService } from '@/database_services/questService';
import { PageHeader } from '@/components/PageHeader';

interface SortingOption {
  field: string;
  order: 'asc' | 'desc';
}

function AssetCard({ asset }: { asset: Asset }) {
  const { currentUser } = useAuth();
  const { isDownloaded, isLoading } = useAssetDownloadStatus([asset.id]);

  const { data: tags } = useQuery({
    queryKey: ['asset-tags', asset.id],
    queryFn: () => tagService.getTagsByAssetId(asset.id)
  });

  const handleDownloadToggle = async () => {
    if (!currentUser) return;
    try {
      await downloadService.setAssetDownload(
        currentUser.id,
        asset.id,
        !isDownloaded
      );
    } catch (error) {
      console.error('Error toggling asset download:', error);
    }
  };

  return (
    <View style={sharedStyles.card}>
      <DownloadIndicator
        isDownloaded={isDownloaded}
        isLoading={isLoading}
        onPress={handleDownloadToggle}
      />
      <Text style={sharedStyles.cardTitle}>{asset.name}</Text>
      {/* {asset.description && (
        <Text style={sharedStyles.cardDescription}>{quest.description}</Text>
      )} */}
      {tags && tags.length > 0 && (
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
    loadAssets();
    loadQuest();
  }, [questId]);

  const loadAssets = async () => {
    try {
      if (!questId) return;
      const loadedAssets = await assetService.getAssetsByQuestId(questId);
      setAssets(loadedAssets);

      // Load tags and content for all assets
      const tagsMap: Record<string, Tag[]> = {};
      const contentsMap: Record<
        string,
        (typeof asset_content_link.$inferSelect)[]
      > = {};

      await Promise.all(
        loadedAssets.map(async (asset) => {
          const [tags, content] = await Promise.all([
            tagService.getTagsByAssetId(asset.id),
            assetService.getAssetContent(asset.id)
          ]);
          tagsMap[asset.id] = tags;
          contentsMap[asset.id] = content;
        })
      );

      console.log('Tags found for asset: ', tagsMap);
      setAssetTags(tagsMap);
      setAssetContents(contentsMap);

      // Apply default sorting immediately after loading assets and tags
      // This ensures assets are displayed in a consistent order by default
      setTimeout(() => {
        // Using setTimeout to ensure assetTags state is updated before sorting
        const sorted = applySorting(loadedAssets, []);
        console.log(
          'Sorted assets 0: ',
          sorted.map((asset) => asset.name)
        );
        // Log the original order for comparison
        console.log(
          'Original assets: ',
          loadedAssets.map((asset) => asset.name)
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
      setSelectedQuest(quest);
    } catch (error) {
      console.error('Error loading quest:', error);
    }
  };

  const applyFilters = useCallback(
    async (
      assetsToFilter: Asset[],
      filters: Record<string, string[]>,
      search: string
    ) => {
      const filteredAssets = [];
      for (const asset of assetsToFilter) {
        // Search filter
        const assetContent = assetContents[asset.id] || [];
        const matchesSearch =
          asset.name.toLowerCase().includes(search.toLowerCase()) ||
          assetContent.some((content) =>
            content.text.toLowerCase().includes(search.toLowerCase())
          );

        // Tag filters
        const assetTags = assetToTags[asset.id] || [];
        const matchesFilters = Object.entries(filters).every(
          ([category, selectedOptions]) => {
            if (selectedOptions.length === 0) return true;
            return assetTags.some((tag) => {
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
      // Helper function to extract and parse numeric references from text
      const extractNumericReferences = (text: string): number[] | null => {
        // First split by whitespace to get tokens
        const tokens = text.split(/\s+/);

        // Look for tokens that might contain numeric references (with : or .)
        for (const token of tokens) {
          // Remove any parentheses and their contents
          const cleanToken = token.replace(/\([^)]*\)/g, '').trim();

          if (cleanToken.includes(':') || cleanToken.includes('.')) {
            const separator = cleanToken.includes(':') ? ':' : '.';
            const parts = cleanToken.split(separator).map((part) => {
              // Try to parse as integer, handling non-numeric characters
              const num = parseInt(part.replace(/\D/g, ''), 10);
              return isNaN(num) ? null : num;
            });

            // Make sure all parts are valid numbers
            if (parts.length > 1 && parts[0] !== null && parts[1] !== null) {
              return parts.filter((part): part is number => part !== null);
            }
          }
        }

        // If no valid reference found, look for any numeric token
        for (const token of tokens) {
          // Skip tokens that are likely part of parenthetical content
          if (token.startsWith('(') || token.endsWith(')')) continue;

          const num = parseInt(token.replace(/\D/g, ''), 10);
          if (!isNaN(num)) {
            return [num];
          }
        }

        return null; // No numeric reference found
      };

      // If no sorting options are provided, apply default sorting
      if (sorting.length === 0) {
        // Default sorting based on numeric references in asset names or tags
        return [...assetsToSort].sort((a, b) => {
          // First try to extract numeric references from asset names
          const refsA = extractNumericReferences(a.name);
          const refsB = extractNumericReferences(b.name);

          // Debug log to see what's being extracted
          if (a.name.includes('Lucas') || b.name.includes('Lucas')) {
            console.log(
              `Comparing: "${a.name}" (${refsA}) vs "${b.name}" (${refsB})`
            );
          }

          // If both have numeric references, compare them
          if (refsA && refsB) {
            // Compare first parts (chapters)
            if (refsA[0] !== refsB[0]) {
              return refsA[0] - refsB[0];
            }

            // If first parts are the same and there are second parts, compare them (verses)
            if (refsA.length > 1 && refsB.length > 1) {
              return refsA[1] - refsB[1];
            }
          }

          // If one has numeric references and the other doesn't, prioritize the one with references
          if (refsA && !refsB) return -1;
          if (!refsA && refsB) return 1;

          // If no numeric references in names or they're equal, try tags
          const tagsA = assetTags[a.id] || [];
          const tagsB = assetTags[b.id] || [];

          // Look for tags with numeric references
          for (const tagA of tagsA) {
            for (const tagB of tagsB) {
              const [categoryA, valueA] = tagA.name.split(':');
              const [categoryB, valueB] = tagB.name.split(':');

              // If categories match, compare values
              if (categoryA === categoryB && valueA && valueB) {
                const tagRefsA = extractNumericReferences(valueA);
                const tagRefsB = extractNumericReferences(valueB);

                if (tagRefsA && tagRefsB) {
                  // Compare first parts
                  if (tagRefsA[0] !== tagRefsB[0]) {
                    return tagRefsA[0] - tagRefsB[0];
                  }

                  // Compare second parts if available
                  if (tagRefsA.length > 1 && tagRefsB.length > 1) {
                    return tagRefsA[1] - tagRefsB[1];
                  }
                }
              }
            }
          }

          // Fallback to sorting by name
          return a.name.localeCompare(b.name);
        });
      }

      // If custom sorting options are provided, use them
      return [...assetsToSort].sort((a, b) => {
        for (const { field, order } of sorting) {
          if (field === 'name') {
            // For name sorting, try to extract and compare numeric references first
            const refsA = extractNumericReferences(a.name);
            const refsB = extractNumericReferences(b.name);

            let comparison = 0;

            if (refsA && refsB) {
              // Compare first parts
              if (refsA[0] !== refsB[0]) {
                comparison = refsA[0] - refsB[0];
              } else if (refsA.length > 1 && refsB.length > 1) {
                // Compare second parts
                comparison = refsA[1] - refsB[1];
              } else {
                // Fallback to string comparison
                comparison = a.name.localeCompare(b.name);
              }
            } else {
              // Standard string comparison
              comparison = a.name.localeCompare(b.name);
            }

            return order === 'asc' ? comparison : -comparison;
          } else {
            const tagsA = assetTags[a.id] || [];
            const tagsB = assetTags[b.id] || [];
            const tagValueA =
              tagsA
                .find((tag) => tag.name.startsWith(`${field}:`))
                ?.name.split(':')[1] || '';
            const tagValueB =
              tagsB
                .find((tag) => tag.name.startsWith(`${field}:`))
                ?.name.split(':')[1] || '';

            // Extract numeric references from tag values
            const tagRefsA = extractNumericReferences(tagValueA);
            const tagRefsB = extractNumericReferences(tagValueB);

            let comparison = 0;

            if (tagRefsA && tagRefsB) {
              // Compare first parts
              if (tagRefsA[0] !== tagRefsB[0]) {
                comparison = tagRefsA[0] - tagRefsB[0];
              } else if (tagRefsA.length > 1 && tagRefsB.length > 1) {
                // Compare second parts
                comparison = tagRefsA[1] - tagRefsB[1];
              } else {
                // Fallback to string comparison
                comparison = tagValueA.localeCompare(tagValueB);
              }
            } else {
              // Standard string comparison
              comparison = tagValueA.localeCompare(tagValueB);
            }

            if (comparison !== 0)
              return order === 'asc' ? comparison : -comparison;
          }
        }
        return 0;
      });
    },
    [assetTags]
  );

  // Load tags when assets change
  useEffect(() => {
    const loadTags = async () => {
      const tagsMap: Record<string, Tag[]> = {};
      await Promise.all(
        assets.map(async (asset) => {
          tagsMap[asset.id] = await tagService.getTagsByAssetId(asset.id);
        })
      );
      setAssetToTags(tagsMap);
    };
    loadTags();
  }, [assets]);

  useEffect(() => {
    const updateFilteredAssets = async () => {
      const filtered = await applyFilters(assets, activeFilters, searchQuery);
      // Always apply sorting, even if activeSorting is empty (which will trigger default sorting)
      const sorted = applySorting(filtered, activeSorting);
      console.log(
        'Sorted assets: ',
        sorted.map((asset) => asset.name)
      );
      setFilteredAssets(sorted);
    };
    updateFilteredAssets();
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

  const handleApplyFilters = async (filters: Record<string, string[]>) => {
    setActiveFilters(filters);
    const filtered = await applyFilters(assets, filters, searchQuery);
    const sorted = applySorting(filtered, activeSorting);
    console.log(
      'Sorted assets 2: ',
      sorted.map((asset) => asset.name)
    );
    setFilteredAssets(sorted);
    setIsFilterModalVisible(false);
  };

  const handleApplySorting = async (sorting: SortingOption[]) => {
    setActiveSorting(sorting);
    const filtered = await applyFilters(assets, activeFilters, searchQuery);
    const sorted = applySorting(filtered, sorting);
    console.log(
      'Sorted assets 3: ',
      sorted.map((asset) => asset.name)
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
  }
});
