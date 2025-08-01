import { colors, fontSizes, spacing } from '@/styles/theme';
import { Audio } from 'expo-av';
import React, { useEffect, useRef, useState } from 'react';
import type { ViewStyle } from 'react-native';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface PlayableWaveformProps {
  audioUri: string;
  waveformData?: number[];
  duration: number;
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  isPlaying?: boolean;
  style?: ViewStyle;
}

export const PlayableWaveform: React.FC<PlayableWaveformProps> = ({
  audioUri,
  waveformData = [],
  duration,
  onPlay,
  onPause,
  onStop,
  isPlaying = false,
  style
}) => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [position, setPosition] = useState(0);
  const [localIsPlaying, setLocalIsPlaying] = useState(false);
  const animationFrameRef = useRef<number | null>(null);

  // Generate default waveform if none provided
  const displayWaveform =
    waveformData.length > 0
      ? waveformData
      : Array.from({ length: 20 }, () => Math.random() * 0.8 + 0.2);

  // Load audio
  useEffect(() => {
    const loadAudio = async () => {
      try {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: audioUri },
          { shouldPlay: false }
        );
        setSound(newSound);

        // Set up status updates
        newSound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded) {
            setPosition(status.positionMillis || 0);
            setLocalIsPlaying(status.isPlaying);

            if (status.didJustFinish) {
              setPosition(0);
              setLocalIsPlaying(false);
              if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
              }
              onStop?.();
            }
          }
        });
      } catch (error) {
        console.error('Error loading audio:', error);
      }
    };

    void loadAudio();

    return () => {
      if (sound) {
        void sound.unloadAsync();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [audioUri]);

  // Handle external play state changes
  useEffect(() => {
    if (isPlaying !== localIsPlaying) {
      if (isPlaying && sound) {
        void sound.playAsync();
      } else if (!isPlaying && sound) {
        void sound.pauseAsync();
      }
    }
  }, [isPlaying, sound, localIsPlaying]);

  const handlePress = async () => {
    if (!sound) return;

    try {
      if (localIsPlaying) {
        await sound.pauseAsync();
        onPause?.();
      } else {
        await sound.playAsync();
        onPlay?.();
      }
    } catch (error) {
      console.error('Error controlling playback:', error);
    }
  };

  const formatTime = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={() => void handlePress()}
      activeOpacity={0.8}
    >
      <View style={styles.waveformContainer}>
        {/* Progress overlay */}
        <View
          style={[styles.progressOverlay, { width: `${progressPercentage}%` }]}
        />

        {/* Waveform bars */}
        <View style={styles.waveformBars}>
          {displayWaveform.map((level, index) => {
            const height = Math.max(4, level * 20);
            const isActive =
              (index / displayWaveform.length) * 100 <= progressPercentage;

            return (
              <View
                key={index}
                style={[
                  styles.waveformBar,
                  {
                    height,
                    backgroundColor: isActive ? colors.primary : colors.disabled
                  }
                ]}
              />
            );
          })}
        </View>

        {/* Play/Pause button overlay */}
        {/* <View style={styles.playButtonOverlay}>
          <Ionicons
            name={localIsPlaying ? 'pause' : 'play'}
            size={16}
            color={colors.primary}
          />
        </View> */}
      </View>

      {/* Duration info */}
      <View style={styles.timeInfo}>
        <Text style={styles.timeText}>
          {formatTime(position)} / {formatTime(duration)}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    padding: spacing.small,
    borderWidth: 1,
    borderColor: colors.inputBorder
  },
  waveformContainer: {
    position: 'relative',
    height: 24,
    backgroundColor: colors.background,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: spacing.xsmall
  },
  progressOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    backgroundColor: colors.primaryLight,
    opacity: 0.3,
    zIndex: 1
  },
  waveformBars: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '100%',
    paddingHorizontal: 2,
    zIndex: 2
  },
  waveformBar: {
    width: 3,
    borderRadius: 1,
    minHeight: 4
  },
  playButtonOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -8 }, { translateY: -8 }],
    backgroundColor: colors.background,
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.inputBorder,
    zIndex: 3
  },
  timeInfo: {
    alignItems: 'center'
  },
  timeText: {
    fontSize: fontSizes.xsmall,
    color: colors.textSecondary,
    fontWeight: '500'
  }
});
