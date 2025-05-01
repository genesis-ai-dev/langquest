import { useTranslation } from '@/hooks/useTranslation';
import { colors, fontSizes, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import type { AVPlaybackStatus } from 'expo-av';
import { Audio } from 'expo-av';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Carousel from './Carousel';

interface AudioFile {
  id: string;
  title: string;
  uri: string;
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
  const [activeUri, setActiveUri] = useState<number | string | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    return () => {
      if (sound) void sound.unloadAsync();
    };
  }, [sound]);

  useEffect(() => {
    const setupAudio = async () => {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true
      });
    };
    void setupAudio();
  }, []);

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setDuration(status.durationMillis ?? 0);
      setPosition(status.positionMillis);
      setIsPlaying(status.isPlaying);

      if (status.didJustFinish) {
        setIsPlaying(false);
        setPosition(0);
      }
    }
  };

  const loadAndPlaySound = async (uri: string) => {
    console.log('loadAndPlaySound', uri);
    try {
      let loadedSound: Audio.Sound | null = null;

      // If we already have a sound with the same URI, just play it
      if (sound && activeUri === uri) {
        if (position === 0) await sound.setPositionAsync(0);
        await sound.playAsync();
        loadedSound = sound;
      } else {
        // Unload previous sound if exists
        if (sound) await sound.unloadAsync();

        const { sound: createdSound } = await Audio.Sound.createAsync(
          { uri: uri },
          { shouldPlay: true },
          onPlaybackStatusUpdate
        );
        loadedSound = createdSound;
      }

      setSound(loadedSound);
      setIsPlaying(true);
      setActiveUri(uri);
    } catch (error) {
      console.error('Error loading sound:', error);
      setSound(null);
      setIsPlaying(false);
      setActiveUri(null);
    }
  };

  const handlePlayPause = async (uri: string) => {
    if (isPlaying) await sound?.pauseAsync();
    else await loadAndPlaySound(uri);
  };

  const handleSliderChange = async (value: number) => {
    if (sound) await sound.setPositionAsync(value);
  };

  const renderAudioItem = (item: AudioFile) => (
    <View style={[styles.audioItem, mini && styles.miniAudioItem]}>
      <TouchableOpacity
        style={[styles.audioPlayButton, mini && styles.miniAudioPlayButton]}
        onPress={() => handlePlayPause(item.uri)}
      >
        <Ionicons
          name={isPlaying && activeUri === item.uri ? 'pause' : 'play'}
          size={mini ? 24 : 48}
          color={colors.text}
        />
      </TouchableOpacity>
      {!mini && <Text style={styles.audioFileName}>{item.title}</Text>}
      <View
        style={[
          styles.audioProgressContainer,
          mini && styles.miniAudioProgressContainer
        ]}
      >
        <Slider
          style={styles.audioProgressBar}
          minimumValue={0}
          maximumValue={duration}
          value={position}
          onSlidingComplete={handleSliderChange}
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
    return (
      <Carousel
        items={audioFiles}
        renderItem={renderAudioItem}
        onPageChange={async () => {
          if (sound) {
            await sound.unloadAsync();
            setSound(null);
            setIsPlaying(false);
            setPosition(0);
            setActiveUri(null);
          }
        }}
      />
    );
  }

  const audioFilesOrSingle = audioUri
    ? [{ id: 'single', title: t('recording'), uri: audioUri }]
    : audioFiles;

  if (!audioFilesOrSingle[0]) return null;

  return renderAudioItem(audioFilesOrSingle[0]);
};

const styles = StyleSheet.create({
  audioItem: {
    alignItems: 'center',
    width: '100%'
  },
  audioPlayButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.inputBackground
  },
  audioFileName: {
    color: colors.text,
    fontSize: fontSizes.small,
    marginTop: spacing.small,
    textAlign: 'center'
  },
  audioProgressContainer: {
    width: '100%',
    paddingHorizontal: spacing.medium
  },
  audioProgressBar: {
    width: '100%',
    height: 40
  },
  audioTimeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  audioTimeText: {
    color: colors.text,
    fontSize: fontSizes.small
  },
  miniAudioItem: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  miniAudioPlayButton: {
    width: 40,
    height: 40,
    borderRadius: 20
  },
  miniAudioProgressContainer: {
    flex: 1,
    marginLeft: spacing.small
  }
});

export default AudioPlayer;
