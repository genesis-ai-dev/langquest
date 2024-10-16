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
  uri: any;
}

interface AudioPlayerProps {
  audioFiles: AudioFile[];
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioFiles }) => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);

  useEffect(() => {
    return sound
      ? () => {
          console.log('Unloading Sound');
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
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

  const renderAudioItem = (item: AudioFile, index: number) => (
    <View style={styles.audioItem}>
      <TouchableOpacity
        style={styles.audioPlayButton}
        onPress={() => playPauseSound(item.uri)}
      >
        <Ionicons
          name={isPlaying ? "pause" : "play"}
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
  );

  return <Carousel items={audioFiles} renderItem={renderAudioItem} />;
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
});

export default AudioPlayer;