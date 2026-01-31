import { useAuth } from '@/contexts/AuthContext';
import { useHaptic } from '@/hooks/useHaptic';
import { cn } from '@/utils/styleUtils';
import { Audio } from 'expo-av';
import { MicIcon, Square } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import Animated, {
  Easing,
  cancelAnimation,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';
import { Icon } from './ui/icon';
import { Text } from './ui/text';

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
  isVADActive?: boolean;
  onVADActiveChange?: (active: boolean) => void;
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
  isVADActive = false,
  onVADActiveChange,
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
  const pressStartTimeRef = useRef<number | null>(null);

  // Track all recorded samples for final waveform data
  const [recordedSamples, setRecordedSamples] = useState<number[]>([]);

  // Reanimated shared values for smooth UI-thread animations
  // scaleAnim removed - no scale animations
  const pulseAnim = useSharedValue(1);
  // Use provided SharedValue or create local one (kept for potential future use)
  const internalActivationProgress = useSharedValue(0);
  const _activationProgress =
    activationProgressShared ?? internalActivationProgress;

  // Timers and state
  const activationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const releaseDelayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Constants
  const MIN_RECORDING_DURATION = 1000;
  const ACTIVATION_TIME = 200;
  const RELEASE_DELAY = 0;

  // Avoid React refs inside worklets: mutating `.current` after passing the ref
  // into a worklet triggers Reanimated's "Tried to modify key `current`..." warning.
  // Use SharedValues for any state that must be read from a worklet callback.
  const isRecordingShared = useSharedValue(isRecording);
  const isVADActiveShared = useSharedValue(isVADActive);
  const isVADActiveRef = useRef(isVADActive);

  // ============================================================================
  // RIPPLE ANIMATION STATE (Material Design-style radial wipe)
  // ============================================================================
  // Ripple expands from center of button, transitioning from white (50% opacity)
  // to red (100% opacity) over ACTIVATION_TIME duration
  // This creates a "wipe" effect that reveals the red recording state
  const { width: windowWidth } = useWindowDimensions();
  const rippleProgress = useSharedValue(0); // 0 to 1, maps to ACTIVATION_TIME
  const rippleOpacity = useSharedValue(0); // Controls white overlay opacity (fades out as red shows through)

  useEffect(() => {
    isVADActiveRef.current = isVADActive;
    isVADActiveShared.value = isVADActive;
    isRecordingShared.value = isRecording;
  }, [isVADActive, isRecording, isRecordingShared, isVADActiveShared]);


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
                if (finished2 && isRecordingShared.value) {
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
    // If VAD is active, allow tap to stop it
    if (isVADActive) {
      pressStartTimeRef.current = Date.now();
      isPressedRef.current = true; // Set pressed state so handlePressOut can process the stop
      return;
    }

    console.log('🎙️ Press in detected, starting activation timer...');

    // Record press start time for tap detection
    pressStartTimeRef.current = Date.now();

    void mediumHaptic();

    isPressedRef.current = true;
    isActivatingRef.current = true;

    // ============================================================================
    // START RIPPLE ANIMATION
    // ============================================================================
    // Initialize ripple: starts at center, 50% opacity white
    rippleProgress.value = 0;
    rippleOpacity.value = 0.5;

    // Animate ripple expanding from center over ACTIVATION_TIME
    // The ripple expands outward, revealing red underneath as white overlay fades
    rippleProgress.value = withTiming(1, {
      duration: ACTIVATION_TIME, // 200ms - matches activation time
      easing: Easing.linear,
    });

    // Fade white overlay to reveal red underneath
    // White starts at 50% opacity, fades to 0% as red shows through
    rippleOpacity.value = withTiming(0, {
      duration: ACTIVATION_TIME,
      easing: Easing.linear,
    });

    // ============================================================================
    // ACTIVATION TIMER
    // ============================================================================
    // Start recording after ACTIVATION_TIME completes
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

    void mediumHaptic();
    isPressedRef.current = false;

    const pressDuration = pressStartTimeRef.current
      ? Date.now() - pressStartTimeRef.current
      : Infinity;
    pressStartTimeRef.current = null;

    // If VAD is active, any tap stops VAD
    if (isVADActive) {
      console.log('👆 Tap detected - stopping VAD mode');
      void successHaptic();
      onVADActiveChange?.(false);
      
      // ============================================================================
      // RESET RIPPLE ANIMATION (VAD stopped)
      // ============================================================================
      rippleProgress.value = withTiming(0, { duration: 200 });
      rippleOpacity.value = withTiming(0, { duration: 200 });
      return;
    }

    // If released before activation completes, check if it was a tap
    if (isActivatingRef.current) {
      isActivatingRef.current = false;

      if (activationTimer.current) {
        clearTimeout(activationTimer.current);
        activationTimer.current = null;
      }

      // If press duration < ACTIVATION_TIME, it's a tap - start VAD
      // NOTE: Don't reset ripple animation here - let it complete since VAD is starting
      // The button will turn red (VAD active) and ripple animation completes naturally
      if (pressDuration < ACTIVATION_TIME) {
        console.log('👆 Tap detected - starting VAD mode');
        void successHaptic();
        onVADActiveChange?.(true);
      } else {
        // Edge case: released after ACTIVATION_TIME but before timer fired
        // Reset ripple since nothing is starting
        console.log('❌ Released before activation complete, canceling...');
        rippleProgress.value = withTiming(0, { duration: 150 });
        rippleOpacity.value = withTiming(0, { duration: 150 });
      }

      return;
    }

    // If recording was active, stop it
    if (isRecording) {
      console.log('🛑 Stopping recording immediately');
      void stopRecording();
    }

    // ============================================================================
    // RESET RIPPLE ANIMATION (recording stopped)
    // ============================================================================
    rippleProgress.value = withTiming(0, { duration: 200 });
    rippleOpacity.value = withTiming(0, { duration: 200 });
  };

  // ============================================================================
  // ANIMATED STYLES
  // ============================================================================

  const buttonAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    // Keep button static - no scale animations
    return {
      transform: [{ scale: 1 }]
    };
  });

  // ============================================================================
  // RIPPLE ANIMATION STYLE (GPU-accelerated with transform: scale)
  // ============================================================================
  // PERFORMANCE OPTIMIZATION:
  // - Uses transform: scale instead of width/height (GPU-accelerated)
  // - Uses interpolateColor (optimized color transitions)
  // - Fixed position/size - only scale and color animate
  // - Reduces animated properties from 6 to 2 (scale + backgroundColor)
  
  // Pre-calculate ripple size (only depends on window width, not animated)
  // The circle must be large enough to cover the button diagonal when scale=1
  const buttonWidth = windowWidth - 32; // Account for px-4 padding
  const buttonHeight = 80; // h-20 = 80px
  const maxRadius = Math.sqrt(
    Math.pow(buttonWidth / 2, 2) + Math.pow(buttonHeight / 2, 2)
  );
  const rippleDiameter = maxRadius * 2;

  const rippleStyle = useAnimatedStyle(() => {
    'worklet';
    const progress = rippleProgress.value;
    
    // Use interpolateColor for optimized color transition
    // White (50% opacity) -> Destructive red (100% opacity)
    // Note: interpolateColor handles opacity via alpha channel
    const backgroundColor = interpolateColor(
      progress,
      [0, 1],
      ['rgba(255, 255, 255, 0.5)', 'rgba(255, 84, 112, 1)']
    );
    
    return {
      // GPU-accelerated transform instead of width/height
      transform: [{ scale: progress }],
      backgroundColor,
    };
  });

  // Permission check is now handled by parent component
  if (!canRecord) {
    return null;
  }

  // Determine button background color class based on state
  const buttonBgClass = isVADActive || isRecording ? 'bg-destructive' : 'bg-primary';

  return (
    <View className="w-full">
      <AnimatedView style={buttonAnimatedStyle} className="w-full">
        {/* Custom button structure for proper ripple layering */}
        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          className={cn(
            'relative h-20 w-full items-center justify-center overflow-hidden rounded-[10px]',
            buttonBgClass
          )}
        >
          {/* ============================================================================
              RIPPLE OVERLAY (GPU-accelerated with transform: scale)
              ============================================================================
              Material Design-style radial wipe animation
              - Fixed size circle, scaled from 0 to 1 (GPU-accelerated)
              - Positioned at center, uses transform: scale for expansion
              - Color transitions from white (50%) to red (100%)
              - When scale=0, invisible; when scale=1, covers entire button
          */}
          <Animated.View
            style={[
              rippleStyle,
              {
                // Fixed position and size - only scale animates
                position: 'absolute',
                left: buttonWidth / 2 - rippleDiameter / 2,
                top: buttonHeight / 2 - rippleDiameter / 2,
                width: rippleDiameter,
                height: rippleDiameter,
                borderRadius: rippleDiameter / 2,
                pointerEvents: 'none',
              },
            ]}
          />

          {/* Button content - rendered after ripple so it appears on top */}
          {isVADActive ? (
            <View className="flex-row items-center gap-2">
              <Icon as={Square} size={24} className="text-primary-foreground" />
              <Text className="text-lg font-semibold text-primary-foreground">
                Stop Recording
              </Text>
            </View>
          ) : (
            <View className="flex-row items-center gap-2">
              <Icon as={MicIcon} size={24} className="text-background" />
              <Text className="text-lg font-semibold text-background">
                {isRecording ? 'Recording...' : 'Start Recording'}
              </Text>
            </View>
          )}
        </Pressable>
      </AnimatedView>
    </View>
  );
};

export default WalkieTalkieRecorder;
