import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import { useLocalization } from '@/hooks/useLocalization';
import { deleteIfExists } from '@/utils/fileUtils';
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
import type { LucideIcon } from 'lucide-react-native';
import { Check, Mic, Pause, Play } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

// Maximum file size in bytes (50MB)
const MAX_FILE_SIZE = 50 * 1024 * 1024;

interface ButtonConfig {
  icon: LucideIcon;
  onPress: (() => void | Promise<void>) | undefined;
  disabled?: boolean;
}
type RecordingQuality = 'HIGH_QUALITY' | 'LOW_QUALITY';

interface AudioRecorderProps {
  onRecordingComplete: (uri: string) => void;
  resetRecording?: () => void;
}

// Fixed m4a container overhead (headers, metadata, atoms) — observed ~50-55KB across recordings
const CONTAINER_OVERHEAD = 56 * 1024;

function calculateMaxDuration(options: RecordingOptions) {
  const bitRate = options.bitRate ?? 128000; // bits per second

  // iOS AAC VBR encodes below the target bit rate.
  // Use 90% of target to stay above observed actual rates (~84% for LOW, ~72% for HIGH),
  // ensuring we predict more audio data than actually produced → shorter duration → under limit.
  const estimatedBitRate = bitRate * 0.9;

  const availableBytes = MAX_FILE_SIZE - CONTAINER_OVERHEAD;
  const bytesPerSecond = estimatedBitRate / 8;
  const maxDurationSeconds = availableBytes / bytesPerSecond;

  return maxDurationSeconds * 1000;
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

  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(
    null
  );
  const [quality, setQuality] = useState<RecordingQuality>('HIGH_QUALITY');

  // Refs for playback
  const playerRef = useRef<AudioPlayer | null>(null);
  const playerListenerRef = useRef<{ remove: () => void } | null>(null);

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

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY, (status) => {
    if (status.hasError) {
      console.error('Recording error:', status.error);
      setIsRecordingActive(false);
      setIsRecordingPaused(false);
    }
    if (status.mediaServicesDidReset) {
      console.warn('Media services reset — recorder invalidated');
      setIsRecordingActive(false);
      setIsRecordingPaused(false);
      setRecordingDuration(0);
    }
  });

  // Poll recording state for duration tracking
  const recorderState = useAudioRecorderState(recorder, 100);

  // React to recorder state changes for duration tracking and auto-stop
  useEffect(() => {
    if (recorderState.isRecording) {
      const duration = recorderState.durationMillis || 0;
      setRecordingDuration(duration);

      // Stop recording if we've reached the maximum duration
      if (duration >= maxDuration) {
        void stopRecordingRef.current?.();
      }
    }
  }, [recorderState, maxDuration]);

  const cleanupPlayer = useCallback(() => {
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
    // Allow stopping from both active-recording and paused states
    if (!recorder.isRecording && !isRecordingPaused) return;

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
  }, [recorder, recordingUri, onRecordingComplete, isRecordingPaused]);

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

      // Resume recording if it was paused — skip audio mode changes
      // to avoid disrupting the in-progress recording session on Android
      if (isRecordingPaused) {
        recorder.record();
        setIsRecordingActive(true);
        setIsRecordingPaused(false);
        return;
      }

      if (playerRef.current) {
        console.log('Pausing playback');
        pausePlayback();
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Sleep for 1 second
      }
      cleanupPlayer();
      setIsPlaying(false);
      setPlaybackPosition(0);
      setRecordingDuration(0);
      resetRecording?.();
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true
      });

      await recorder.prepareToRecordAsync(RecordingPresets[quality]);
      recorder.record({ forDuration: maxDuration / 1000 });

      setIsRecordingActive(true);
      setIsRecordingPaused(false);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const pauseRecording = () => {
    if (!recorder.isRecording) return;
    recorder.pause();
    setIsRecordingActive(false);
    setIsRecordingPaused(true);
  };

  const playRecordingAudio = async () => {
    if (!recordingUri) return;

    try {
      if (playerRef.current) {
        playerRef.current.play();
      } else {
        await setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true
        });

        const player = createAudioPlayer(recordingUri, {
          updateInterval: 100
        });
        playerRef.current = player;

        playerListenerRef.current = player.addListener(
          'playbackStatusUpdate',
          (status) => {
            setPlaybackPosition(status.currentTime * 1000);
            if (status.didJustFinish) {
              setIsPlaying(false);
              setPlaybackPosition(0);
              player.seekTo(0);
            }
          }
        );

        player.play();
      }

      setIsPlaying(true);
    } catch (error) {
      console.error('Failed to play recording:', error);
    }
  };

  const pausePlayback = () => {
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

  const getDurationDisplay = () => {
    const playbackTime = formatTime(playbackPosition);
    const activeDuration =
      isRecordingActive && recorderState.durationMillis
        ? recorderState.durationMillis
        : recordingDuration;
    const flooredDurationMs = Math.floor(activeDuration / 1000) * 1000;
    const totalTime = formatTime(flooredDurationMs);
    const remainingTime = formatTime(
      Math.max(0, maxDuration - flooredDurationMs)
    );
    return {
      topLine: `${playbackTime}/${totalTime}`,
      bottomLine: `${remainingTime} ${t('remaining')}`,
      isWarning: flooredDurationMs >= warningThreshold
    };
  };

  const isRecordingInProgress = isRecordingActive || isRecordingPaused;

  const getButtonConfig = (): [ButtonConfig, ButtonConfig] => {
    if (isRecordingInProgress) {
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
          onPress: isPlaying ? pausePlayback : playRecordingAudio
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
        disabled: !isRecordingActive
      }
    ];
  };

  const buttons = getButtonConfig();

  const durationDisplay = getDurationDisplay();

  return (
    <View className="items-center p-4">
      <Text className="text-center text-foreground">
        {durationDisplay.topLine}
      </Text>
      <Text
        className={`mb-2 text-center ${durationDisplay.isWarning ? 'text-destructive' : 'text-foreground'}`}
      >
        {durationDisplay.bottomLine}
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
          disabled={isRecordingInProgress}
          onPress={() => {
            const newQuality =
              quality === 'HIGH_QUALITY' ? 'LOW_QUALITY' : 'HIGH_QUALITY';
            setQuality(newQuality);
          }}
        >
          <Checkbox
            checked={quality === 'LOW_QUALITY'}
            disabled={isRecordingInProgress}
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
