import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio, AVPlaybackStatus } from 'expo-av';
import Slider from '@react-native-community/slider';
import { colors, fontSizes, spacing } from '@/styles/theme';
import Carousel from './Carousel';

interface AudioFile {
  id: string;
  title: string;
  moduleId: number | string;
}

interface AudioPlayerProps {
  audioFiles?: AudioFile[];
  audioUri?: string;
  useCarousel?: boolean;
  mini?: boolean;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ 
  audioFiles = [], 
  audioUri,
  useCarousel = true, 
  mini = false 
}) => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [activeModuleId, setActiveModuleId] = useState<number | null>(null);

  const cleanupSound = async () => {
    if (sound) {
      await sound.unloadAsync();
      setSound(null);
    }
    setIsPlaying(false);
    setPosition(0);
    setDuration(0);
    setActiveModuleId(null);
  };

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  useEffect(() => {
    const setupSound = async () => {
      await cleanupSound();
      if (audioUri) {
        setActiveModuleId(null); // Reset active module
        setPosition(0);          // Reset position
      }
    };
    setupSound();
  }, [audioUri]);

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const playPauseSound = async (moduleId: number | string) => {
    if (moduleId !== activeModuleId) {
      await cleanupSound();
      await loadSound(moduleId);
      setActiveModuleId(moduleId as number);
    } else {
      if (sound) {
        if (isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
        } else {
          try {
            const status = await sound.getStatusAsync();
            if (status.isLoaded) {
              // If at the end, reset position
              if (status.positionMillis >= status.durationMillis!) {
                await sound.setPositionAsync(0);
                setPosition(0);
              }
              await sound.playAsync();
              setIsPlaying(true);
            }
          } catch (error) {
            console.error('Error playing sound:', error);
          }
        }
      }
    }
  };

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setDuration(status.durationMillis || 0);
      setPosition(status.positionMillis || 0);
      
      if (status.didJustFinish) {
        setIsPlaying(false);
        // Don't reset position here - let playPauseSound handle it
      } else {
        setIsPlaying(status.isPlaying);
      }
    }
  };

  const loadSound = async (moduleIdOrUri: number | string) => {
    try {
      const source = typeof moduleIdOrUri === 'string' 
        ? { uri: moduleIdOrUri }
        : moduleIdOrUri;
      
      const { sound: newSound } = await Audio.Sound.createAsync(
        source,
        { shouldPlay: true, positionMillis: 0 }, // Explicitly start at beginning
        onPlaybackStatusUpdate
      );
      setSound(newSound);
      setIsPlaying(true);
      setPosition(0); // Ensure UI starts at beginning
    } catch (error) {
      console.error('Error loading sound:', error);
    }
  };

  const handlePageChange = async () => {
    await cleanupSound();
  };

  const renderAudioItem = (item: AudioFile, index: number) => (
    <View style={[styles.audioItem, mini && styles.miniAudioItem]}>
      <TouchableOpacity
        style={[styles.audioPlayButton, mini && styles.miniAudioPlayButton]}
        onPress={() => playPauseSound(item.moduleId)}
      >
        <Ionicons
          name={isPlaying && activeModuleId === item.moduleId ? "pause" : "play"}
          size={mini ? 24 : 48}
          color={colors.text}
        />
      </TouchableOpacity>
      {!mini && <Text style={styles.audioFileName}>{item.title}</Text>}
      <View style={[styles.audioProgressContainer, mini && styles.miniAudioProgressContainer]}>
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
  );

  if (useCarousel) {
    return <Carousel 
      items={audioFiles} 
      renderItem={renderAudioItem}
      onPageChange={handlePageChange}
    />;
  } else {
    // Use audioFilesOrSingle instead of audioFiles[0]
    const audioFilesOrSingle = audioUri 
      ? [{ id: 'single', title: 'Recording', moduleId: audioUri }]
      : audioFiles;

    // Only render if we have files to play
    if (audioFilesOrSingle.length === 0) return null;
    
    return renderAudioItem(audioFilesOrSingle[0], 0);
  }
};

const styles = StyleSheet.create({
  audioItem: {
    alignItems: 'center',
    width: '100%',
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
  miniAudioItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniAudioPlayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  miniAudioProgressContainer: {
    flex: 1,
    marginLeft: spacing.small,
  },
});

export default AudioPlayer;