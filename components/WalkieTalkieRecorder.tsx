import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLocalization } from '@/hooks/useLocalization';
import { colors, fontSizes, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

// Create animated SVG components
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface WalkieTalkieRecorderProps {
  onRecordingComplete: (
    uri: string,
    duration: number,
    waveformData: number[]
  ) => void;
  onRecordingStart: () => void;
  onRecordingStop: () => void;
  onWaveformUpdate?: (waveformData: number[]) => void;
  isRecording: boolean;
}

const WalkieTalkieRecorder: React.FC<WalkieTalkieRecorderProps> = ({
  onRecordingComplete,
  onRecordingStart,
  onRecordingStop,
  onWaveformUpdate,
  isRecording
}) => {
  const { currentUser: _currentUser } = useAuth();
  const { t: _t } = useLocalization();
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [permissionResponse, requestPermission] = Audio.usePermissions();
  const [isPressed, setIsPressed] = useState(false);
  const [canRecord, setCanRecord] = useState(false);
  const [isActivating, setIsActivating] = useState(false); // Holding to activate

  // Live waveform display capacity (side-scrolling window)
  const LIVE_BAR_CAPACITY = 60;

  // Initialize with full set of bars at 0 volume
  const [_realTimeWaveform, setRealTimeWaveform] = useState<number[]>(
    () => new Array(LIVE_BAR_CAPACITY).fill(0.01) as number[] // Start with minimal volume bars
  );

  // Track all recorded samples for final interpolation
  const [recordedSamples, setRecordedSamples] = useState<number[]>([]);

  // Animation for the button
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Activation progress (0 to 1) - fills over ACTIVATION_TIME
  const activationProgress = useRef(new Animated.Value(0)).current;
  const activationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Timer for delayed stop after release (to capture audio tail)
  const releaseDelayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Background color animation (0 = transparent, 1 = red)
  const bgColorAnim = useRef(new Animated.Value(0)).current;

  // Minimum recording duration (1 second)
  const MIN_RECORDING_DURATION = 1000; // Updated to 1 second as requested

  // Time to hold before recording starts (WhatsApp-style)
  const ACTIVATION_TIME = 500;

  // Delay after release before stopping recording (to capture audio tail)
  const RELEASE_DELAY = 300; // 300ms to capture the end of speech

  // Append a live sample with side-scrolling window (shift left, add right)
  const appendLiveSample = (amplitude01: number) => {
    const clampedAmplitude = Math.max(0.01, Math.min(1, amplitude01));

    // Add to recorded samples for final interpolation
    setRecordedSamples((prev) => [...prev, clampedAmplitude]);

    // Update live display with side-scrolling
    setRealTimeWaveform((prev) => {
      const next = [...prev.slice(1), clampedAmplitude];
      onWaveformUpdate?.(next);
      return next;
    });
  };

  // Cleanup recording and timers on unmount
  useEffect(() => {
    return () => {
      const cleanup = async () => {
        if (activationTimer.current) {
          clearTimeout(activationTimer.current);
        }
        if (releaseDelayTimer.current) {
          clearTimeout(releaseDelayTimer.current);
        }
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

  // Background color animation when recording starts/stops
  useEffect(() => {
    Animated.timing(bgColorAnim, {
      toValue: isRecording ? 1 : 0,
      duration: 300,
      useNativeDriver: false
    }).start();
  }, [isRecording, bgColorAnim]);

  const startRecording = async () => {
    try {
      const startTime = performance.now();
      console.log('🎙️ Starting recording process...');

      // Reset recorded samples for new recording
      setRecordedSamples([]);

      // Check and request permission if needed
      if (permissionResponse?.status !== Audio.PermissionStatus.GRANTED) {
        console.log('🔐 Requesting microphone permission...');
        const permissionResult = await requestPermission();
        if (permissionResult.status !== Audio.PermissionStatus.GRANTED) {
          console.log('❌ Permission denied');
          return;
        }
        console.log('✅ Permission granted');
      }

      // Set audio mode (fast, ~50ms)
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true
      });

      console.log('🎤 Creating fresh recording...');
      // Create recording fresh every time - don't reuse stale recordings
      const highQuality = Audio.RecordingOptionsPresets.HIGH_QUALITY;
      const options = {
        ...highQuality,
        ios: {
          ...(highQuality?.ios ?? {}),
          isMeteringEnabled: true
        },
        android: {
          ...(highQuality?.android ?? {}),
          isMeteringEnabled: true
        }
      } as typeof highQuality;

      const { recording: activeRecording } =
        await Audio.Recording.createAsync(options);

      const duration = performance.now() - startTime;
      console.log(`✅ Recording started in ${duration.toFixed(0)}ms`);

      setRecording(activeRecording);
      setRecordingDuration(0);
      onRecordingStart();

      // Start monitoring recording status - update more frequently for faster scrolling
      let lastUpdateTime = 0;
      activeRecording.setOnRecordingStatusUpdate((status) => {
        if (status.isRecording) {
          const duration = status.durationMillis || 0;
          setRecordingDuration(duration);

          // Update waveform every ~11ms (90fps) for much faster scrolling
          const now = Date.now();
          if (now - lastUpdateTime >= 11) {
            lastUpdateTime = now;

            // Use native metering from Expo AV (iOS/Android): status.metering is in dB (approx -160..0)
            const anyStatus = status as unknown as { metering?: number };
            if (typeof anyStatus.metering === 'number') {
              const db = anyStatus.metering;
              // Convert dB to linear amplitude in [0,1] with better scaling for speech
              // -60dB is quiet speech, -20dB is normal speech, 0dB is max
              const normalizedDb = Math.max(-60, Math.min(0, db));
              const amplitude = Math.pow(10, normalizedDb / 20);
              appendLiveSample(amplitude);
            } else {
              // Fallback: lightweight synthetic animation for platforms without metering
              const t = duration / 1000;
              const base = 0.3 + Math.sin(t * 24) * 0.15; // Much faster animation (3x)
              const noise = (Math.random() - 0.5) * 0.1;
              appendLiveSample(Math.max(0.02, Math.min(0.8, base + noise)));
            }
          }
        }
      });
      console.log('🎙️ Recording started successfully!');
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      if (uri && recordingDuration >= MIN_RECORDING_DURATION) {
        // Use the actual recorded samples (no mock bars, natural length variation)
        const waveformData = [...recordedSamples];
        onRecordingComplete(uri, recordingDuration, waveformData);
      }

      setRecording(null);
      setRecordingDuration(0);
      setRecordedSamples([]);
      // Reset waveform to full set of bars at 0 volume
      setRealTimeWaveform(new Array(LIVE_BAR_CAPACITY).fill(0.01));
      onRecordingStop();
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  const handlePressIn = () => {
    console.log('🎙️ Press in detected, starting activation timer...');

    // Immediate haptic feedback for tactile response
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setIsPressed(true);
    setIsActivating(true);

    // Start button press animation
    Animated.spring(scaleAnim, {
      toValue: 0.9,
      useNativeDriver: true
    }).start();

    // Start progress animation
    Animated.timing(activationProgress, {
      toValue: 1,
      duration: ACTIVATION_TIME,
      useNativeDriver: false
    }).start();

    // Start recording after ACTIVATION_TIME
    activationTimer.current = setTimeout(() => {
      console.log('✅ Activation complete, starting recording...');
      setIsActivating(false);

      // Stronger haptic when recording actually starts
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      void startRecording();
    }, ACTIVATION_TIME);
  };

  const handlePressOut = async () => {
    if (!isPressed) return;

    // Light haptic feedback on release
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setIsPressed(false);

    // If still activating, cancel activation
    if (isActivating) {
      console.log('❌ Released before activation complete, canceling...');
      setIsActivating(false);

      if (activationTimer.current) {
        clearTimeout(activationTimer.current);
        activationTimer.current = null;
      }

      // Reset progress animation
      activationProgress.setValue(0);

      // Scale back up animation
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true
      }).start();

      return;
    }

    // If recording, stop it after a delay to capture audio tail
    if (isRecording) {
      console.log(
        `⏳ Release detected, will stop recording in ${RELEASE_DELAY}ms to capture audio tail`
      );

      // Clear any existing release delay timer
      if (releaseDelayTimer.current) {
        clearTimeout(releaseDelayTimer.current);
      }

      // Delay the stop to capture the end of speech
      releaseDelayTimer.current = setTimeout(() => {
        console.log('🛑 Stopping recording after delay');
        void stopRecording();
        releaseDelayTimer.current = null;
      }, RELEASE_DELAY);
    }

    // Reset progress for next time
    activationProgress.setValue(0);

    // Scale back up animation
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true
    }).start();
  };

  // Using Button onPressIn/onPressOut for reliable hold-to-record behavior

  // Check if we can record (permission granted)
  useEffect(() => {
    setCanRecord(permissionResponse?.status === Audio.PermissionStatus.GRANTED);
  }, [permissionResponse]);

  const _formatDuration = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const ms = Math.floor((milliseconds % 1000) / 100);
    return `${seconds}.${ms}`;
  };

  // Interpolate progress to stroke-dashoffset for circular progress
  const progressCircumference = 2 * Math.PI * 38; // radius = 38 (button radius + stroke padding)
  const progressStrokeDashoffset = activationProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [progressCircumference, 0]
  });

  // Interpolate ring color from blue to red
  const ringColor = activationProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['#3b82f6', '#ef4444'] // blue-500 to red-500
  });

  // Container background color - animated from transparent to red
  const containerBgColor = bgColorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(239, 68, 68, 0)', 'rgba(239, 68, 68, 0.15)'] // transparent to red with 15% opacity
  });

  return (
    <Animated.View
      style={[styles.container, { backgroundColor: containerBgColor }]}
    >
      <View style={styles.buttonContainer}>
        <Animated.View
          style={[
            {
              transform: [{ scale: scaleAnim }, { scale: pulseAnim }]
            }
          ]}
        >
          {/* Circular progress indicator - always rendered but only visible when activating */}
          <View style={styles.progressRing}>
            <Svg width="84" height="84" viewBox="0 0 84 84">
              {/* Background track (subtle) */}
              {(isActivating || isRecording) && (
                <Circle
                  cx="42"
                  cy="42"
                  r="38"
                  stroke={isRecording ? '#fca5a5' : '#e5e7eb'}
                  strokeWidth="6"
                  fill="none"
                  opacity={0.3}
                />
              )}
              {/* Progress arc */}
              {(isActivating || isRecording) && (
                <AnimatedCircle
                  cx="42"
                  cy="42"
                  r="38"
                  stroke={ringColor}
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray={progressCircumference}
                  strokeDashoffset={progressStrokeDashoffset}
                  strokeLinecap="round"
                  rotation="-90"
                  origin="42, 42"
                />
              )}
            </Svg>
          </View>

          <Button
            variant={isRecording ? 'destructive' : 'default'}
            size="icon-xl"
            style={[
              styles.recorderButton,
              isRecording && styles.recordingButton
            ]}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
          >
            <Ionicons
              name={isRecording ? 'mic' : 'mic-outline'}
              size={32}
              color={colors.background}
            />
          </Button>
        </Animated.View>
      </View>

      {!canRecord && (
        <Button
          variant="outline"
          onPress={requestPermission}
          style={styles.permissionButton}
        >
          <Text style={styles.permissionButtonText}>
            Grant Microphone Permission
          </Text>
        </Button>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.large,
    borderRadius: 24
  },
  buttonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: 84,
    height: 84
  },
  progressRing: {
    position: 'absolute',
    top: '50%',
    left: '38.5%',
    marginTop: -42,
    marginLeft: -42,
    width: 84,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none'
  },
  recorderButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  recordingButton: {
    // Button component handles destructive variant styling
  },
  permissionButton: {
    marginTop: spacing.medium
  },
  permissionButtonText: {
    fontSize: fontSizes.medium,
    fontWeight: 'bold'
  }
});

export default WalkieTalkieRecorder;
