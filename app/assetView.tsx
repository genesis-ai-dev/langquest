import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, PanResponder, Animated, Dimensions, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors, fontSizes, spacing, sharedStyles, borderRadius } from '@/styles/theme';
import { Audio } from 'expo-av';
import PagerView from 'react-native-pager-view';
import { FlatList, GestureHandlerRootView } from 'react-native-gesture-handler';


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

type TabType = 'audio' | 'image' | 'other';

const AssetView = () => {
  const router = useRouter();
  const { assetId, assetName } = useLocalSearchParams<{ assetId: string; assetName: string }>();
  const [activeTab, setActiveTab] = useState<TabType>('audio');
  const [dividerPosition, setDividerPosition] = useState(Dimensions.get('window').height / 2);
  const pan = useRef(new Animated.ValueXY()).current;

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (_, gestureState) => {
      const newPosition = dividerPosition + gestureState.dy;
      if (newPosition > 100 && newPosition < Dimensions.get('window').height - 100) {
        setDividerPosition(newPosition);
      }
    },
  });

  const renderAudioPlayer = () => (
    <View style={styles.tabContent}>
      <Text>Audio Player Placeholder</Text>
    </View>
  );

  const renderImageCarousel = () => {
    if (!images || images.length === 0) {
      return <Text>No images available</Text>;
    }
    return (
      <PagerView style={styles.pagerView} initialPage={0}>
        {images.map((item, index) => (
          <View key={index} style={styles.carouselItem}>
            <Image source={item.uri} style={styles.carouselImage} />
          </View>
        ))}
      </PagerView>
    );
  };

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
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{assetName}</Text>
        </View>

        <View style={[styles.assetViewer, { height: dividerPosition }]}>
          <View style={styles.tabBar}>
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
          <View style={styles.tabContent}>
            {activeTab === 'audio' && renderAudioPlayer()}
            {activeTab === 'image' && renderImageCarousel()}
            {activeTab === 'other' && <Text>Other Content Placeholder</Text>}
          </View>
        </View>

        <Animated.View
          style={[styles.divider, { top: dividerPosition }]}
          {...panResponder.panHandlers}
        />

        <View style={[styles.translationsContainer, { top: dividerPosition }]}>
          <FlatList
            data={translations}
            renderItem={renderTranslationCard}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.translationsList}
          />
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
  },
  assetViewer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    borderBottomColor: colors.inputBorder,
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
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
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
  pagerView: {
    flex: 1,
    width: '100%',
  },
  carouselItem: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  carouselImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
});

export default AssetView;