import { AssetFilterModal } from '@/components/AssetFilterModal';
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

interface SortingOption {
  field: string;
  order: 'asc' | 'desc';
}

const AssetCard: FC<{ asset: Asset }> = ({ asset }) => {
  const { currentUser } = useAuth();
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [tags, setTags] = useState<Tag[]>([]);

  useEffect(() => {
    const loadData = async () => {
      const assetTags = await tagService.getTagsByAssetId(asset.id);
      setTags(assetTags);

      if (currentUser) {
        console.log('Checking asset download status:', {
          assetId: asset.id,
          profileId: currentUser.id
        });
        const status = await downloadService.getAssetDownloadStatus(
          currentUser.id,
          asset.id
        );
        console.log('Asset download status result:', {
          assetId: asset.id,
          status
        });
        setIsDownloaded(status);
      }
    };
    loadData();
  }, [asset.id, currentUser]);

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

  return (
    <View style={sharedStyles.card}>
      <DownloadIndicator
        isDownloaded={isDownloaded}
        onPress={handleDownloadToggle}
      />
      <Text style={sharedStyles.cardTitle}>{asset.name}</Text>
      {/* {asset.description && (
        <Text style={sharedStyles.cardDescription}>{quest.description}</Text>
      )} */}
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
  const router = useRouter();
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

  useEffect(() => {
    loadAssets();
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
    } catch (error) {
      console.error('Error loading assets:', error);
      Alert.alert('Error', 'Failed to load assets');
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
      return [...assetsToSort].sort((a, b) => {
        for (const { field, order } of sorting) {
          if (field === 'name') {
            const comparison = a.name.localeCompare(b.name);
            return order === 'asc' ? comparison : -comparison;
          } else {
            const tagsA = assetTags[a.id] || [];
            const tagsB = assetTags[b.id] || [];
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
      const sorted = applySorting(filtered, activeSorting);
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
  };

  const handleApplyFilters = async (filters: Record<string, string[]>) => {
    setActiveFilters(filters);
    const filtered = await applyFilters(assets, filters, searchQuery);
    const sorted = applySorting(filtered, activeSorting);
    setFilteredAssets(sorted);
    setIsFilterModalVisible(false);
  };

  const handleApplySorting = async (sorting: SortingOption[]) => {
    setActiveSorting(sorting);
    const filtered = await applyFilters(assets, activeFilters, searchQuery);
    const sorted = applySorting(filtered, sorting);
    setFilteredAssets(sorted);
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
          <TouchableOpacity
            onPress={() => router.back()}
            style={sharedStyles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
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
  tag: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.small,
    paddingHorizontal: spacing.small,
    marginRight: spacing.small
  }
});
