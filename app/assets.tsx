import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, TextInput, StyleSheet, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSizes, spacing, sharedStyles, borderRadius } from '@/styles/theme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Asset } from '@/types/asset';
import { AssetFilterModal } from '@/components/AssetFilterModal';

interface SortingOption {
  field: string;
  order: 'asc' | 'desc';
}

const mockAssets: Asset[] = [
  { id: '1', title: 'Asset 1', description: 'Description for Asset 1', tags: ['Type:Image', 'Category:Background', 'Style:Modern'], fileType: 'PNG' },
  { id: '2', title: 'Asset 2', description: 'Description for Asset 2', tags: ['Type:Audio', 'Category:SoundEffect', 'Style:Retro'], fileType: 'MP3' },
  { id: '3', title: 'Asset 3', description: 'Description for Asset 3', tags: ['Type:Model', 'Category:Character', 'Style:Fantasy'], fileType: 'FBX' },
  { id: '4', title: 'Asset 4', description: 'Description for Asset 4', tags: ['Type:Texture', 'Category:Environment', 'Style:Realistic'], fileType: 'JPG' },
  { id: '5', title: 'Asset 5', description: 'Description for Asset 5', tags: ['Type:Script', 'Category:AI', 'Style:Procedural'], fileType: 'JS' },
];

const AssetCard: React.FC<{ asset: Asset; onPress: () => void }> = ({ asset, onPress }) => (
    <TouchableOpacity onPress={onPress}>
      <View style={sharedStyles.card}>
        <Text style={sharedStyles.cardTitle}>{asset.title}</Text>
        <Text style={sharedStyles.cardDescription}>{asset.description}</Text>
        <View style={sharedStyles.cardInfo}>
          <Text style={sharedStyles.cardInfoText}>{asset.fileType}</Text>
          {asset.tags.map((tag, index) => (
            <Text key={index} style={[sharedStyles.cardInfoText, styles.tag]}>{tag}</Text>
          ))}
        </View>
      </View>
    </TouchableOpacity>
  );

export default function Assets() {
  const router = useRouter();
  const { questId, questName } = useLocalSearchParams<{ questId: string; questName: string }>();
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredAssets, setFilteredAssets] = useState(mockAssets);
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});
  const [activeSorting, setActiveSorting] = useState<SortingOption[]>([]);

  const applyFilters = useCallback((assets: Asset[], filters: Record<string, string[]>, search: string) => {
    return assets.filter(asset => {
      const matchesSearch = asset.title.toLowerCase().includes(search.toLowerCase()) ||
                            asset.description.toLowerCase().includes(search.toLowerCase());
      
      const matchesFilters = Object.entries(filters).every(([category, selectedOptions]) => {
        if (selectedOptions.length === 0) return true;
        return asset.tags.some(tag => {
          const [tagCategory, tagValue] = tag.split(':');
          return tagCategory.toLowerCase() === category.toLowerCase() && 
                 selectedOptions.includes(`${category.toLowerCase()}:${tagValue.toLowerCase()}`);
        });
      });
  
      return matchesSearch && matchesFilters;
    });
  }, []);

  const applySorting = useCallback((assets: Asset[], sorting: SortingOption[]) => {
    return [...assets].sort((a, b) => {
      for (const { field, order } of sorting) {
        let valueA: string, valueB: string;

        if (field === 'title' || field === 'fileType') {
          valueA = a[field].toLowerCase();
          valueB = b[field].toLowerCase();
        } else {
          const tagA = a.tags.find(tag => tag.startsWith(`${field}:`));
          const tagB = b.tags.find(tag => tag.startsWith(`${field}:`));
          valueA = tagA ? tagA.split(':')[1].toLowerCase() : '';
          valueB = tagB ? tagB.split(':')[1].toLowerCase() : '';
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
    let filtered = applyFilters(mockAssets, activeFilters, searchQuery);
    filtered = applySorting(filtered, activeSorting);
    setFilteredAssets(filtered);
  }, [searchQuery, activeFilters, activeSorting, applyFilters, applySorting]);

  const handleApplyFilters = (filters: Record<string, string[]>) => {
    setActiveFilters(filters);
  };

  const handleApplySorting = (sorting: SortingOption[]) => {
    setActiveSorting(sorting);
  };

  const handleAssetPress = (asset: Asset) => {
    router.push({
      pathname: "/assetView",
      params: { assetId: asset.id, assetName: asset.title }
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
          <Text style={sharedStyles.title}>{questName} Assets</Text>
          
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
                <AssetCard 
                asset={item} 
                onPress={() => handleAssetPress(item)}
                />
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
            assets={mockAssets}
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