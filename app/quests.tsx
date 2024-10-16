import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, TextInput, StyleSheet, Modal, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSizes, spacing, sharedStyles, borderRadius } from '@/styles/theme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { QuestFilterModal } from '@/components/QuestFilterModal';
import { Quest } from '@/types/quest';
import { QuestDetails } from '@/components/QuestDetails';

interface SortingOption {
  field: string;
  order: 'asc' | 'desc';
}

const mockQuests: Quest[] = [
  { id: '1', title: '1st chapter of Romans', description: '', tags: ['Book:Romans', 'Chapter:1', 'Author:Paul'], difficulty: 'Easy', status: 'Not Started' },
  { id: '2', title: '2nd chapter of Romans', description: '', tags: ['Book:Romans', 'Chapter:2', 'Author:Paul'], difficulty: 'Medium', status: 'In Progress' },
  { id: '3', title: '3rd chapter of Romans', description: '', tags: ['Book:Romans', 'Chapter:3', 'Author:Paul'], difficulty: 'Hard', status: 'Completed' },
  { id: '4', title: '4th chapter of Romans', description: '', tags: ['Book:Romans', 'Chapter:4', 'Author:Paul'], difficulty: 'Medium', status: 'Not Started' },
  { id: '5', title: '5th chapter of Romans', description: '', tags: ['Book:Romans', 'Chapter:5', 'Author:Paul'], difficulty: 'Easy', status: 'In Progress' },
];

const QuestCard: React.FC<{ quest: Quest }> = ({ quest }) => (
  <View style={sharedStyles.card}>
    <Text style={sharedStyles.cardTitle}>{quest.title}</Text>
    <Text style={sharedStyles.cardDescription}>{quest.description}</Text>
    <View style={sharedStyles.cardInfo}>
      <Text style={[sharedStyles.cardInfoText, { color: getDifficultyColor(quest.difficulty) }]}>{quest.difficulty}</Text>
      <Text style={[sharedStyles.cardInfoText, { color: getStatusColor(quest.status) }]}>{quest.status}</Text>
    </View>
  </View>
);

const getDifficultyColor = (difficulty: Quest['difficulty']) => {
  switch (difficulty) {
    case 'Easy': return colors.text;
    case 'Medium': return colors.text;
    case 'Hard': return colors.text;
    default: return colors.text;
  }
};

const getStatusColor = (status: Quest['status']) => {
  switch (status) {
    case 'Not Started': return colors.text;
    case 'In Progress': return colors.text;
    case 'Completed': return colors.text;
    default: return colors.text;
  }
};

export default function Quests() {
  const router = useRouter();
  const { projectId, projectName } = useLocalSearchParams<{ projectId: string; projectName: string }>();
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredQuests, setFilteredQuests] = useState(mockQuests);
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});
  const [activeSorting, setActiveSorting] = useState<SortingOption[]>([]);
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);

  const applyFilters = useCallback((quests: Quest[], filters: Record<string, string[]>, search: string) => {
    return quests.filter(quest => {
      const matchesSearch = quest.title.toLowerCase().includes(search.toLowerCase()) ||
                            quest.description.toLowerCase().includes(search.toLowerCase());
      
      const matchesFilters = Object.entries(filters).every(([category, selectedOptions]) => {
        if (selectedOptions.length === 0) return true;
        return quest.tags.some(tag => {
          const [tagCategory, tagValue] = tag.split(':');
          return tagCategory.toLowerCase() === category.toLowerCase() && 
                 selectedOptions.includes(`${category.toLowerCase()}:${tagValue.toLowerCase()}`);
        });
      });
  
      return matchesSearch && matchesFilters;
    });
  }, []);

  const applySorting = useCallback((quests: Quest[], sorting: SortingOption[]) => {
    return [...quests].sort((a, b) => {
      for (const { field, order } of sorting) {
        let valueA: string, valueB: string;

        if (field === 'title' || field === 'difficulty' || field === 'status') {
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

  const handleQuestPress = (quest: Quest) => {
    setSelectedQuest(quest);
  };

  const handleCloseDetails = () => {
    setSelectedQuest(null);
  };

  const handleStartQuest = () => {
    // Implement the logic to start the quest
    console.log('Starting quest:', selectedQuest?.title);
    setSelectedQuest(null);
  };

  useEffect(() => {
    const lowercasedQuery = searchQuery.toLowerCase();
    const filtered = mockQuests.filter(quest =>
      quest.title.toLowerCase().includes(lowercasedQuery) ||
      quest.description.toLowerCase().includes(lowercasedQuery)
    );
    setFilteredQuests(filtered);
  }, [searchQuery]);

  useEffect(() => {
    let filtered = applyFilters(mockQuests, activeFilters, searchQuery);
    filtered = applySorting(filtered, activeSorting);
    setFilteredQuests(filtered);
  }, [searchQuery, activeFilters, activeSorting, applyFilters, applySorting]);

  const handleApplyFilters = (filters: Record<string, string[]>) => {
    setActiveFilters(filters);
  };

  const handleApplySorting = (sorting: SortingOption[]) => {
    setActiveSorting(sorting);
  };

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isFilterModalVisible) {
        setIsFilterModalVisible(false);
        return true; // Prevent default behavior
      }
      return false; // Let default behavior happen (exit the screen)
    });

    return () => backHandler.remove();
  }, [isFilterModalVisible]);

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
          quests={mockQuests}
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
        onStart={handleStartQuest}
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
