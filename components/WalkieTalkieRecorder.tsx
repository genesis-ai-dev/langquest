import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useHaptic } from '@/hooks/useHaptic';
import { useLocalization } from '@/hooks/useLocalization';
import { colors } from '@/styles/theme';
import { cn } from '@/utils/styleUtils';
import { Audio } from 'expo-av';
import { LockIcon, MicIcon, X } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';
import { Icon } from './ui/icon';
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
  onRecordingDiscarded?: () => void; // Called when recording is too short
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
  onRecordingDiscarded,
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
  const [isSlideGestureActive, setIsSlideGestureActive] = useState(false); // Track if user is sliding

  // Live waveform display capacity (side-scrolling window)
  const LIVE_BAR_CAPACITY = 60;

  // Initialize with full set of bars at 0 volume
  const [_realTimeWaveform, setRealTimeWaveform] = useState<number[]>(
    () => new Array(LIVE_BAR_CAPACITY).fill(0.01) as number[] // Start with minimal volume bars
  );

  // Track all recorded samples for final interpolation
  const [recordedSamples, setRecordedSamples] = useState<number[]>([]);

  // Reanimated shared values for smooth UI-thread animations
  const scaleAnim = useSharedValue(1);
  const pulseAnim = useSharedValue(1);
  const activationProgress = useSharedValue(0);
  const bgColorAnim = useSharedValue(0);
  const slideX = useSharedValue(0);
  const lockOpacity = useSharedValue(0.3);

  // Timers and state
  const activationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const releaseDelayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // Store current prop values in refs for gesture access
  const isVADLockedRef = useRef(isVADLocked);
  const isRecordingRef = useRef(isRecording);

  useEffect(() => {
    isVADLockedRef.current = isVADLocked;
    isRecordingRef.current = isRecording;
  }, [isVADLocked, isRecording]);

  // Callbacks wrapped for scheduleOnRN
  const handleSlideStart = () => {
    setIsSliding(true);
    setIsSlideGestureActive(true);

    // Cancel any pending activation timer if user starts sliding
    if (activationTimer.current) {
      clearTimeout(activationTimer.current);
      activationTimer.current = null;
    }
    setIsActivating(false);
  };

  const handleSlideComplete = () => {
    console.log('🔒 Slide-to-lock completed - activating VAD mode');
    void successHaptic();
    onVADLockChange?.(true);
  };

  const handleSlideCancel = () => {
    setIsSliding(false);
    setTimeout(() => {
      setIsSlideGestureActive(false);
    }, 100);
  };

  const triggerHaptic = () => {
    void mediumHaptic();
  };

  // Pan gesture for slide-to-lock using Reanimated Gesture API
  const panGesture = Gesture.Pan()
    .enabled(!isVADLocked && !isRecording)
    .activeOffsetX(5)
    .failOffsetY([-10, 10])
    .onStart(() => {
      'worklet';
      scheduleOnRN(handleSlideStart);
      activationProgress.value = 0;
      lockOpacity.value = withTiming(1, { duration: 150 });
    })
    .onUpdate((event) => {
      'worklet';
      // Only allow rightward slides
      const dx = Math.max(0, Math.min(SLIDE_THRESHOLD, event.translationX));
      slideX.value = dx;

      // Haptic feedback when approaching lock threshold
      if (dx > LOCK_HAPTIC_THRESHOLD && dx < LOCK_HAPTIC_THRESHOLD + 5) {
        scheduleOnRN(triggerHaptic);
      }
    })
    .onEnd((event) => {
      'worklet';
      const dx = event.translationX;

      if (dx >= SLIDE_THRESHOLD) {
        // Slid far enough - lock into VAD mode
        slideX.value = withSpring(SLIDE_THRESHOLD, {
          damping: 15,
          stiffness: 150
        });
        lockOpacity.value = withTiming(1, { duration: 200 });
        scheduleOnRN(handleSlideComplete);
      } else {
        // Snap back to start
        slideX.value = withSpring(0, {
          damping: 12,
          stiffness: 200
        });
        lockOpacity.value = withTiming(0.3, { duration: 200 });
      }

      scheduleOnRN(handleSlideCancel);
    })
    .onFinalize(() => {
      'worklet';
      // If gesture is interrupted, snap back
      if (slideX.value > 0 && slideX.value < SLIDE_THRESHOLD) {
        slideX.value = withSpring(0);
        lockOpacity.value = withTiming(0.3, { duration: 200 });
        scheduleOnRN(handleSlideCancel);
      }
    });

  // Reset slide position when unlocked externally
  useEffect(() => {
    if (!isVADLocked) {
      slideX.value = withSpring(0);
      lockOpacity.value = withTiming(0.3, { duration: 200 });
    }
  }, [isVADLocked]);

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
      pulseAnim.value = withTiming(
        1.2,
        {
          duration: 500,
          easing: Easing.inOut(Easing.ease)
        },
        (finished) => {
          'worklet';
          if (finished) {
            pulseAnim.value = withTiming(
              1,
              {
                duration: 500,
                easing: Easing.inOut(Easing.ease)
              },
              (finished2) => {
                'worklet';
                if (finished2 && isRecordingRef.current) {
                  // Loop the animation
                  pulseAnim.value = withTiming(1.2, {
                    duration: 500,
                    easing: Easing.inOut(Easing.ease)
                  });
                }
              }
            );
          }
        }
      );
    } else {
      cancelAnimation(pulseAnim);
      pulseAnim.value = withTiming(1, { duration: 200 });
    }
  }, [isRecording]);

  // Background color animation when recording starts/stops
  useEffect(() => {
    bgColorAnim.value = withTiming(isRecording ? 1 : 0, {
      duration: 300
    });
  }, [isRecording]);

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
      activeRecording.setProgressUpdateInterval(11);

      const duration = performance.now() - startTime;
      console.log(`✅ Recording started in ${duration.toFixed(0)}ms`);

      setRecording(activeRecording);
      setRecordingDuration(0);
      onRecordingStart();

      // Start monitoring recording status - update more frequently for faster scrolling
      activeRecording.setOnRecordingStatusUpdate((status) => {
        if (status.isRecording) {
          const duration = status.durationMillis || 0;
          setRecordingDuration(duration);

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
            const fallbackEnergy = Math.max(0.02, Math.min(0.8, base + noise));
            appendLiveSample(fallbackEnergy);
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
        // Notify parent that recording has stopped
        onRecordingStop();
        return;
      }

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      if (uri) {
        if (recordingDuration >= MIN_RECORDING_DURATION) {
          // Use the actual recorded samples (no mock bars, natural length variation)
          const waveformData = [...recordedSamples];
          onRecordingComplete(uri, recordingDuration, waveformData);
        } else {
          console.log(
            `⏭️ Recording too short (${recordingDuration}ms), discarding`
          );
          // Notify parent to clean up the pending card
          onRecordingDiscarded?.();
        }
      }

      setRecording(null);
      setRecordingDuration(0);
      setRecordedSamples([]);
      // Reset waveform to full set of bars at 0 volume
      setRealTimeWaveform(new Array(LIVE_BAR_CAPACITY).fill(0.01));

      // Notify parent that recording has stopped
      onRecordingStop();
    } catch (error) {
      console.error('Failed to stop recording:', error);
      // Clean up state even on error
      setRecording(null);
      setRecordingDuration(0);
      setRecordedSamples([]);
      setRealTimeWaveform(new Array(LIVE_BAR_CAPACITY).fill(0.01));

      // Notify parent that recording has stopped
      onRecordingStop();
    }
  };

  const handlePressIn = () => {
    // Disable manual recording when VAD is locked
    if (isVADLocked) {
      console.log('🔒 VAD mode is locked - manual recording disabled');
      return;
    }

    // Don't start recording if user is sliding
    if (isSlideGestureActive) {
      console.log('🔒 Slide gesture active - ignoring press');
      return;
    }

    console.log('🎙️ Press in detected, starting activation timer...');

    // Immediate haptic feedback for tactile response
    void mediumHaptic();

    setIsPressed(true);
    setIsActivating(true);

    // Start button press animation (smooth spring on UI thread)
    scaleAnim.value = withSpring(0.9, {
      damping: 15,
      stiffness: 150
    });

    // Start progress animation (timing on UI thread)
    activationProgress.value = withTiming(1, {
      duration: ACTIVATION_TIME,
      easing: Easing.linear
    });

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

    // If a slide gesture was/is active, don't process recording logic
    if (isSlideGestureActive) {
      console.log('🔒 Slide gesture was active - ignoring press out');
      setIsPressed(false);

      // Reset progress animation (smooth on UI thread)
      activationProgress.value = withTiming(0, { duration: 150 });

      // Scale back up animation
      scaleAnim.value = withSpring(1, {
        damping: 15,
        stiffness: 150
      });

      return;
    }

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
      activationProgress.value = withTiming(0, { duration: 150 });

      // Scale back up animation
      scaleAnim.value = withSpring(1, {
        damping: 15,
        stiffness: 150
      });

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
    activationProgress.value = withTiming(0, { duration: 150 });

    // Scale back up animation
    scaleAnim.value = withSpring(1, {
      damping: 15,
      stiffness: 150
    });
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

  // Constants for circular progress
  const progressCircumference = 2 * Math.PI * 38; // radius = 38 (button radius + stroke padding)

  // Animated styles using Reanimated
  const containerAnimatedStyle = useAnimatedStyle(() => {
    const bgColor = interpolateColor(
      bgColorAnim.value,
      [0, 1],
      ['rgba(239, 68, 68, 0)', 'rgba(239, 68, 68, 0.15)']
    );
    return {
      backgroundColor: bgColor
    };
  });

  const buttonAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: slideX.value },
        { scale: scaleAnim.value },
        { scale: pulseAnim.value }
      ]
    };
  });

  const lockIndicatorAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: lockOpacity.value
    };
  });

  // Animated props for SVG Circle
  const progressCircleAnimatedProps = useAnimatedProps(() => {
    return {
      stroke: interpolateColor(
        activationProgress.value,
        [0, 1],
        ['#3b82f6', '#ef4444']
      ),
      strokeDashoffset: interpolate(
        activationProgress.value,
        [0, 1],
        [progressCircumference, 0]
      )
    };
  });

  // Live waveform animation for VAD mode
  const waveformOpacity = useSharedValue(0);

  useEffect(() => {
    waveformOpacity.value = withTiming(isVADLocked ? 1 : 0, {
      duration: 300
    });
  }, [isVADLocked]);

  const waveformAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: waveformOpacity.value
    };
  });

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
      style={containerAnimatedStyle}
    >
      {/* Live waveform visualization when VAD locked */}
      {isVADLocked && (
        <Animated.View
          className="absolute -top-16 items-center gap-1"
          style={waveformAnimatedStyle}
        >
          <View className="h-6 flex-row items-center gap-0.5">
            {Array.from({ length: 20 }).map((_, i) => {
              // Create a flowing waveform effect using waveformTime
              const phase = waveformTime + i * 0.5;
              const wave = 0.5 + Math.sin(phase) * 0.5;
              const barHeight = energyScale * wave;
              return (
                <View
                  key={i}
                  className="min-h-[2px] w-[3px] rounded-full"
                  style={{
                    height: Math.max(2, barHeight * 24),
                    backgroundColor: getWaveformColor()
                  }}
                />
              );
            })}
          </View>
        </Animated.View>
      )}

      <View className="min-h-[100px] w-full flex-row-reverse items-center justify-center px-4">
        {/* Lock indicator / Cancel button */}
        {!isVADLocked ? (
          <Animated.View
            className="align-end absolute right-1 flex-row items-center gap-1 rounded-2xl px-3 py-2 pl-6"
            style={[
              { backgroundColor: colors.textSecondary },
              lockIndicatorAnimatedStyle
            ]}
          >
            <Icon as={LockIcon} className="text-secondary-foreground" />
            <Text className="text-sm font-semibold text-primary">
              {isSliding ? 'Release to lock' : 'Slide →'}
            </Text>
          </Animated.View>
        ) : (
          <></>
        )}

        {/* Button with gesture detector */}
        <GestureDetector gesture={panGesture}>
          <View className="relative h-[84px] w-[84px] items-center justify-center">
            <Animated.View style={buttonAnimatedStyle}>
              {/* Circular progress indicator */}
              <View className="pointer-events-none absolute left-[38.5%] top-1/2 -ml-[42px] -mt-[42px] h-[84px] w-[84px] items-center justify-center">
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
                      strokeWidth="6"
                      fill="none"
                      strokeDasharray={progressCircumference}
                      strokeLinecap="round"
                      rotation="-90"
                      origin="42, 42"
                      animatedProps={progressCircleAnimatedProps}
                    />
                  )}
                </Svg>
              </View>

              <Button
                variant={isRecording ? 'destructive' : 'default'}
                size="icon-2xl"
                className={cn(
                  'items-center justify-center overflow-hidden rounded-full'
                )}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={isVADLocked}
              >
                {isVADLocked ? (
                  <View className="flex-col items-center">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="mt-0.5 h-auto p-0"
                      onPress={() => {
                        console.log('🔓 Canceling VAD mode');
                        onVADLockChange?.(false);
                      }}
                    >
                      <Icon
                        as={X}
                        size={24}
                        className="text-primary-foreground"
                      />
                    </Button>
                  </View>
                ) : (
                  <Icon as={MicIcon} size={24} className="text-background" />
                )}
              </Button>
            </Animated.View>
          </View>
        </GestureDetector>
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

export default WalkieTalkieRecorder;
