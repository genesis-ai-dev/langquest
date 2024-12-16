import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, TextInput, StyleSheet, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSizes, spacing, sharedStyles, borderRadius } from '@/styles/theme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AssetFilterModal } from '@/components/AssetFilterModal';
import { assetService, AssetWithRelations } from '@/database_services/assetService';
import { useProjectContext } from '@/contexts/ProjectContext';

interface SortingOption {
  field: string;
  order: 'asc' | 'desc';
}

const AssetCard: React.FC<{ asset: AssetWithRelations }> = ({ asset }) => {
  return (
    <View style={sharedStyles.card}>
      <Text style={sharedStyles.cardTitle}>{asset.name}</Text>
      {asset.text && (
        <Text style={sharedStyles.cardDescription}>{asset.text}</Text>
      )}
      <View style={sharedStyles.cardInfo}>
        <Text style={sharedStyles.cardInfoText}>
          {asset.source_language.native_name || asset.source_language.english_name}
        </Text>
        {asset.tags.map((tag) => (
          <Text key={tag.id} style={[sharedStyles.cardInfoText, styles.tag]}>
            {tag.name}
          </Text>
        ))}
      </View>
    </View>
  );
};
export default function Assets() {
  const router = useRouter();
  const { setActiveAsset } = useProjectContext();
  const { quest_id, questName } = useLocalSearchParams<{ quest_id: string; questName: string }>();
  const [searchQuery, setSearchQuery] = useState('');
  const [assets, setAssets] = useState<AssetWithRelations[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<AssetWithRelations[]>([]);
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});
  const [activeSorting, setActiveSorting] = useState<SortingOption[]>([]);

  useEffect(() => {
    loadAssets();
  }, [quest_id]);

  const loadAssets = async () => {
    try {
      if (!quest_id) return;
      const loadedAssets = await assetService.getAssetsByQuest_id(quest_id);
      setAssets(loadedAssets);
      setFilteredAssets(loadedAssets);
    } catch (error) {
      console.error('Error loading assets:', error);
      Alert.alert('Error', 'Failed to load assets');
    }
  };

  const applyFilters = useCallback((assets: AssetWithRelations[], filters: Record<string, string[]>, search: string) => {
    return assets.filter(asset => {
      const matchesSearch = asset.name.toLowerCase().includes(search.toLowerCase()) ||
                          asset.text.toLowerCase().includes(search.toLowerCase());
      
      const matchesFilters = Object.entries(filters).every(([category, selectedOptions]) => {
        if (selectedOptions.length === 0) return true;
        return asset.tags.some(tag => {
          const [tagCategory, tagValue] = tag.name.split(':');
          return tagCategory.toLowerCase() === category.toLowerCase() && 
                 selectedOptions.includes(`${category.toLowerCase()}:${tagValue.toLowerCase()}`);
        });
      });
  
      return matchesSearch && matchesFilters;
    });
  }, []);

  const applySorting = useCallback((assets: AssetWithRelations[], sorting: SortingOption[]) => {
    return [...assets].sort((a, b) => {
      for (const { field, order } of sorting) {
        let valueA: string, valueB: string;

        switch (field) {
          case 'name':
            valueA = a.name.toLowerCase();
            valueB = b.name.toLowerCase();
            break;
          case 'language':
            valueA = (a.source_language.native_name || a.source_language.english_name)!.toLowerCase();
            valueB = (b.source_language.native_name || b.source_language.english_name)!.toLowerCase();
            break;
          default:
            const tagA = a.tags.find(tag => tag.name.startsWith(`${field}:`));
            const tagB = b.tags.find(tag => tag.name.startsWith(`${field}:`));
            valueA = tagA ? tagA.name.split(':')[1].toLowerCase() : '';
            valueB = tagB ? tagB.name.split(':')[1].toLowerCase() : '';
        }

        if (valueA < valueB) return order === 'asc' ? -1 : 1;
        if (valueA > valueB) return order === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, []);

  const getActiveOptionsCount = () => {
    const filterCount = Object.values(activeFilters).flat().length;
    const sortCount = activeSorting.length;
    return filterCount + sortCount;
  };

  useEffect(() => {
    let filtered = applyFilters(assets, activeFilters, searchQuery);
    filtered = applySorting(filtered, activeSorting);
    setFilteredAssets(filtered);
  }, [searchQuery, activeFilters, activeSorting, assets, applyFilters, applySorting]);

  const handleApplyFilters = (filters: Record<string, string[]>) => {
    setActiveFilters(filters);
  };

  const handleApplySorting = (sorting: SortingOption[]) => {
    setActiveSorting(sorting);
  };

  const handleAssetPress = (asset: AssetWithRelations) => {
    setActiveAsset(asset);
    router.push({
      pathname: "/assetView",
      params: { 
        asset_id: asset.id,
        assetName: asset.name
      }
    });
  };

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <View style={[sharedStyles.container, { backgroundColor: 'transparent' }]}>
          <TouchableOpacity onPress={() => router.back()} style={sharedStyles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={colors.text} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search assets..."
              placeholderTextColor={colors.text}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <TouchableOpacity onPress={() => setIsFilterModalVisible(true)} style={styles.filterIcon}>
              <Ionicons name="filter" size={20} color={colors.text} />
              {getActiveOptionsCount() > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{getActiveOptionsCount()}</Text>
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
            keyExtractor={item => item.id}
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