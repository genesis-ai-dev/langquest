import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import { useLocalization } from '@/hooks/useLocalization';
import { deleteIfExists } from '@/utils/fileUtils';
import type { LucideIconName } from '@react-native-vector-icons/lucide';
import {
  createAudioPlayer,
  getRecordingPermissionsAsync,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type AudioPlayer,
  type RecordingOptions
} from 'expo-audio';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

// Maximum file size in bytes (50MB)
const MAX_FILE_SIZE = 50 * 1024 * 1024;

interface ButtonConfig {
  icon: LucideIconName;
  onPress: (() => Promise<void>) | undefined;
  disabled?: boolean;
}
type RecordingQuality = 'HIGH_QUALITY' | 'LOW_QUALITY';

interface AudioRecorderProps {
  onRecordingComplete: (uri: string) => void;
  resetRecording?: () => void;
}

function calculateMaxDuration(options: RecordingOptions) {
  // expo-audio has bitRate at the top level
  const bitRate = options.bitRate ?? 128000; // bits per second

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
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [isRecordingActive, setIsRecordingActive] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(
    null
  );
  const [quality, setQuality] = useState<RecordingQuality>('HIGH_QUALITY');

  // Refs for playback
  const playerRef = useRef<AudioPlayer | null>(null);
  const playerListenerRef = useRef<{ remove: () => void } | null>(null);
  const positionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );

  // Ref for stopRecording to avoid stale closure in status listener
  const stopRecordingRef = useRef<(() => Promise<void>) | undefined>(undefined);

  // Calculate max duration and warning threshold based on quality
  const maxDuration = calculateMaxDuration(RecordingPresets[quality]!);
  const warningThreshold = maxDuration * 0.85; // Warning at 85% of max duration

  // Check permissions on mount
  useEffect(() => {
    void getRecordingPermissionsAsync().then(({ granted }) =>
      setPermissionGranted(granted)
    );
  }, []);

  // Create recorder (no status listener -- use useAudioRecorderState for duration/metering)
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // Poll recording state for duration tracking
  const recorderState = useAudioRecorderState(recorder, 100);

  // React to recorder state changes for duration tracking and auto-stop
  useEffect(() => {
    if (recorderState.isRecording) {
      const duration = recorderState.durationMillis || 0;
      setRecordingDuration(duration);

      // Check if we're approaching the limit
      if (duration >= warningThreshold && !showWarning) {
        setShowWarning(true);
      }

      // Stop recording if we've reached the maximum duration
      if (duration >= maxDuration) {
        void stopRecordingRef.current?.();
      }
    }
  }, [recorderState, warningThreshold, showWarning, maxDuration]);

  const cleanupPlayer = useCallback(() => {
    if (positionIntervalRef.current) {
      clearInterval(positionIntervalRef.current);
      positionIntervalRef.current = null;
    }
    if (playerListenerRef.current) {
      playerListenerRef.current.remove();
      playerListenerRef.current = null;
    }
    if (playerRef.current) {
      playerRef.current.pause();
      playerRef.current.release();
      playerRef.current = null;
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!recorder.isRecording) return;

    try {
      await recorder.stop();
      await setAudioModeAsync({
        allowsRecording: false
      });

      const uri = recorder.uri;
      if (recordingUri) {
        await deleteIfExists(recordingUri);
        console.log('Deleted previous recording attempt', recordingUri);
      }
      console.log('Recording stopped and stored at', uri);
      setRecordingUri(uri ?? null);
      setIsRecordingActive(false);
      setIsRecordingPaused(false);
      if (uri) onRecordingComplete(uri);
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  }, [recorder, recordingUri, onRecordingComplete]);

  // Keep ref up to date for status listener
  stopRecordingRef.current = stopRecording;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupPlayer();
      // Recorder cleanup is handled by useAudioRecorder hook
    };
  }, [cleanupPlayer]);

  const startRecording = async () => {
    try {
      if (!currentUser) return;

      if (!permissionGranted) {
        console.log('Requesting permission..');
        const { granted } = await requestRecordingPermissionsAsync();
        setPermissionGranted(granted);
        if (!granted) return;
      }
      resetRecording?.();
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true
      });

      // Resume recording if it was paused
      if (isRecordingPaused) {
        recorder.record();
        setIsRecordingActive(true);
        setIsRecordingPaused(false);
        return;
      }

      console.log('recording');

      // Prepare and start a new recording with the selected quality
      await recorder.prepareToRecordAsync(RecordingPresets[quality]);
      recorder.record();

      setIsRecordingActive(true);
      setIsRecordingPaused(false);
      setShowWarning(false);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const pauseRecording = async () => {
    if (!recorder.isRecording) return;
    recorder.pause();
    setIsRecordingActive(false);
    setIsRecordingPaused(true);
  };

  const playRecording = async () => {
    if (!recordingUri) return;

    try {
      if (playerRef.current) {
        // If player exists, just replay it
        if (playbackPosition === 0) playerRef.current.seekTo(0);
        playerRef.current.play();
      } else {
        // Create a new player
        await setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true
        });

        const player = createAudioPlayer(recordingUri);
        playerRef.current = player;
        player.play();

        // Listen for playback end
        playerListenerRef.current = player.addListener(
          'playbackStatusUpdate',
          (status) => {
            if (!status.didJustFinish) return;
            setIsPlaying(false);
            setPlaybackPosition(0);
            if (positionIntervalRef.current) {
              clearInterval(positionIntervalRef.current);
              positionIntervalRef.current = null;
            }
          }
        );

        // Track position
        positionIntervalRef.current = setInterval(() => {
          if (playerRef.current?.isLoaded) {
            setPlaybackPosition(playerRef.current.currentTime * 1000);
          }
        }, 100);
      }

      setIsPlaying(true);
    } catch (error) {
      console.error('Failed to play recording:', error);
    }
  };

  const pausePlayback = async () => {
    if (!playerRef.current) return;

    try {
      playerRef.current.pause();
      setIsPlaying(false);
    } catch (error) {
      console.error('Failed to pause playback:', error);
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
    if (isRecordingActive || isRecordingPaused) {
      return [
        {
          icon: isRecordingPaused ? 'mic' : 'pause',
          onPress: isRecordingPaused ? startRecording : pauseRecording
        },
        {
          icon: 'check',
          onPress: stopRecording
        }
      ];
    }

    if (recordingUri) {
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
        icon: 'check',
        onPress: undefined,
        disabled: !isRecordingActive
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
              name={button.icon}
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
