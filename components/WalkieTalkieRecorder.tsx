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
}

/**
 * WaveformBar - Individual bar that displays energy at a specific position
 *
 * Uses a shared value that gets updated in a ring-buffer fashion.
 * Each bar only re-renders when its specific value changes.
 */
interface WaveformBarProps {
  barIndex: number;
  barValue: Animated.SharedValue<number>;
  isRecording: boolean;
  maxHeight: number;
}

const WaveformBar = React.memo(
  ({ barValue, isRecording, maxHeight }: WaveformBarProps) => {
    const barAnimatedStyle = useAnimatedStyle(() => {
      'worklet';
      // Smooth height transitions for less jitter
      const targetHeight = Math.max(2, barValue.value * maxHeight);

      return {
        height: withTiming(targetHeight, {
          duration: 30,
          easing: Easing.linear
        }),
        backgroundColor: isRecording ? colors.error : colors.primary
      };
    });

    return (
      <AnimatedView
        className="min-h-[2px] w-[3px] rounded-full"
        style={barAnimatedStyle}
      />
    );
  }
);

WaveformBar.displayName = 'WaveformBar';

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
  const [isActivating, setIsActivating] = useState(false);
  const [isSlideGestureActive, setIsSlideGestureActive] = useState(false);

  // **RING BUFFER CONFIG**
  const WAVEFORM_BAR_COUNT = 60; // Number of bars to display
  const WAVEFORM_MAX_HEIGHT = 24; // Max height in pixels

  // Track all recorded samples for final waveform data
  const [recordedSamples, setRecordedSamples] = useState<number[]>([]);

  // Reanimated shared values for smooth UI-thread animations
  const scaleAnim = useSharedValue(1);
  const pulseAnim = useSharedValue(1);
  const activationProgress = useSharedValue(0);
  const bgColorAnim = useSharedValue(0);
  const slideX = useSharedValue(0);
  const lockOpacity = useSharedValue(0.3);

  // **RING BUFFER: Array of shared values, one per bar**
  // Initialize all bars to 0.01 (minimal height)
  const waveformBars = useRef<Animated.SharedValue<number>[]>(
    Array.from({ length: WAVEFORM_BAR_COUNT }, () => useSharedValue(0.01))
  ).current;

  // Current energy as shared value for UI thread access
  const currentEnergyShared = useSharedValue(0);
  const vadThresholdShared = useSharedValue(vadThreshold);

  // Update shared values when props change
  useEffect(() => {
    currentEnergyShared.value = currentEnergy;
  }, [currentEnergy, currentEnergyShared]);

  useEffect(() => {
    vadThresholdShared.value = vadThreshold;
  }, [vadThreshold, vadThresholdShared]);

  /**
   * When energy updates, push to ring buffer
   * This bridges React state to UI thread worklet
   */
  useEffect(() => {
    if (!isVADLocked) return;

    // Normalize energy to 0-1 range
    const normalizedEnergy = Math.max(
      0.01,
      Math.min(1, currentEnergy / (vadThreshold * 3))
    );

    // Update on UI thread: Shift all values left (bar[0] ← bar[1], bar[1] ← bar[2], etc.)
    // This is efficient because each bar's shared value update happens independently
    for (let i = 0; i < WAVEFORM_BAR_COUNT - 1; i++) {
      waveformBars[i].value = waveformBars[i + 1].value;
    }

    // Add new value on the right
    waveformBars[WAVEFORM_BAR_COUNT - 1].value = normalizedEnergy;
  }, [currentEnergy, isVADLocked, vadThreshold, waveformBars]);

  // Reset waveform when VAD is unlocked
  useEffect(() => {
    if (!isVADLocked) {
      // Reset all bars to minimal height with smooth animation
      for (let i = 0; i < WAVEFORM_BAR_COUNT; i++) {
        waveformBars[i].value = withTiming(0.01, { duration: 200 });
      }
    }
  }, [isVADLocked, waveformBars]);

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

  // Background color animation
  useEffect(() => {
    bgColorAnim.value = withTiming(isRecording ? 1 : 0, {
      duration: 300
    });
  }, [isRecording, bgColorAnim]);

  const startRecording = async () => {
    try {
      const startTime = performance.now();
      console.log('🎙️ Starting recording process...');

      setRecordedSamples([]);
      console.log('🎤 Initializing recorder...');

      if (permissionResponse?.status !== Audio.PermissionStatus.GRANTED) {
        console.log('🔐 Requesting microphone permission...');
        const permissionResult = await requestPermission();
        if (permissionResult.status !== Audio.PermissionStatus.GRANTED) {
          console.log('❌ Permission denied');
          return;
        }
        console.log('✅ Permission granted');
      }

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
      activeRecording.setProgressUpdateInterval(11);

      const duration = performance.now() - startTime;
      console.log(`✅ Recording started in ${duration.toFixed(0)}ms`);

      setRecording(activeRecording);
      setRecordingDuration(0);
      onRecordingStart();

      activeRecording.setOnRecordingStatusUpdate((status) => {
        if (status.isRecording) {
          const duration = status.durationMillis || 0;
          setRecordingDuration(duration);

          const anyStatus = status as unknown as { metering?: number };
          if (typeof anyStatus.metering === 'number') {
            const db = anyStatus.metering;
            const normalizedDb = Math.max(-60, Math.min(0, db));
            const amplitude = Math.pow(10, normalizedDb / 20);
            appendLiveSample(amplitude);
          } else {
            const t = duration / 1000;
            const base = 0.3 + Math.sin(t * 24) * 0.15;
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
      const status = await recording.getStatusAsync().catch(() => null);
      if (!status) {
        console.warn('⚠️ Recording no longer exists, skipping stop');
        setRecording(null);
        onRecordingStop();
        return;
      }

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

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

    setIsPressed(true);
    setIsActivating(true);

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
      setIsActivating(false);
      void heavyHaptic();
      void startRecording();
    }, ACTIVATION_TIME);
  };

  const handlePressOut = () => {
    if (!isPressed) return;

    if (isSlideGestureActive) {
      console.log('🔒 Slide gesture was active - ignoring press out');
      setIsPressed(false);
      activationProgress.value = withTiming(0, { duration: 150 });
      scaleAnim.value = withSpring(1, {
        damping: 15,
        stiffness: 150
      });
      return;
    }

    void mediumHaptic();
    setIsPressed(false);

    if (isActivating) {
      console.log('❌ Released before activation complete, canceling...');
      setIsActivating(false);

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

  useEffect(() => {
    setCanRecord(permissionResponse?.status === Audio.PermissionStatus.GRANTED);
  }, [permissionResponse]);

  const progressCircumference = 2 * Math.PI * 38;

  // Animated styles
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

  // Waveform opacity animation
  const waveformOpacity = useSharedValue(0);

  useEffect(() => {
    waveformOpacity.value = withTiming(isVADLocked ? 1 : 0, {
      duration: 300
    });
  }, [isVADLocked, waveformOpacity]);

  const waveformAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: waveformOpacity.value
    };
  });

  // Create array indices for mapping (created once)
  const barIndices = Array.from({ length: WAVEFORM_BAR_COUNT }, (_, i) => i);

  return (
    <AnimatedView
      className="items-center rounded-3xl py-6"
      style={containerAnimatedStyle}
    >
      <View className="min-h-[100px] w-full flex-row-reverse items-center justify-center px-4">
        {/* **RING BUFFER WAVEFORM: Real energy values flowing left** */}
        {isVADLocked && (
          <AnimatedView
            className="absolute left-4 flex-row items-center gap-0.5"
            style={waveformAnimatedStyle}
          >
            <View className="h-6 flex-row items-center gap-0.5">
              {barIndices.map((i) => (
                <WaveformBar
                  key={i}
                  barIndex={i}
                  barValue={waveformBars[i]}
                  isRecording={isRecording}
                  maxHeight={WAVEFORM_MAX_HEIGHT}
                />
              ))}
            </View>
          </AnimatedView>
        )}

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
          <View className="relative h-[84px] w-[84px] items-center justify-center">
            <AnimatedView style={buttonAnimatedStyle}>
              {/* Circular progress indicator */}
              <View className="pointer-events-none absolute left-[38.5%] top-1/2 -ml-[42px] -mt-[42px] h-[84px] w-[84px] items-center justify-center">
                <Svg width="84" height="84" viewBox="0 0 84 84">
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
            </AnimatedView>
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
    </AnimatedView>
  );
};

export default WalkieTalkieRecorder;
