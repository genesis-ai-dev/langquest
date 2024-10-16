import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { colors, fontSizes, spacing, sharedStyles, borderRadius } from '@/styles/theme';
import { Audio, AVPlaybackStatus } from 'expo-av';
import PagerView from 'react-native-pager-view';
import { FlatList, GestureHandlerRootView } from 'react-native-gesture-handler';
import AudioPlayer from '@/components/AudioPlayer';
import ImageCarousel from '@/components/ImageCarousel';
import Carousel from '@/components/Carousel';


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
  { id: '1', text: 'Translation 1' },
  { id: '2', text: 'Translation 2' },
  { id: '3', text: 'Translation 3' },
];

// Mock data for text snippets
const textSnippets = [
  { id: '1', content: 'This is the first sample text snippet for the asset. It provides a brief description or context about the asset being viewed.' },
  { id: '2', content: 'Here\'s a second text snippet. It might contain additional information or details about the asset.' },
  { id: '3', content: 'And this is a third snippet. You can add as many as needed to fully describe or explain the asset.' },
];

type TabType = 'text' | 'audio' | 'image' | 'other';

const AssetView = () => {
  const { assetId, assetName } = useLocalSearchParams<{ assetId: string; assetName: string }>();
  const [activeTab, setActiveTab] = useState<TabType>('text');

  const renderTextContent = (item: { id: string; content: string }) => (
    <View style={styles.textSnippetContainer}>
      <Text style={styles.textSnippet}>{item.content}</Text>
    </View>
  );

  const renderTranslationCard = ({ item }: { item: { id: string; text: string } }) => (
    <View style={styles.translationCard}>
      <Text style={styles.translationText}>{item.text}</Text>
    </View>
  );

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
                <Ionicons name="musical-note" size={24} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'image' && styles.activeTab]}
                onPress={() => setActiveTab('image')}
              >
                <Ionicons name="image" size={24} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'other' && styles.activeTab]}
                onPress={() => setActiveTab('other')}
              >
                <Ionicons name="ellipsis-horizontal" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.assetViewer}>
              {activeTab === 'text' && <Carousel items={textSnippets} renderItem={renderTextContent} />}
              {activeTab === 'audio' && <AudioPlayer audioFiles={audioFiles} />}
              {activeTab === 'image' && <ImageCarousel images={images} />}
              {activeTab === 'other' && <Text>Other Content Placeholder</Text>}
            </View>

            <View style={styles.horizontalLine} />

            <View style={styles.translationsContainer}>
              <FlatList
                data={translations}
                renderItem={renderTranslationCard}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.translationsList}
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
    maxHeight: Dimensions.get('window').height * 0.4, // Adjust this value as needed
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
    flex: 1,
    maxHeight: Dimensions.get('window').height * 0.4, // Adjust this value as needed
  },
  translationsList: {
    padding: spacing.medium,
  },
  translationCard: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    marginBottom: spacing.medium,
  },
  translationText: {
    color: colors.text,
    fontSize: fontSizes.medium,
  },
  horizontalLine: {
    height: 1,
    backgroundColor: colors.inputBorder,
    marginVertical: spacing.medium,
  },
});

export default AssetView;