import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, TextInput, StyleSheet, Modal, Alert, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSizes, spacing, sharedStyles, borderRadius } from '@/styles/theme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { QuestFilterModal } from '@/components/QuestFilterModal';
import { QuestDetails } from '@/components/QuestDetails';
import { questService, QuestWithRelations } from '@/database_components/questService';

interface SortingOption {
  field: string;
  order: 'asc' | 'desc';
}

const QuestCard: React.FC<{ quest: QuestWithRelations }> = ({ quest }) => {
  const difficulty = quest.tags.find(tag => tag.name.startsWith('Difficulty:'))?.name.split(':')[1];
  
  return (
    <View style={sharedStyles.card}>
      <Text style={sharedStyles.cardTitle}>{quest.name}</Text>
      {quest.description && (
        <Text style={sharedStyles.cardDescription}>{quest.description}</Text>
      )}
      {difficulty && (
        <View style={sharedStyles.cardInfo}>
          <Text style={sharedStyles.cardInfoText}>{difficulty}</Text>
        </View>
      )}
    </View>
  );
};


export default function Quests() {
  const router = useRouter();
  const { projectId, projectName } = useLocalSearchParams<{ projectId: string; projectName: string }>();
  const [searchQuery, setSearchQuery] = useState('');
  const [quests, setQuests] = useState<QuestWithRelations[]>([]);
  const [filteredQuests, setFilteredQuests] = useState<QuestWithRelations[]>([]);
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});
  const [activeSorting, setActiveSorting] = useState<SortingOption[]>([]);
  const [selectedQuest, setSelectedQuest] = useState<QuestWithRelations | null>(null);

  useEffect(() => {
    loadQuests();
  }, [projectId]);

  const loadQuests = async () => {
    try {
      if (!projectId) return;
      const loadedQuests = await questService.getQuestsByProjectId(projectId);
      setQuests(loadedQuests);
      setFilteredQuests(loadedQuests);
    } catch (error) {
      console.error('Error loading quests:', error);
      Alert.alert('Error', 'Failed to load quests');
    }
  };

  const applyFilters = useCallback((quests: QuestWithRelations[], filters: Record<string, string[]>, search: string) => {
    return quests.filter(quest => {
      const matchesSearch = quest.name.toLowerCase().includes(search.toLowerCase()) ||
                          (quest.description?.toLowerCase().includes(search.toLowerCase()) ?? false);
      
      const matchesFilters = Object.entries(filters).every(([category, selectedOptions]) => {
        if (selectedOptions.length === 0) return true;
        return quest.tags.some(tag => {
          const [tagCategory, tagValue] = tag.name.split(':');
          return tagCategory.toLowerCase() === category.toLowerCase() && 
                 selectedOptions.includes(`${category.toLowerCase()}:${tagValue.toLowerCase()}`);
        });
      });
  
      return matchesSearch && matchesFilters;
    });
  }, []);

  const applySorting = useCallback((quests: QuestWithRelations[], sorting: SortingOption[]) => {
    return [...quests].sort((a, b) => {
      for (const { field, order } of sorting) {
        if (field === 'name') {
          const comparison = a.name.localeCompare(b.name);
          return order === 'asc' ? comparison : -comparison;
        } else {
          const tagA = a.tags.find(tag => tag.name.startsWith(`${field}:`))?.name.split(':')[1] || '';
          const tagB = b.tags.find(tag => tag.name.startsWith(`${field}:`))?.name.split(':')[1] || '';
          const comparison = tagA.localeCompare(tagB);
          if (comparison !== 0) return order === 'asc' ? comparison : -comparison;
        }
      }
      return 0;
    });
  }, []);

  const getActiveOptionsCount = () => {
    const filterCount = Object.values(activeFilters).flat().length;
    const sortCount = activeSorting.length;
    return filterCount + sortCount;
  };

  const handleQuestPress = (quest: QuestWithRelations) => {
    setSelectedQuest(quest);
  };

  const handleCloseDetails = () => {
    setSelectedQuest(null);
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

  // Update filtered quests when search query changes
  useEffect(() => {
    const filtered = applyFilters(quests, activeFilters, searchQuery);
    const sorted = applySorting(filtered, activeSorting);
    setFilteredQuests(sorted);
  }, [searchQuery, quests, applyFilters, applySorting]);

  // Handle back button press
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isFilterModalVisible) {
        setIsFilterModalVisible(false);
        return true;
      }
      if (selectedQuest) {
        setSelectedQuest(null);
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [isFilterModalVisible, selectedQuest]);

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
          <Text style={sharedStyles.title}>{projectName} Quests</Text>
          
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={colors.text} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search quests..."
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
            data={filteredQuests}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => handleQuestPress(item)}>
                <QuestCard quest={item} />
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
          <QuestFilterModal
            visible={isFilterModalVisible}
            onClose={() => setIsFilterModalVisible(false)}
            quests={quests}
            onApplyFilters={handleApplyFilters}
            onApplySorting={handleApplySorting}
            initialFilters={activeFilters}
            initialSorting={activeSorting}
          />
        </View>
      </Modal>
      {selectedQuest && (
        <QuestDetails
          quest={selectedQuest}
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
});
