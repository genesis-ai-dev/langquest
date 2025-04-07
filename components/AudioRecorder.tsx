import { colors, fontSizes, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { Audio, AVPlaybackStatus } from 'expo-av';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { calculateTotalAttachments } from '@/utils/attachmentUtils';
import { ATTACHMENT_QUEUE_LIMITS } from '@/db/powersync/constants';
import { downloadService } from '@/database_services/downloadService';
import { useAuth } from '@/contexts/AuthContext';

interface ButtonConfig {
  icon: 'mic' | 'pause' | 'play' | 'checkmark';
  onPress: (() => Promise<void>) | undefined;
  disabled?: boolean;
}

interface AudioRecorderProps {
  onRecordingComplete: (uri: string) => void;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onRecordingComplete
}) => {
  const { currentUser } = useAuth();
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [permissionResponse, requestPermission] = Audio.usePermissions();

  useEffect(() => {
    return () => {
      if (recording) recording.stopAndUnloadAsync();
      if (sound) sound.unloadAsync();
    };
  }, []);

  const startRecording = async () => {
    try {
      if (!currentUser) {
        Alert.alert('Error', 'You must be logged in to record audio');
        return;
      }

      // Check attachment limit before starting
      const downloadedAssets = await downloadService.getAllDownloadedAssets(
        currentUser.id
      );
      const totalAttachments =
        await calculateTotalAttachments(downloadedAssets);
      console.log('Total attachments:', totalAttachments);

      if (totalAttachments >= ATTACHMENT_QUEUE_LIMITS.PERMANENT) {
        Alert.alert(
          'Attachment Limit Exceeded',
          `You have reached the maximum number of attachments (${ATTACHMENT_QUEUE_LIMITS.PERMANENT}). Please delete some recordings before creating new ones.`,
          [{ text: 'OK' }]
        );
        return;
      }

      if (permissionResponse?.status !== 'granted') {
        console.log('Requesting permission..');
        await requestPermission();
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true
      });

      // resume recording if it paused
      if (recording) {
        await recording.startAsync();
        setIsRecording(true);
        return;
      }

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);
      setIsRecording(true);

      // Start monitoring recording status
      newRecording.setOnRecordingStatusUpdate((status) => {
        if (status.isRecording) {
          setRecordingDuration(status.durationMillis || 0);
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

      if (uri) onRecordingComplete(uri);
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  const playRecording = async () => {
    if (!recordingUri) return;

    try {
      if (sound) await sound.unloadAsync();

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: recordingUri },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );

      setSound(newSound);
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
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const getDurationDisplay = (): string => {
    const playbackTime = formatTime(playbackPosition);
    const totalTime = formatTime(recordingDuration);
    return `${playbackTime}/${totalTime}`;
  };

  const getButtonConfig = (): [ButtonConfig, ButtonConfig] => {
    if (isRecording) {
      return [
        {
          icon: 'pause',
          onPress: pauseRecording
        },
        {
          icon: 'checkmark',
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
        icon: 'checkmark',
        onPress: undefined,
        disabled: true
      }
    ];
  };

  const buttons = getButtonConfig();

  return (
    <View style={styles.container}>
      <Text style={styles.duration}>{getDurationDisplay()}</Text>
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
    marginBottom: spacing.small
  }
});

export default AudioRecorder;
