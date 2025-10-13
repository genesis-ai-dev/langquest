import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useHaptic } from '@/hooks/useHaptic';
import { useLocalization } from '@/hooks/useLocalization';
import { colors, fontSizes, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Text } from './ui/text';

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
  // VAD mode props (native module handles recording, this is just for UI)
  isVADLocked?: boolean;
  onVADLockChange?: (locked: boolean) => void;
  // VAD visual feedback
  currentEnergy?: number;
  vadThreshold?: number;
}

const WalkieTalkieRecorder: React.FC<WalkieTalkieRecorderProps> = ({
  onRecordingComplete,
  onRecordingStart,
  onRecordingStop,
  onWaveformUpdate,
  isRecording,
  isVADLocked = false,
  onVADLockChange,
  currentEnergy = 0,
  vadThreshold = 0.03
}) => {
  const mediumHaptic = useHaptic('medium');
  const heavyHaptic = useHaptic('heavy');
  const successHaptic = useHaptic('success');
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

  // Slide-to-lock animation values
  const slideX = useRef(new Animated.Value(0)).current;
  const lockOpacity = useRef(new Animated.Value(0.3)).current;
  const [isSliding, setIsSliding] = useState(false);

  // Minimum recording duration (1 second)
  const MIN_RECORDING_DURATION = 1000; // Updated to 1 second as requested

  // Time to hold before recording starts (WhatsApp-style)
  const ACTIVATION_TIME = 500;

  // Delay after release before stopping recording (to capture audio tail)
  const RELEASE_DELAY = 300; // 300ms to capture the end of speech

  // Slide-to-lock constants
  const SLIDE_THRESHOLD = 120; // Distance to slide before locking (in pixels)
  const LOCK_HAPTIC_THRESHOLD = 100; // When to provide haptic feedback

  // Pan responder for slide-to-lock gesture
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isVADLocked,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only capture horizontal slides (more horizontal than vertical)
        return (
          !isVADLocked &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) &&
          Math.abs(gestureState.dx) > 5
        );
      },
      onPanResponderGrant: () => {
        setIsSliding(true);
        // Pulse the lock indicator
        Animated.sequence([
          Animated.timing(lockOpacity, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true
          })
        ]).start();
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow rightward slides
        const dx = Math.max(0, Math.min(SLIDE_THRESHOLD, gestureState.dx));
        slideX.setValue(dx);

        // Haptic feedback when approaching lock threshold
        if (dx > LOCK_HAPTIC_THRESHOLD && dx < LOCK_HAPTIC_THRESHOLD + 5) {
          void mediumHaptic();
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        setIsSliding(false);

        // If slid far enough, lock into VAD mode
        if (gestureState.dx >= SLIDE_THRESHOLD) {
          console.log('🔒 Slide-to-lock completed - activating VAD mode');

          void successHaptic();

          // Animate to locked position
          Animated.spring(slideX, {
            toValue: SLIDE_THRESHOLD,
            useNativeDriver: true,
            damping: 15,
            stiffness: 150
          }).start(() => {
            onVADLockChange?.(true);
          });

          Animated.timing(lockOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true
          }).start();
        } else {
          // Snap back to start
          Animated.spring(slideX, {
            toValue: 0,
            useNativeDriver: true,
            damping: 12,
            stiffness: 200
          }).start();

          Animated.timing(lockOpacity, {
            toValue: 0.3,
            duration: 200,
            useNativeDriver: true
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        // If gesture is interrupted, snap back
        setIsSliding(false);
        Animated.spring(slideX, {
          toValue: 0,
          useNativeDriver: true
        }).start();
        Animated.timing(lockOpacity, {
          toValue: 0.3,
          duration: 200,
          useNativeDriver: true
        }).start();
      }
    })
  ).current;

  // Reset slide position when unlocked externally
  useEffect(() => {
    if (!isVADLocked) {
      Animated.spring(slideX, {
        toValue: 0,
        useNativeDriver: true
      }).start();
      Animated.timing(lockOpacity, {
        toValue: 0.3,
        duration: 200,
        useNativeDriver: true
      }).start();
    }
  }, [isVADLocked, slideX, lockOpacity]);

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

      console.log('🎤 Initializing recorder...');

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

      const result = await Audio.Recording.createAsync(options);
      const activeRecording = result.recording;

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
              const fallbackEnergy = Math.max(
                0.02,
                Math.min(0.8, base + noise)
              );
              appendLiveSample(fallbackEnergy);
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
    if (!recording) {
      console.warn('⚠️ stopRecording called but no active recording');
      return;
    }

    try {
      // Check if recording still exists and hasn't been cleaned up
      const status = await recording.getStatusAsync().catch(() => null);
      if (!status) {
        console.warn('⚠️ Recording no longer exists, skipping stop');
        setRecording(null);
        return;
      }

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
      // Clean up state even on error
      setRecording(null);
      setRecordingDuration(0);
      setRecordedSamples([]);
      setRealTimeWaveform(new Array(LIVE_BAR_CAPACITY).fill(0.01));
    }
  };

  const handlePressIn = () => {
    // Disable manual recording when VAD is locked
    if (isVADLocked) {
      console.log('🔒 VAD mode is locked - manual recording disabled');
      return;
    }

    console.log('🎙️ Press in detected, starting activation timer...');

    // Immediate haptic feedback for tactile response
    void mediumHaptic();

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
      void heavyHaptic();

      void startRecording();
    }, ACTIVATION_TIME);
  };

  const handlePressOut = () => {
    if (!isPressed) return;

    // Light haptic feedback on release
    void mediumHaptic();

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

  // Live waveform animation for VAD mode
  const waveformOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(waveformOpacity, {
      toValue: isVADLocked ? 1 : 0,
      duration: 300,
      useNativeDriver: true
    }).start();
  }, [isVADLocked, waveformOpacity]);

  // Determine waveform color based on recording state
  const getWaveformColor = () => {
    if (isRecording) return colors.error; // Red when recording
    return colors.primary; // Blue when monitoring
  };

  // Scale current energy for visualization (0-1 range to bar height)
  const energyScale = Math.min(
    1,
    Math.max(0, currentEnergy / (vadThreshold * 3))
  );

  // Use a state to track animation frame for waveform
  const [waveformTime, setWaveformTime] = useState(0);

  useEffect(() => {
    if (!isVADLocked) return;

    const interval = setInterval(() => {
      setWaveformTime((t) => t + 0.1);
    }, 50); // Update 20 times per second

    return () => clearInterval(interval);
  }, [isVADLocked]);

  return (
    <Animated.View
      className="items-center rounded-3xl py-6"
      style={{ backgroundColor: containerBgColor }}
    >
      {/* Live waveform visualization when VAD locked */}
      {isVADLocked && (
        <Animated.View
          style={[styles.waveformContainer, { opacity: waveformOpacity }]}
        >
          <View style={styles.waveform}>
            {Array.from({ length: 20 }).map((_, i) => {
              // Create a flowing waveform effect using waveformTime
              const phase = waveformTime + i * 0.5;
              const wave = 0.5 + Math.sin(phase) * 0.5;
              const barHeight = energyScale * wave;
              return (
                <View
                  key={i}
                  style={[
                    styles.waveformBar,
                    {
                      height: Math.max(2, barHeight * 24),
                      backgroundColor: getWaveformColor()
                    }
                  ]}
                />
              );
            })}
          </View>
        </Animated.View>
      )}

      <View style={styles.slideToLockContainer}>
        {/* Lock channel/track on the right */}
        {!isVADLocked && (
          <Animated.View
            style={[
              styles.lockChannel,
              { opacity: isSliding ? lockOpacity : 0.3 }
            ]}
          >
            <Ionicons name="lock-closed" size={24} color={colors.primary} />
            <Text style={styles.lockChannelText}>
              {isSliding ? 'Release to lock' : 'Slide →'}
            </Text>
          </Animated.View>
        )}

        {/* Locked indicator with cancel button */}
        {isVADLocked && (
          <View style={styles.lockedIndicator}>
            <Ionicons name="lock-closed" size={20} color={colors.primary} />
            <Text style={styles.lockedText}>VAD Active</Text>
            <Button
              variant="ghost"
              size="icon"
              onPress={() => {
                console.log('🔓 Cancel VAD mode');
                onVADLockChange?.(false);
              }}
              style={styles.cancelButton}
            >
              <Ionicons name="close" size={16} color={colors.error} />
            </Button>
          </View>
        )}

        {/* Button with pan responder */}
        <View
          style={styles.buttonContainer}
          {...(isVADLocked ? {} : panResponder.panHandlers)}
        >
          <Animated.View
            style={[
              {
                transform: [
                  { translateX: slideX },
                  { scale: scaleAnim },
                  { scale: pulseAnim }
                ]
              }
            ]}
          >
            {/* Circular progress indicator */}
            <View style={styles.progressRing}>
              <Svg width="84" height="84" viewBox="0 0 84 84">
                {/* Background track */}
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
              variant={
                isVADLocked
                  ? 'secondary'
                  : isRecording
                    ? 'destructive'
                    : 'default'
              }
              size="icon-xl"
              style={[
                styles.recorderButton,
                isRecording && styles.recordingButton,
                isVADLocked && styles.lockedButton
              ]}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              disabled={isVADLocked}
            >
              <Ionicons
                name={
                  isVADLocked
                    ? 'lock-closed'
                    : isRecording
                      ? 'mic'
                      : 'mic-outline'
                }
                size={32}
                color={colors.background}
              />
            </Button>
          </Animated.View>
        </View>

        {/* Unlock button when locked */}
        {isVADLocked && (
          <Button
            variant="outline"
            size="sm"
            onPress={() => {
              console.log('🔓 Unlocking VAD mode');
              onVADLockChange?.(false);
            }}
            style={styles.unlockButton}
          >
            <Ionicons name="lock-open" size={16} color={colors.primary} />
            <Text style={styles.unlockButtonText}>Unlock</Text>
          </Button>
        )}
      </View>

      {!canRecord && (
        <Button
          variant="secondary"
          onPress={requestPermission}
          className="mt-4"
        >
          <Text className="text-base font-bold">
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
  waveformContainer: {
    position: 'absolute',
    top: -spacing.xlarge - spacing.medium,
    alignItems: 'center',
    gap: spacing.xsmall
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xsmall / 2,
    height: 24
  },
  waveformBar: {
    width: 3,
    borderRadius: 1.5,
    minHeight: 2
  },
  preparingText: {
    fontSize: fontSizes.xsmall,
    color: colors.primary,
    fontWeight: '600'
  },
  slideToLockContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: spacing.large,
    minHeight: 100
  },
  lockChannel: {
    position: 'absolute',
    right: spacing.large,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xsmall,
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    borderRadius: 20,
    backgroundColor: `${colors.textSecondary}`
  },
  lockChannelText: {
    fontSize: fontSizes.small,
    color: colors.primary,
    fontWeight: '600'
  },
  lockedIndicator: {
    position: 'absolute',
    top: -spacing.large,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xsmall,
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.xsmall,
    borderRadius: 16,
    backgroundColor: `${colors.primary}20`
  },
  lockedText: {
    fontSize: fontSizes.small,
    color: colors.primary,
    fontWeight: '600'
  },
  cancelButton: {
    width: 24,
    height: 24,
    marginLeft: spacing.xsmall
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
  lockedButton: {
    backgroundColor: colors.primary,
    opacity: 0.8
  },
  unlockButton: {
    position: 'absolute',
    bottom: -spacing.xlarge - spacing.medium,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xsmall,
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.xsmall
  },
  unlockButtonText: {
    fontSize: fontSizes.small,
    color: colors.primary,
    marginLeft: spacing.xsmall
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
