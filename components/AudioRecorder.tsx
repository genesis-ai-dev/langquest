import { colors, fontSizes, spacing } from '@/styles/theme';
import { sharedStyles } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { Audio, AVPlaybackStatus } from 'expo-av';
import React, { useEffect, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import { RecordingOptions } from 'expo-av/build/Audio';
import { useTranslation } from '@/hooks/useTranslation';

// Maximum file size in bytes (50MB)
const MAX_FILE_SIZE = 50 * 1024 * 1024;

interface ButtonConfig {
  icon: 'mic' | 'pause' | 'play' | 'checkmark';
  onPress: (() => Promise<void>) | undefined;
  disabled?: boolean;
}
type RecordingQuality = 'HIGH_QUALITY' | 'LOW_QUALITY';

interface AudioRecorderProps {
  onRecordingComplete: (uri: string) => void;
  resetRecording?: () => void;
}

const calculateMaxDuration = (options: RecordingOptions): number => {
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  const platformSpecificOptions = options[platform];
  // Using the exact bit rates from RecordingOptionsPresets
  const bitRate = platformSpecificOptions.bitRate!; // bits per second

  // Convert bit rate to bytes per second
  const bytesPerSecond = bitRate / 8;

  // Calculate maximum duration in seconds
  const maxDurationSeconds = MAX_FILE_SIZE / bytesPerSecond;

  return maxDurationSeconds * 1000; // Convert to milliseconds
};

const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onRecordingComplete,
  resetRecording
}) => {
  const { t } = useTranslation();
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [permissionResponse, requestPermission] = Audio.usePermissions();
  const [quality, setQuality] = useState<RecordingQuality>('HIGH_QUALITY');

  // Calculate max duration and warning threshold based on quality
  const maxDuration = calculateMaxDuration(
    Audio.RecordingOptionsPresets[quality]
  );
  const warningThreshold = maxDuration * 0.85; // Warning at 85% of max duration

  useEffect(() => {
    return () => {
      const cleanup = async () => {
        if (sound) {
          console.log('unloading sound');
          await sound.stopAsync();
          await sound.unloadAsync();
          setSound(null);
          setIsPlaying(false);
        }
        if (!recording?._isDoneRecording) await stopRecording();
      };
      cleanup();
    };
  }, [recording, sound]);

  const startRecording = async () => {
    try {
      if (permissionResponse?.status !== 'granted') {
        console.log('Requesting permission..');
        await requestPermission();
      }
      resetRecording?.();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true
      });

      // resume recording if it paused
      if (recording) {
        await recording.startAsync();
        setIsRecording(true);
        setIsRecordingPaused(false);
        return;
      }

      console.log('recording');

      const activeRecording = (
        await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets[quality]
        )
      ).recording;

      setRecording(activeRecording);
      setIsRecording(true);
      setIsRecordingPaused(false);
      setShowWarning(false);
      // Start monitoring recording status
      activeRecording.setOnRecordingStatusUpdate((status) => {
        if (status.isRecording) {
          const duration = status.durationMillis || 0;
          setRecordingDuration(duration);

          // Check if we're approaching the limit
          if (duration >= warningThreshold && !showWarning) {
            setShowWarning(true);
          }

          // Stop recording if we've reached the maximum duration
          if (duration >= maxDuration) {
            stopRecording();
          }
        }
      });
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const pauseRecording = async () => {
    if (!recording) return;
    console.log('pausing recording');
    await recording.pauseAsync();
    setIsRecording(false);
    setIsRecordingPaused(true);
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false
      });

      const uri = recording.getURI();
      if (recordingUri) {
        await FileSystem.deleteAsync(recordingUri);
        console.log('Deleting previous recording attempt', recordingUri);
      }
      console.log('Recording stopped and stored at', uri);
      setRecordingUri(uri || null);
      setRecording(null);
      setIsRecording(false);
      setIsRecordingPaused(false);
      if (uri) onRecordingComplete(uri);
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  const playRecording = async () => {
    if (!recordingUri) return;

    try {
      if (sound) {
        // If sound exists, just replay it from the beginning
        if (playbackPosition === 0) await sound.setPositionAsync(0);
        await sound.playAsync();
      } else {
        // Only create a new sound if one doesn't exist yet
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: recordingUri },
          { shouldPlay: true },
          onPlaybackStatusUpdate
        );
        setSound(newSound);
      }

      setIsPlaying(true);
    } catch (error) {
      console.error('Failed to play recording:', error);
    }
  };

  const pausePlayback = async () => {
    if (!sound) return;

    try {
      await sound.pauseAsync();
      setIsPlaying(false);
    } catch (error) {
      console.error('Failed to pause playback:', error);
    }
  };

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setPlaybackPosition(status.positionMillis);
      if (status.didJustFinish) {
        setIsPlaying(false);
        setPlaybackPosition(0);
      }
    }
  };

  const formatTime = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const getDurationDisplay = (): string => {
    const playbackTime = formatTime(playbackPosition);
    const totalTime = formatTime(recordingDuration);
    const remainingTime = formatTime(
      Math.max(0, maxDuration - recordingDuration)
    );
    return `${playbackTime}/${totalTime}\n${remainingTime} ${t('remaining')}`;
  };

  const getButtonConfig = (): [ButtonConfig, ButtonConfig] => {
    if (isRecording || isRecordingPaused) {
      return [
        {
          icon: isRecordingPaused ? 'mic' : 'pause',
          onPress: isRecordingPaused ? startRecording : pauseRecording
        },
        {
          icon: 'checkmark',
          onPress: stopRecording
        }
      ];
    }

    if (recordingUri && !isRecordingPaused) {
      return [
        {
          icon: 'mic',
          onPress: startRecording
        },
        {
          icon: isPlaying ? 'pause' : 'play',
          onPress: isPlaying ? pausePlayback : playRecording
        }
      ];
    }

    return [
      {
        icon: 'mic',
        onPress: startRecording
      },
      {
        icon: 'checkmark',
        onPress: undefined,
        disabled: !recording
      }
    ];
  };

  const buttons = getButtonConfig();

  return (
    <View style={styles.container}>
      {showWarning && (
        <Text style={styles.warningMessage}>
          Recording will stop in {formatTime(maxDuration - warningThreshold)}
        </Text>
      )}
      <Text style={[styles.duration]}>{getDurationDisplay()}</Text>
      <View style={styles.buttonContainer}>
        {buttons.map((button, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.button, button.disabled && styles.buttonDisabled]}
            onPress={button.onPress}
            disabled={button.disabled}
          >
            <Ionicons name={button.icon} size={24} color={colors.buttonText} />
          </TouchableOpacity>
        ))}
      </View>
      {Platform.OS === 'ios' && (
        <View style={styles.qualityContainer}>
          <TouchableOpacity
            style={styles.qualityOption}
            onPress={() => {
              const newQuality =
                quality === 'HIGH_QUALITY' ? 'LOW_QUALITY' : 'HIGH_QUALITY';
              setQuality(newQuality);
            }}
          >
            <View
              style={[
                styles.checkbox,
                quality === 'LOW_QUALITY' && styles.checkboxSelected
              ]}
            >
              {quality === 'LOW_QUALITY' && (
                <Ionicons
                  name="checkmark"
                  size={16}
                  color={colors.buttonText}
                />
              )}
            </View>
            <Text style={styles.qualityText}>Low quality</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: spacing.medium
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%'
  },
  button: {
    backgroundColor: colors.primary,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center'
  },
  buttonDisabled: {
    opacity: 0.5
  },
  duration: {
    fontSize: fontSizes.medium,
    color: colors.text,
    marginBottom: spacing.small,
    textAlign: 'center'
  },
  warningMessage: {
    fontSize: fontSizes.small,
    color: colors.error
  },
  qualityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.medium,
    gap: spacing.small
  },
  qualityLabel: {
    fontSize: fontSizes.medium,
    color: colors.text,
    marginRight: spacing.small
  },
  qualityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center'
  },
  checkboxSelected: {
    backgroundColor: colors.primary
  },
  qualityText: {
    fontSize: fontSizes.medium,
    color: colors.text
  }
});

export default AudioRecorder;
