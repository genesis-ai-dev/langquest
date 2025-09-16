import { useAuth } from '@/contexts/AuthContext';
import { useLocalization } from '@/hooks/useLocalization';
import { colors, fontSizes, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

interface WalkieTalkieRecorderProps {
  onRecordingComplete: (
    uri: string,
    duration: number,
    waveformData: number[]
  ) => void;
  onRecordingStart: () => void;
  onRecordingStop: () => void;
  isRecording: boolean;
}

const WalkieTalkieRecorder: React.FC<WalkieTalkieRecorderProps> = ({
  onRecordingComplete,
  onRecordingStart,
  onRecordingStop,
  isRecording
}) => {
  const { currentUser } = useAuth();
  const { t } = useLocalization();
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [permissionResponse, requestPermission] = Audio.usePermissions();
  const [isPressed, setIsPressed] = useState(false);
  const [canRecord, setCanRecord] = useState(false);

  // Animation for the button
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Minimum recording duration (1.5 seconds)
  const MIN_RECORDING_DURATION = 1500;

  // Generate simple waveform data for now (TODO: implement real audio analysis)
  const generateWaveformData = (duration: number): number[] => {
    const dataPoints = Math.floor(duration / 100); // One point per 100ms
    return Array.from({ length: dataPoints }, () => Math.random() * 0.8 + 0.1);
  };

  useEffect(() => {
    return () => {
      const cleanup = async () => {
        if (recording && !recording._isDoneRecording) {
          await recording.stopAndUnloadAsync();
        }
      };
      void cleanup();
    };
  }, [recording]);

  // Pulse animation when recording
  useEffect(() => {
    if (isRecording) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true
          })
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording, pulseAnim]);

  const startRecording = async () => {
    try {
      if (!currentUser) return;

      if (permissionResponse?.status !== Audio.PermissionStatus.GRANTED) {
        console.log('Requesting permission..');
        await requestPermission();
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true
      });

      const activeRecording = (
        await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        )
      ).recording;

      setRecording(activeRecording);
      setRecordingDuration(0);
      onRecordingStart();

      // Start monitoring recording status
      activeRecording.setOnRecordingStatusUpdate((status) => {
        if (status.isRecording) {
          const duration = status.durationMillis || 0;
          setRecordingDuration(duration);
        }
      });
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      if (uri && recordingDuration >= MIN_RECORDING_DURATION) {
        const waveformData = generateWaveformData(recordingDuration);
        onRecordingComplete(uri, recordingDuration, waveformData);
      }

      setRecording(null);
      setRecordingDuration(0);
      onRecordingStop();
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  const handlePressIn = async () => {
    if (!canRecord) return;

    setIsPressed(true);
    await startRecording();

    // Scale down animation
    Animated.spring(scaleAnim, {
      toValue: 0.9,
      useNativeDriver: true
    }).start();
  };

  const handlePressOut = async () => {
    if (!isPressed) return;

    setIsPressed(false);
    await stopRecording();

    // Scale back up animation
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true
    }).start();
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: handlePressIn,
    onPanResponderRelease: handlePressOut,
    onPanResponderTerminate: handlePressOut
  });

  // Check if we can record (permission granted)
  useEffect(() => {
    setCanRecord(permissionResponse?.status === Audio.PermissionStatus.GRANTED);
  }, [permissionResponse]);

  const formatDuration = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const ms = Math.floor((milliseconds % 1000) / 100);
    return `${seconds}.${ms}`;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.instructionText}>
        {isRecording
          ? `Recording... ${formatDuration(recordingDuration)}s`
          : 'Hold to record (min 1.5s)'}
      </Text>

      <View style={styles.buttonContainer}>
        <Animated.View
          style={[
            styles.recorderButton,
            isRecording && styles.recordingButton,
            {
              transform: [{ scale: scaleAnim }, { scale: pulseAnim }]
            }
          ]}
          {...panResponder.panHandlers}
        >
          <Ionicons
            name={isRecording ? 'mic' : 'mic-outline'}
            size={48}
            color={isRecording ? colors.error : colors.text}
          />
        </Animated.View>
      </View>

      {!canRecord && (
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={requestPermission}
        >
          <Text style={styles.permissionButtonText}>
            Grant Microphone Permission
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.large
  },
  instructionText: {
    fontSize: fontSizes.medium,
    color: colors.textSecondary,
    marginBottom: spacing.medium,
    textAlign: 'center'
  },
  buttonContainer: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  recorderButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.inputBackground,
    borderWidth: 3,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5
  },
  recordingButton: {
    backgroundColor: colors.error + '20',
    borderColor: colors.error
  },
  permissionButton: {
    marginTop: spacing.medium,
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    backgroundColor: colors.primary,
    borderRadius: 8
  },
  permissionButtonText: {
    color: colors.background,
    fontSize: fontSizes.medium,
    fontWeight: 'bold'
  }
});

export default WalkieTalkieRecorder;
