import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import { useLocalization } from '@/hooks/useLocalization';
import { deleteIfExists } from '@/utils/fileUtils';
import type { AVPlaybackStatus } from 'expo-av';
import { Audio } from 'expo-av';
import type { RecordingOptions } from 'expo-av/build/Audio';
import type { LucideIcon } from 'lucide-react-native';
import { Check, Mic, Pause, Play } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

// Maximum file size in bytes (50MB)
const MAX_FILE_SIZE = 50 * 1024 * 1024;

interface ButtonConfig {
  icon: LucideIcon;
  onPress: (() => Promise<void>) | undefined;
  disabled?: boolean;
}
type RecordingQuality = 'HIGH_QUALITY' | 'LOW_QUALITY';

interface AudioRecorderProps {
  onRecordingComplete: (uri: string) => void;
  resetRecording?: () => void;
}

function calculateMaxDuration(options: RecordingOptions) {
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  const platformSpecificOptions = options[platform];
  // Using the exact bit rates from RecordingOptionsPresets
  const bitRate = platformSpecificOptions.bitRate ?? 128000; // bits per second

  // Convert bit rate to bytes per second
  const bytesPerSecond = bitRate / 8;

  // Calculate maximum duration in seconds
  const maxDurationSeconds = MAX_FILE_SIZE / bytesPerSecond;

  return maxDurationSeconds * 1000; // Convert to milliseconds
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onRecordingComplete,
  resetRecording
}) => {
  const { currentUser } = useAuth();
  const { t } = useLocalization();
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
    Audio.RecordingOptionsPresets[quality]!
  );
  const warningThreshold = maxDuration * 0.85; // Warning at 85% of max duration

  const stopRecording = useCallback(async () => {
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false
      });

      const uri = recording.getURI();
      if (recordingUri) {
        await deleteIfExists(recordingUri);
        console.log('Deleted previous recording attempt', recordingUri);
      }
      console.log('Recording stopped and stored at', uri);
      setRecordingUri(uri ?? null);
      setRecording(null);
      setIsRecording(false);
      setIsRecordingPaused(false);
      if (uri) onRecordingComplete(uri);
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  }, [recording, recordingUri, onRecordingComplete]);

  useEffect(() => {
    return () => {
      const cleanup = async () => {
        if (sound?._loaded) {
          await sound.stopAsync();
          await sound.unloadAsync();
          setSound(null);
          setIsPlaying(false);
        }
        if (!recording?._isDoneRecording) await stopRecording();
      };
      void cleanup();
    };
  }, [recording, sound, stopRecording]);

  const startRecording = async () => {
    try {
      if (!currentUser) return;

      if (permissionResponse?.status !== Audio.PermissionStatus.GRANTED) {
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
            void stopRecording();
          }
        }
      });
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const pauseRecording = async () => {
    if (!recording) return;
    await recording.pauseAsync();
    setIsRecording(false);
    setIsRecordingPaused(true);
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
          icon: isRecordingPaused ? Mic : Pause,
          onPress: isRecordingPaused ? startRecording : pauseRecording
        },
        {
          icon: Check,
          onPress: stopRecording
        }
      ];
    }

    if (recordingUri) {
      return [
        {
          icon: Mic,
          onPress: startRecording
        },
        {
          icon: isPlaying ? Pause : Play,
          onPress: isPlaying ? pausePlayback : playRecording
        }
      ];
    }

    return [
      {
        icon: Mic,
        onPress: startRecording
      },
      {
        icon: Check,
        onPress: undefined,
        disabled: !recording
      }
    ];
  };

  const buttons = getButtonConfig();

  return (
    <View className="items-center p-4">
      {showWarning && (
        <Text className="text-sm text-destructive">
          Recording will stop in {formatTime(maxDuration - warningThreshold)}
        </Text>
      )}
      <Text className="mb-2 text-center text-foreground">
        {getDurationDisplay()}
      </Text>
      <View className="w-full flex-row justify-around">
        {buttons.map((button, index) => (
          <Button
            key={index}
            size="icon-2xl"
            variant="default"
            className="rounded-full"
            onPress={button.onPress}
            disabled={button.disabled}
          >
            <Icon
              as={button.icon}
              size={24}
              className="text-primary-foreground"
            />
          </Button>
        ))}
      </View>
      {Platform.OS === 'ios' && (
        <Pressable
          className="mt-4 flex-row items-center gap-2"
          onPress={() => {
            const newQuality =
              quality === 'HIGH_QUALITY' ? 'LOW_QUALITY' : 'HIGH_QUALITY';
            setQuality(newQuality);
          }}
        >
          <Checkbox
            checked={quality === 'LOW_QUALITY'}
            onCheckedChange={(checked) => {
              setQuality(checked ? 'LOW_QUALITY' : 'HIGH_QUALITY');
            }}
          />
          <Text className="text-foreground">Low quality</Text>
        </Pressable>
      )}
    </View>
  );
};

export default AudioRecorder;
