import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSizes, spacing, sharedStyles, borderRadius } from '@/styles/theme';
import { useLocalSearchParams, useRouter } from 'expo-router';

interface Quest {
  id: string;
  title: string;
  description: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  status: 'Not Started' | 'In Progress' | 'Completed';
}

const mockQuests: Quest[] = [
  { id: '1', title: 'Translate Chapter 1', description: 'Translate the first chapter of the book', difficulty: 'Easy', status: 'Not Started' },
  { id: '2', title: 'Review Translations', description: 'Review and edit recent translations', difficulty: 'Medium', status: 'In Progress' },
  { id: '3', title: 'Localize UI Elements', description: 'Translate and adapt UI elements for the target language', difficulty: 'Hard', status: 'Completed' },
  { id: '4', title: 'Create Glossary', description: 'Compile a glossary of project-specific terms', difficulty: 'Medium', status: 'Not Started' },
  { id: '5', title: 'Proofread Documentation', description: 'Proofread and finalize translated documentation', difficulty: 'Easy', status: 'In Progress' },
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

  useEffect(() => {
    const lowercasedQuery = searchQuery.toLowerCase();
    const filtered = mockQuests.filter(quest =>
      quest.title.toLowerCase().includes(lowercasedQuery) ||
      quest.description.toLowerCase().includes(lowercasedQuery)
    );
    setFilteredQuests(filtered);
  }, [searchQuery]);

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
          
          <View style={sharedStyles.searchContainer}>
            <Ionicons name="search" size={20} color={colors.text} style={sharedStyles.searchIcon} />
            <TextInput
              style={sharedStyles.searchInput}
              placeholder="Search quests..."
              placeholderTextColor={colors.text}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          
          <FlatList
            data={filteredQuests}
            renderItem={({ item }) => <QuestCard quest={item} />}
            keyExtractor={item => item.id}
            style={sharedStyles.list}
          />
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

