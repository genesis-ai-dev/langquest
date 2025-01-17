import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, TextInput, StyleSheet, Modal, Alert, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  colors,
  fontSizes,
  spacing,
  sharedStyles,
  borderRadius,
} from '@/styles/theme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AssetFilterModal } from '@/components/AssetFilterModal';
import { assetService, Asset } from '@/database_services/assetService';
import { tagService, Tag } from '@/database_services/tagService';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useTranslation } from '@/hooks/useTranslation';

interface SortingOption {
  field: string;
  order: 'asc' | 'desc';
}

const AssetCard: React.FC<{ asset: Asset }> = ({ asset }) => {
  const [tags, setTags] = useState<Tag[]>([]);

  useEffect(() => {
    const loadTags = async () => {
      const assetTags = await tagService.getTagsByAssetId(asset.id);
      setTags(assetTags);
    };
    loadTags();
  }, [asset.id]);
  
  return (
    <View style={sharedStyles.card}>
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

  const { t } = useTranslation();
  const router = useRouter();
  const { setActiveAsset, goToAsset } = useProjectContext();
  const { questId, questName } = useLocalSearchParams<{
    questId: string;
    questName: string;
  }>();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>(
    {},
  );
  const [activeSorting, setActiveSorting] = useState<SortingOption[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  useEffect(() => {
    loadAssets();
  }, [quest_id]);

  const loadAssets = async () => {
    try {
      if (!quest_id) return;
      const loadedAssets = await assetService.getAssetsByQuestId(quest_id);
      setAssets(loadedAssets);

      // Load tags for all assets
      const tagsMap: Record<string, Tag[]> = {};
      await Promise.all(
        loadedAssets.map(async (asset) => {
          tagsMap[asset.id] = await tagService.getTagsByAssetId(asset.id);
        })
      );
      console.log('Tags found for asset: ', tagsMap);
      setAssetTags(tagsMap);
    } catch (error) {
      console.error('Error loading assets:', error);
      Alert.alert('Error', 'Failed to load assets');
    }
  };

  const applyFilters = useCallback((assetsToFilter: Asset[], filters: Record<string, string[]>, search: string) => {
    return assetsToFilter.filter(asset => {
      // Search filter
      const matchesSearch = asset.name.toLowerCase().includes(search.toLowerCase()) ||
                          (asset.text?.toLowerCase().includes(search.toLowerCase()) ?? false);
      
      // Tag filters
      const assetTags = assetToTags[asset.id] || [];
      const matchesFilters = Object.entries(filters).every(([category, selectedOptions]) => {
        if (selectedOptions.length === 0) return true;
        return assetTags.some(tag => {
          const [tagCategory, tagValue] = tag.name.split(':');
          return tagCategory.toLowerCase() === category.toLowerCase() && 
                 selectedOptions.includes(`${category.toLowerCase()}:${tagValue.toLowerCase()}`);
        });
      });
  
      return matchesSearch && matchesFilters;
    });
  }, [assetToTags]);

  const applySorting = useCallback((assetsToSort: Asset[], sorting: SortingOption[]) => {
    return [...assetsToSort].sort((a, b) => {
      for (const { field, order } of sorting) {
        if (field === 'name') {
          const comparison = a.name.localeCompare(b.name);
          return order === 'asc' ? comparison : -comparison;
        } else {
          const tagsA = assetTags[a.id] || [];
          const tagsB = assetTags[b.id] || [];
          const tagA = tagsA.find(tag => tag.name.startsWith(`${field}:`))?.name.split(':')[1] || '';
          const tagB = tagsB.find(tag => tag.name.startsWith(`${field}:`))?.name.split(':')[1] || '';
          const comparison = tagA.localeCompare(tagB);
          if (comparison !== 0) return order === 'asc' ? comparison : -comparison;
        }
      }
      return 0;
    });
  }, [assetTags]);

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
    let filtered = applyFilters(assets, activeFilters, searchQuery);
    filtered = applySorting(filtered, activeSorting);
    setFilteredAssets(filtered);
  }, [
    searchQuery,
    activeFilters,
    activeSorting,
    assets,
    applyFilters,
    applySorting,
  ]);

  const getActiveOptionsCount = () => {
    const filterCount = Object.values(activeFilters).flat().length;
    const sortCount = activeSorting.length;
    return filterCount + sortCount;
  };

  const handleAssetPress = (asset: Asset) => {
    setActiveAsset(asset);
    goToAsset(asset);
  };

  const handleCloseDetails = () => {
    setSelectedAsset(null);
  };

  const handleApplyFilters = (filters: Record<string, string[]>) => {
    setActiveFilters(filters);
    const filtered = applyFilters(assets, filters, searchQuery);
    const sorted = applySorting(filtered, activeSorting);
    setFilteredAssets(sorted);
    setIsFilterModalVisible(false);
  };

  const handleApplySorting = (sorting: SortingOption[]) => {
    setActiveSorting(sorting);
    const filtered = applyFilters(assets, activeFilters, searchQuery);
    const sorted = applySorting(filtered, sorting);
    setFilteredAssets(sorted);
  };

  // Update filtered assets when search query changes
  useEffect(() => {
    const filtered = applyFilters(assets, activeFilters, searchQuery);
    const sorted = applySorting(filtered, activeSorting);
    setFilteredAssets(sorted);
  }, [searchQuery, assets, applyFilters, applySorting]);

  // Handle back button press
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isFilterModalVisible) {
        setIsFilterModalVisible(false);
        return true;
      }
      if (selectedAsset) {
        setSelectedAsset(null);
        return true;
      }
      return false;
    });

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
    marginBottom: spacing.medium,
  },
  searchIcon: {
    marginRight: spacing.small,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: fontSizes.medium,
    paddingVertical: spacing.medium,
  },
  filterIcon: {
    marginLeft: spacing.small,
    padding: spacing.small,
    position: 'relative',
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
    alignItems: 'center',
  },
  badgeText: {
    color: colors.buttonText,
    fontSize: fontSizes.small,
    fontWeight: 'bold',
  },
  tag: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.small,
    paddingHorizontal: spacing.small,
    marginRight: spacing.small,
  },
});
