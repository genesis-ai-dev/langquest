import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useHaptic } from '@/hooks/useHaptic';
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
  withTiming,
  type SharedValue
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';
import { Icon } from './ui/icon';
import { Text } from './ui/text';

// Create animated SVG components
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedView = Animated.View;

interface WalkieTalkieRecorderProps {
  onRecordingComplete: (
    uri: string,
    duration: number,
    waveformData: number[]
  ) => void;
  onRecordingStart: () => void;
  onRecordingStop: () => void;
  onRecordingDiscarded?: () => void;
  onWaveformUpdate?: (waveformData: number[]) => void;
  isRecording: boolean;
  // VAD mode props (native module handles recording, this is just for UI)
  isVADLocked?: boolean;
  onVADLockChange?: (locked: boolean) => void;
  // VAD visual feedback
  currentEnergy?: number;
  vadThreshold?: number;
  // Permission state (handled by parent)
  canRecord?: boolean;
  // Callback to track recording duration for progress bar (updates frequently)
  onRecordingDurationUpdate?: (duration: number) => void;
  // Expose activation progress SharedValue for parent progress bar
  activationProgressShared?: SharedValue<number>;
  // SharedValue to update with live energy during recording (for waveform visualization)
  energyShared?: SharedValue<number>;
}

const WalkieTalkieRecorder: React.FC<WalkieTalkieRecorderProps> = ({
  onRecordingComplete,
  onRecordingStart,
  onRecordingStop,
  onRecordingDiscarded,
  onWaveformUpdate: _onWaveformUpdate,
  isRecording,
  isVADLocked = false,
  onVADLockChange,
  currentEnergy: _currentEnergy = 0,
  vadThreshold: _vadThreshold = 0.03,
  canRecord = true,
  onRecordingDurationUpdate,
  activationProgressShared,
  energyShared
}) => {
  const mediumHaptic = useHaptic('medium');
  const heavyHaptic = useHaptic('heavy');
  const successHaptic = useHaptic('success');
  const { currentUser: _currentUser } = useAuth();
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  // Permission check removed - handled by parent RecordingControls via canRecord prop
  const isPressedRef = useRef(false);
  const isActivatingRef = useRef(false);
  const [isSlideGestureActive, setIsSlideGestureActive] = useState(false);

  // Track all recorded samples for final waveform data
  const [recordedSamples, setRecordedSamples] = useState<number[]>([]);

  // Reanimated shared values for smooth UI-thread animations
  const scaleAnim = useSharedValue(1);
  const pulseAnim = useSharedValue(1);
  // Use provided SharedValue or create local one
  const internalActivationProgress = useSharedValue(0);
  const activationProgress =
    activationProgressShared ?? internalActivationProgress;
  const slideX = useSharedValue(0);
  const lockOpacity = useSharedValue(0.3);

  // Timers and state
  const activationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const releaseDelayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSliding, setIsSliding] = useState(false);

  // Constants
  const MIN_RECORDING_DURATION = 1000;
  const ACTIVATION_TIME = 500;
  const RELEASE_DELAY = 300;
  const SLIDE_THRESHOLD = 120;
  const LOCK_HAPTIC_THRESHOLD = 100;

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

    if (activationTimer.current) {
      clearTimeout(activationTimer.current);
      activationTimer.current = null;
    }
    isActivatingRef.current = false;
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

  // Pan gesture for slide-to-lock
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
      const dx = Math.max(0, Math.min(SLIDE_THRESHOLD, event.translationX));
      slideX.value = dx;

      if (dx > LOCK_HAPTIC_THRESHOLD && dx < LOCK_HAPTIC_THRESHOLD + 5) {
        scheduleOnRN(triggerHaptic);
      }
    })
    .onEnd((event) => {
      'worklet';
      const dx = event.translationX;

      if (dx >= SLIDE_THRESHOLD) {
        slideX.value = withSpring(SLIDE_THRESHOLD, {
          damping: 15,
          stiffness: 150
        });
        lockOpacity.value = withTiming(1, { duration: 200 });
        scheduleOnRN(handleSlideComplete);
      } else {
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
  }, [isVADLocked, slideX, lockOpacity]);

  // Append a live sample for recording playback
  const appendLiveSample = (amplitude01: number) => {
    const clampedAmplitude = Math.max(0.01, Math.min(1, amplitude01));
    setRecordedSamples((prev) => [...prev, clampedAmplitude]);
    // Update SharedValue for waveform visualization during walkie-talkie recording
    if (energyShared) {
      energyShared.value = clampedAmplitude;
    }
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
  }, [isRecording, pulseAnim]);

  // Background color animation removed - no longer needed

  const startRecording = async () => {
    try {
      // Small yield to let button animation render
      await new Promise((resolve) =>
        requestAnimationFrame(() => resolve(undefined))
      );

      const startTime = performance.now();
      console.log('🎙️ Starting recording process...');

      // ✅ CRITICAL: Clean up any existing recording first
      if (recording) {
        console.log('⚠️ Found existing recording, cleaning up first...');
        try {
          await recording.stopAndUnloadAsync();
        } catch (e) {
          console.log('⚠️ Error cleaning up existing recording:', e);
        }
        setRecording(null);
      }

      setRecordedSamples([]);
      console.log('🎤 Initializing recorder...');

      // Permission check removed - parent RecordingControls ensures canRecord=true
      // before this component is even rendered/interactive

      // Heavy operations - but user already sees feedback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true
      });

      console.log('🎤 Creating fresh recording...');
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
      activeRecording.setProgressUpdateInterval(9);

      const duration = performance.now() - startTime;
      console.log(`✅ Recording ready in ${duration.toFixed(0)}ms`);

      setRecording(activeRecording);
      setRecordingDuration(0);

      // Track energy range for logging
      const energyRange = { min: Infinity, max: -Infinity };

      // ✅ Notify parent AFTER recording is ready
      onRecordingStart();

      // Set up status monitoring
      activeRecording.setOnRecordingStatusUpdate((status) => {
        if (status.isRecording) {
          const duration = status.durationMillis || 0;
          setRecordingDuration(duration);
          // Notify parent of duration updates for progress bar
          onRecordingDurationUpdate?.(duration);

          const anyStatus = status as unknown as { metering?: number };
          let amplitude: number;
          if (typeof anyStatus.metering === 'number') {
            const db = anyStatus.metering;
            const normalizedDb = Math.max(-60, Math.min(0, db));
            amplitude = Math.pow(10, normalizedDb / 20);
            appendLiveSample(amplitude);
          } else {
            const t = duration / 1000;
            const base = 0.3 + Math.sin(t * 24) * 0.15;
            const noise = (Math.random() - 0.5) * 0.1;
            amplitude = Math.max(0.02, Math.min(0.8, base + noise));
            appendLiveSample(amplitude);
          }

          // Track energy range
          energyRange.min = Math.min(energyRange.min, amplitude);
          energyRange.max = Math.max(energyRange.max, amplitude);
        }
      });

      // Store energy range ref for logging on stop
      (activeRecording as any)._energyRange = energyRange;
      console.log('🎙️ Recording started successfully!');
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      onRecordingStop(); // Clean up
    }
  };

  const stopRecording = async () => {
    if (!recording) {
      console.warn('⚠️ stopRecording called but no active recording');
      return;
    }

    try {
      const status = await recording.getStatusAsync().catch(() => null);
      if (!status) {
        console.warn('⚠️ Recording no longer exists, skipping stop');
        setRecording(null);
        onRecordingStop();
        return;
      }

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      // Log energy range for hold-to-record
      const energyRange = (recording as any)._energyRange;
      if (energyRange && energyRange.min !== Infinity) {
        console.log(
          `📊 Hold-to-Record Energy Range | min: ${energyRange.min.toFixed(4)}, max: ${energyRange.max.toFixed(4)}, range: ${(energyRange.max - energyRange.min).toFixed(4)}`
        );
      }

      if (uri) {
        if (recordingDuration >= MIN_RECORDING_DURATION) {
          const waveformData = [...recordedSamples];
          onRecordingComplete(uri, recordingDuration, waveformData);
        } else {
          console.log(
            `⏭️ Recording too short (${recordingDuration}ms), discarding`
          );
          onRecordingDiscarded?.();
        }
      }

      setRecording(null);
      setRecordingDuration(0);
      setRecordedSamples([]);

      onRecordingStop();
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setRecording(null);
      setRecordingDuration(0);
      setRecordedSamples([]);
      onRecordingStop();
    }
  };

  const handlePressIn = () => {
    if (isVADLocked) {
      console.log('🔒 VAD mode is locked - manual recording disabled');
      return;
    }

    if (isSlideGestureActive) {
      console.log('🔒 Slide gesture active - ignoring press');
      return;
    }

    console.log('🎙️ Press in detected, starting activation timer...');

    void mediumHaptic();

    isPressedRef.current = true;
    isActivatingRef.current = true;

    scaleAnim.value = withSpring(0.9, {
      damping: 15,
      stiffness: 150
    });

    activationProgress.value = withTiming(1, {
      duration: ACTIVATION_TIME,
      easing: Easing.linear
    });

    activationTimer.current = setTimeout(() => {
      console.log('✅ Activation complete, starting recording...');
      isActivatingRef.current = false;
      void heavyHaptic();

      requestAnimationFrame(() => {
        void startRecording();
      });
    }, ACTIVATION_TIME);
  };

  const handlePressOut = () => {
    if (!isPressedRef.current) return;

    if (isSlideGestureActive) {
      console.log('🔒 Slide gesture was active - ignoring press out');
      isPressedRef.current = false;
      activationProgress.value = withTiming(0, { duration: 150 });
      scaleAnim.value = withSpring(1, {
        damping: 15,
        stiffness: 150
      });
      return;
    }

    void mediumHaptic();
    isPressedRef.current = false;

    if (isActivatingRef.current) {
      console.log('❌ Released before activation complete, canceling...');
      isActivatingRef.current = false;

      if (activationTimer.current) {
        clearTimeout(activationTimer.current);
        activationTimer.current = null;
      }

      activationProgress.value = withTiming(0, { duration: 150 });
      scaleAnim.value = withSpring(1, {
        damping: 15,
        stiffness: 150
      });
      return;
    }

    if (isRecording) {
      console.log(
        `⏳ Release detected, will stop recording in ${RELEASE_DELAY}ms to capture audio tail`
      );

      if (releaseDelayTimer.current) {
        clearTimeout(releaseDelayTimer.current);
      }

      releaseDelayTimer.current = setTimeout(() => {
        console.log('🛑 Stopping recording after delay');
        void stopRecording();
        releaseDelayTimer.current = null;
      }, RELEASE_DELAY);
    }

    activationProgress.value = withTiming(0, { duration: 150 });
    scaleAnim.value = withSpring(1, {
      damping: 15,
      stiffness: 150
    });
  };

  const progressCircumference = 2 * Math.PI * 28;

  // Animated styles (background animation removed)

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

  // Permission check is now handled by parent component
  if (!canRecord) {
    return null;
  }

  return (
    <View className="items-center rounded-3xl py-4">
      <View className="min-h-[80px] w-full flex-row-reverse items-center justify-center px-4">
        {/* Lock indicator */}
        {!isVADLocked ? (
          <AnimatedView
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
          </AnimatedView>
        ) : (
          <></>
        )}

        {/* Button with gesture detector */}
        <GestureDetector gesture={panGesture}>
          <View className="relative h-[64px] w-[64px] items-center justify-center">
            <AnimatedView style={buttonAnimatedStyle}>
              {/* Circular progress indicator */}
              <View className="pointer-events-none absolute left-[38.5%] top-1/2 -ml-[32px] -mt-[32px] h-[64px] w-[64px] items-center justify-center">
                <Svg width="64" height="64" viewBox="0 0 64 64">
                  {(isActivatingRef.current || isRecording) && (
                    <Circle
                      cx="32"
                      cy="32"
                      r="28"
                      stroke={isRecording ? '#fca5a5' : '#e5e7eb'}
                      strokeWidth="5"
                      fill="none"
                      opacity={0.3}
                    />
                  )}
                  {(isActivatingRef.current || isRecording) && (
                    <AnimatedCircle
                      cx="32"
                      cy="32"
                      r="28"
                      strokeWidth="5"
                      fill="none"
                      strokeDasharray={progressCircumference}
                      strokeLinecap="round"
                      rotation="-90"
                      origin="32, 32"
                      animatedProps={progressCircleAnimatedProps}
                    />
                  )}
                </Svg>
              </View>
              <Button
                variant={isRecording ? 'destructive' : 'default'}
                size="icon-lg"
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
                        console.log(
                          '🔓 Canceling VAD mode - immediate response'
                        );
                        // Trigger haptic feedback for instant tactile response
                        void mediumHaptic();
                        // Call immediately without any delay for instant UI response
                        onVADLockChange?.(false);
                      }}
                    >
                      <Icon
                        as={X}
                        size={32}
                        className="text-primary-foreground"
                      />
                    </Button>
                  </View>
                ) : (
                  <Icon as={MicIcon} size={24} className="text-background" />
                )}
              </Button>
            </AnimatedView>
          </View>
        </GestureDetector>
      </View>
    </View>
  );
};

export default WalkieTalkieRecorder;
