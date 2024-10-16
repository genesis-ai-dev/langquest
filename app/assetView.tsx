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
import Slider from '@react-native-community/slider';


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

type TabType = 'text' | 'audio' | 'image' | 'other';

const AssetView = () => {
  const { assetId, assetName } = useLocalSearchParams<{ assetId: string; assetName: string }>();
  const [activeTab, setActiveTab] = useState<TabType>('text');
  const [currentPage, setCurrentPage] = useState(0);
  const pagerRef = useRef<PagerView>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [currentAudioIndex, setCurrentAudioIndex] = useState(0);

  useEffect(() => {
    return sound
      ? () => {
          console.log('Unloading Sound');
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  useEffect(() => {
    if (currentPage !== currentAudioIndex) {
      stopSound();
      setCurrentAudioIndex(currentPage);
    }
  }, [currentPage]);

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const stopSound = async () => {
    if (sound) {
      await sound.stopAsync();
      await sound.setPositionAsync(0);
      setIsPlaying(false);
      setPosition(0);
    }
  };

  const playPauseSound = async (uri: any) => {
    if (sound) {
      if (isPlaying) {
        await sound.pauseAsync();
        setIsPlaying(false);
      } else {
        await sound.playAsync();
        setIsPlaying(true);
      }
    } else {
      await loadSound(uri);
    }
  };

  const loadSound = async (uri: any) => {
    console.log('Loading Sound', uri);
    try {
      const source = typeof uri === 'number' ? uri : { uri };
      const { sound: newSound } = await Audio.Sound.createAsync(
        source,
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );
      setSound(newSound);
      setIsPlaying(true);
    } catch (error) {
      console.error('Error loading sound:', error);
    }
  };

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setDuration(status.durationMillis || 0);
      setPosition(status.positionMillis || 0);
      setIsPlaying(status.isPlaying);
      if (status.didJustFinish) {
        setIsPlaying(false);
        setPosition(0);
      }
    }
  };

  const renderTextContent = () => (
    <View style={styles.tabContent}>
      <Text style={styles.assetSnippet}>
        This is a sample text snippet for the asset. It provides a brief description or context about the asset being viewed.
      </Text>
    </View>
  );

  const renderAudioPlayer = () => {
    if (!audioFiles || audioFiles.length === 0) {
      return <Text>No audio files available</Text>;
    }
    return (
      <View style={styles.carouselContainer}>
        <PagerView
          ref={pagerRef}
          style={styles.pagerView}
          initialPage={0}
          onPageSelected={(e) => setCurrentPage(e.nativeEvent.position)}
        >
          {audioFiles.map((item, index) => (
            <View key={index} style={styles.carouselItem}>
              <TouchableOpacity
                style={styles.audioPlayButton}
                onPress={() => playPauseSound(item.uri)}
              >
                <Ionicons
                  name={isPlaying && currentAudioIndex === index ? "pause" : "play"}
                  size={48}
                  color={colors.text}
                />
              </TouchableOpacity>
              <Text style={styles.audioFileName}>{item.title}</Text>
              <View style={styles.audioProgressContainer}>
                <Slider
                  style={styles.audioProgressBar}
                  minimumValue={0}
                  maximumValue={duration}
                  value={position}
                  onSlidingComplete={async (value) => {
                    if (sound) {
                      await sound.setPositionAsync(value);
                    }
                  }}
                  minimumTrackTintColor={colors.primary}
                  maximumTrackTintColor={colors.inputBorder}
                  thumbTintColor={colors.primary}
                />
                <View style={styles.audioTimeContainer}>
                  <Text style={styles.audioTimeText}>{formatTime(position)}</Text>
                  <Text style={styles.audioTimeText}>{formatTime(duration)}</Text>
                </View>
              </View>
            </View>
          ))}
        </PagerView>
        <View style={styles.paginationContainer}>
          {audioFiles.map((_, index) => (
            <View
              key={index}
              style={[
                styles.paginationDot,
                index === currentPage && styles.paginationDotActive,
              ]}
            />
          ))}
        </View>
        <TouchableOpacity
          style={[styles.navButton, styles.navButtonLeft]}
          onPress={() => pagerRef.current?.setPage(currentPage - 1)}
          disabled={currentPage === 0}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navButton, styles.navButtonRight]}
          onPress={() => pagerRef.current?.setPage(currentPage + 1)}
          disabled={currentPage === audioFiles.length - 1}
        >
          <Ionicons name="chevron-forward" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>
    );
  };

  const playSound = async (uri: any) => {
    console.log('Loading Sound', uri);
    try {
      if (sound) {
        await sound.unloadAsync();
      }
      
      let source;
      if (typeof uri === 'number') {
        // If uri is a number, it's likely a require() result
        source = uri;
      } else if (typeof uri === 'string') {
        // If uri is a string, create a source object
        source = { uri };
      } else {
        console.error('Invalid audio source:', uri);
        return;
      }
  
      const { sound: newSound } = await Audio.Sound.createAsync(source);
      setSound(newSound);
  
      console.log('Playing Sound');
      await newSound.playAsync();
      setIsPlaying(true);
  
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
        }
      });
    } catch (error) {
      console.error('Error loading or playing sound:', error);
      setIsPlaying(false);
    }
  };

  const renderImageCarousel = () => {
    if (!images || images.length === 0) {
      return <Text>No images available</Text>;
    }
    return (
      <View style={styles.carouselContainer}>
        <PagerView
          ref={pagerRef}
          style={styles.pagerView}
          initialPage={0}
          onPageSelected={(e) => setCurrentPage(e.nativeEvent.position)}
        >
          {images.map((item, index) => (
            <View key={index} style={styles.carouselItem}>
              <Image source={item.uri} style={styles.carouselImage} />
            </View>
          ))}
        </PagerView>
        <View style={styles.paginationContainer}>
          {images.map((_, index) => (
            <View
              key={index}
              style={[
                styles.paginationDot,
                index === currentPage && styles.paginationDotActive,
              ]}
            />
          ))}
        </View>
        <TouchableOpacity
          style={[styles.navButton, styles.navButtonLeft]}
          onPress={() => pagerRef.current?.setPage(currentPage - 1)}
          disabled={currentPage === 0}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navButton, styles.navButtonRight]}
          onPress={() => pagerRef.current?.setPage(currentPage + 1)}
          disabled={currentPage === images.length - 1}
        >
          <Ionicons name="chevron-forward" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>
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
              {activeTab === 'text' && renderTextContent()}
              {activeTab === 'audio' && renderAudioPlayer()}
              {activeTab === 'image' && renderImageCarousel()}
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
  audioPlayButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.inputBackground,
  },
  audioFileName: {
    color: colors.text,
    fontSize: fontSizes.small,
    marginTop: spacing.small,
    textAlign: 'center',
  },
  carouselContainer: {
    flex: 1,
    width: '100%',
    position: 'relative',
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
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.text,
    opacity: 0.4,
    marginHorizontal: 4,
  },
  paginationDotActive: {
    opacity: 1,
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -20 }],
    backgroundColor: colors.inputBackground,
    borderRadius: 20,
    padding: 8,
  },
  navButtonLeft: {
    left: 16,
  },
  navButtonRight: {
    right: 16,
  },
  audioProgressContainer: {
    width: '100%',
    paddingHorizontal: spacing.medium,
  },
  audioProgressBar: {
    width: '100%',
    height: 40,
  },
  audioTimeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  audioTimeText: {
    color: colors.text,
    fontSize: fontSizes.small,
  },
});

export default AssetView;