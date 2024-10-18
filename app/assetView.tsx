import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { colors, fontSizes, spacing, sharedStyles, borderRadius } from '@/styles/theme';
import { FlatList, GestureHandlerRootView } from 'react-native-gesture-handler';
import AudioPlayer from '@/components/AudioPlayer';
import ImageCarousel from '@/components/ImageCarousel';
import Carousel from '@/components/Carousel';
import { TranslationModal } from '@/components/TranslationModal';
import { CustomDropdown } from '@/components/CustomDropdown';
import { formatRelativeDate } from '@/utils/dateUtils';
import { NewTranslationModal } from '@/components/NewTranslationModal';

// Mock data for audio files and images
const audioFiles = [
  { id: '1', title: 'Audio 1', uri: require('@/sample_assets/audio1.mp3') },
  { id: '2', title: 'Audio 2', uri: require('@/sample_assets/audio2.mp3') },
];

const images = [
  { id: '1', uri: require('@/sample_assets/asset_1_poohbear.png') },
  { id: '2', uri: require('@/sample_assets/asset_2_hedgehog.png') },
];

const translations = [
  { id: '1', text: 'Translation 1', fullText: 'This is the full text for Translation 1...', audioUri: require('@/sample_assets/audio1.mp3'), voteRank: 5, dateSubmitted: '2024-04-01' },
  { id: '2', text: 'Translation 2', fullText: 'Here is the complete version of Translation 2...', audioUri: require('@/sample_assets/audio2.mp3'), voteRank: 3, dateSubmitted: '2023-04-05' },
  { id: '3', text: 'Translation 3', fullText: 'The extended content for Translation 3 goes here...', audioUri: require('@/sample_assets/audio1.mp3'), voteRank: 7, dateSubmitted: '2023-03-28' },
];

// Mock data for text snippets
const textSnippets = [
  { id: '1', content: 'This is the first sample text snippet for the asset. It provides a brief description or context about the asset being viewed.' },
  { id: '2', content: 'Here\'s a second text snippet. It might contain additional information or details about the asset.' },
  { id: '3', content: 'And this is a third snippet. You can add as many as needed to fully describe or explain the asset.' },
];

type TabType = 'text' | 'audio' | 'image';
type SortOption = 'voteRank' | 'dateSubmitted';

const ASSET_VIEWER_PROPORTION = 0.4;

const AssetView = () => {
  const { assetId, assetName } = useLocalSearchParams<{ assetId: string; assetName: string }>();
  const [activeTab, setActiveTab] = useState<TabType>('text');
  const [selectedTranslation, setSelectedTranslation] = useState<typeof translations[0] | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>('voteRank');
  const [sortedTranslations, setSortedTranslations] = useState(translations);
  const [isNewTranslationModalVisible, setIsNewTranslationModalVisible] = useState(false);

  const screenHeight = Dimensions.get('window').height;
  const assetViewerHeight = screenHeight * ASSET_VIEWER_PROPORTION;
  const translationsContainerHeight = screenHeight - assetViewerHeight - 100;

  const renderTextContent = (item: { id: string; content: string }) => (
    <View style={styles.textSnippetContainer}>
      <Text style={styles.textSnippet}>{item.content}</Text>
    </View>
  );

  const getPreviewText = (fullText: string, maxLength: number = 50) => {
    if (fullText.length <= maxLength) return fullText;
    return fullText.substring(0, maxLength).trim() + '...';
  };

  const renderTranslationCard = ({ item }: { item: typeof translations[0] }) => (
    <TouchableOpacity
      style={styles.translationCard}
      onPress={() => setSelectedTranslation(item)}
    >
      <View style={styles.translationCardContent}>
        <View style={styles.translationCardLeft}>
          <Text style={styles.translationPreview} numberOfLines={2}>
            {getPreviewText(item.fullText)}
          </Text>
        </View>
        <View style={styles.translationCardRight}>
          <View style={styles.voteContainer}>
            <Ionicons name="thumbs-up" size={16} color={colors.text} />
            <Text style={styles.voteCount}>{item.voteRank}</Text>
          </View>
        </View>
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.dateSubmitted}>{formatRelativeDate(item.dateSubmitted)}</Text>
        {item.audioUri && (
          <Ionicons name="volume-medium" size={20} color={colors.text} style={styles.audioIndicator} />
        )}
      </View>
    </TouchableOpacity>
  );

  const handleNewTranslation = (text: string, audioUri: string | null) => {
    // Here you would typically send this data to your backend
    console.log('New translation:', { text, audioUri });
    // For now, let's just add it to our local state
    const newTranslation = {
      id: (translations.length + 1).toString(),
      text: text.substring(0, 50), // Preview text
      fullText: text,
      audioUri: audioUri,
      voteRank: 0,
      dateSubmitted: new Date().toISOString(),
    };
    setSortedTranslations([newTranslation, ...sortedTranslations]);
  };

  useEffect(() => {
    const sorted = [...translations].sort((a, b) => {
      if (sortOption === 'voteRank') {
        return b.voteRank - a.voteRank;
      } else {
        return new Date(b.dateSubmitted).getTime() - new Date(a.dateSubmitted).getTime();
      }
    });
    setSortedTranslations(sorted);
  }, [sortOption]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={styles.container}
      >
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <View style={styles.content}>
            <Text style={styles.title}>{assetName}</Text>
            
            <View style={styles.tabBar}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'text' && styles.activeTab]}
                onPress={() => setActiveTab('text')}
              >
                <Ionicons name="text" size={24} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'audio' && styles.activeTab]}
                onPress={() => setActiveTab('audio')}
              >
                <Ionicons name="volume-high" size={24} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'image' && styles.activeTab]}
                onPress={() => setActiveTab('image')}
              >
                <Ionicons name="image" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={[styles.assetViewer, { height: assetViewerHeight }]}>
              {activeTab === 'text' && <Carousel items={textSnippets} renderItem={renderTextContent} />}
              {activeTab === 'audio' && <AudioPlayer audioFiles={audioFiles} useCarousel={true} />}
              {activeTab === 'image' && <ImageCarousel images={images} />}
            </View>

            <View style={styles.horizontalLine} />

            <View style={[styles.translationsContainer, { height: translationsContainerHeight }]}>
              <View style={styles.translationHeader}>
              <Text style={styles.sortByLabel}>Sort by:</Text>
                <View style={styles.alignmentContainer}>
                  <CustomDropdown
                    value={sortOption}
                    options={[
                      { label: 'Vote Rank', value: 'voteRank' },
                      { label: 'Date Submitted', value: 'dateSubmitted' },
                    ]}
                    onSelect={(value) => setSortOption(value as SortOption)}
                    fullWidth={false}
                    search={false}
                    containerStyle={styles.dropdownContainer}  // Add this line
                  />
                  <TouchableOpacity 
                    style={styles.newTranslationButton} 
                    onPress={() => setIsNewTranslationModalVisible(true)}
                  >
                    <Ionicons name="add-circle-outline" size={24} color={colors.buttonText} />
                    <Text style={styles.newTranslationButtonText}>New</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <FlatList
                data={sortedTranslations}
                renderItem={renderTranslationCard}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.translationsList} 
              />
              {selectedTranslation && (
                <TranslationModal
                  isVisible={!!selectedTranslation}
                  onClose={() => setSelectedTranslation(null)}
                  translation={selectedTranslation}
                />
              )}
              <NewTranslationModal
                isVisible={isNewTranslationModalVisible}
                onClose={() => setIsNewTranslationModalVisible(false)}
                onSubmit={handleNewTranslation}
              />
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingTop: spacing.medium, // Add padding to the top
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.medium,
  },
  backButton: {
    marginRight: spacing.medium,
  },
  title: {
    fontSize: fontSizes.large,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.small,
  },
  assetViewer: {
    flex: 1,
    // maxHeight: Dimensions.get('window').height * 0.4, // Adjust this value as needed
  },
  assetSnippetContainer: {
    padding: spacing.medium,
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.medium,
    marginHorizontal: spacing.medium,
    marginBottom: spacing.medium,
  },
  assetSnippet: {
    color: colors.text,
    fontSize: fontSizes.medium,
    textAlign: 'center',
    padding: spacing.medium,
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    borderBottomColor: colors.inputBorder,
    marginBottom: spacing.medium,
  },
  tab: {
    padding: spacing.medium,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tabContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textSnippetContainer: {
    padding: spacing.medium,
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.medium,
    marginHorizontal: spacing.medium,
    marginBottom: spacing.medium,
    width: '90%', // Adjust as needed
  },
  textSnippet: {
    color: colors.text,
    fontSize: fontSizes.medium,
    textAlign: 'center',
  },
  divider: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 20,
    backgroundColor: colors.inputBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  translationsContainer: {
    // flex: 1,
    // maxHeight: Dimensions.get('window').height * 0.4, // Adjust this value as needed
  },
  translationsList: {
    padding: spacing.medium,
  },
  translationText: {
    color: colors.text,
    fontSize: fontSizes.medium,
  },
  translationHeader: {
    paddingHorizontal: spacing.medium,
    marginBottom: spacing.medium,
  },
  sortByLabel: {
    color: colors.text,
    fontSize: fontSizes.small,
    marginBottom: spacing.small,
  },
  alignmentContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',  // Change this to 'center'
  },
  dropdownContainer: {
    flex: 1,
    marginRight: spacing.medium,
  },
  newTranslationButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.medium,
    height: 50,
    borderRadius: borderRadius.medium,
  },
  newTranslationButtonText: {
    color: colors.buttonText,
    fontSize: fontSizes.medium,
    fontWeight: 'bold',
    marginLeft: spacing.small,
  },
  horizontalLine: {
    height: 1,
    backgroundColor: colors.inputBorder,
    marginVertical: spacing.medium,
  },
  translationCard: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    marginBottom: spacing.medium,
    minHeight: 85,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'absolute',
    bottom: spacing.small,
    left: spacing.medium,
    right: spacing.medium,
  },
  dateSubmitted: {
    color: colors.textSecondary,
    fontSize: fontSizes.small,
  },
  translationCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.small, // Add space between content and date
  },
  translationCardLeft: {
    flex: 1,
    marginRight: spacing.small,
  },
  translationCardRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  translationPreview: {
    color: colors.text,
    fontSize: fontSizes.medium,
  },
  voteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.small,
  },
  voteCount: {
    color: colors.text,
    fontSize: fontSizes.small,
    marginLeft: spacing.small,
  },
  audioIndicator: {
    // marginTop: spacing.medium,
  },
});

export default AssetView;