import { useAuth } from '@/contexts/AuthContext';
import { useHaptic } from '@/hooks/useHaptic';
import { useLocalization } from '@/hooks/useLocalization';
import { cn } from '@/utils/styleUtils';
import {
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState
} from 'expo-audio';
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

/**
 * NOTE: This component intentionally mutates Reanimated SharedValues throughout.
 * React Compiler warnings about SharedValue mutations are false positives.
 * SharedValues are designed to be mutated - this is their intended usage pattern.
 * These mutations do not cause re-renders and are safe.
 */

const AnimatedView = Animated.View;

// Energy range tracking for a recording session
interface EnergyRange {
  min: number;
  max: number;
}

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
  // Single short haptic for all feedback
  const haptic = useHaptic('medium');
  const { currentUser: _currentUser } = useAuth();
  const { t } = useLocalization();
  const [hasActiveRecording, setHasActiveRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  // Permission check removed - handled by parent RecordingControls via canRecord prop
  const isActivatingRef = useRef(false);
  const pressStartTimeRef = useRef<number | null>(null);
  // Track when startRecording() has been called but isRecording prop hasn't updated yet
  const isPendingStartRef = useRef(false);
  // Cancellation flag - set when user releases during async setup
  const shouldCancelRecordingRef = useRef(false);

  // Energy range tracking for logging
  const energyRangeRef = useRef<EnergyRange>({ min: Infinity, max: -Infinity });

  // Audio recorder from expo-audio (manages lifecycle automatically)
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // Poll recording state for duration and metering data
  const recorderState = useAudioRecorderState(recorder, 50);

  // Previous duration ref to avoid duplicate processing
  const lastProcessedDurationRef = useRef(0);

  // React to recorder state changes for duration tracking and metering
  useEffect(() => {
    if (!recorderState.isRecording) return;

    const duration = recorderState.durationMillis || 0;

    // Skip if we already processed this duration (avoid duplicate work)
    if (duration === lastProcessedDurationRef.current) return;
    lastProcessedDurationRef.current = duration;

    setRecordingDuration(duration);
    // Notify parent of duration updates for progress bar
    onRecordingDurationUpdate?.(duration);

    let amplitude: number;
    if (typeof recorderState.metering === 'number') {
      const db = recorderState.metering;
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
    energyRangeRef.current.min = Math.min(
      energyRangeRef.current.min,
      amplitude
    );
    energyRangeRef.current.max = Math.max(
      energyRangeRef.current.max,
      amplitude
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorderState]);

  // ============================================================================
  // BUSY LOCK - Prevents race conditions during state transitions
  // ============================================================================
  // When true, ignores new press events to prevent conflicting actions
  const isBusyRef = useRef(false);

  // Track all recorded samples for final waveform data without re-renders
  const recordedSamplesRef = useRef<number[]>([]);

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
  const MIN_RECORDING_DURATION = 500;
  const ACTIVATION_TIME = 200;
  const RELEASE_DELAY = 200;

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

    // Clear pending start flag when recording actually starts
    if (isRecording) {
      isPendingStartRef.current = false;
    }
  }, [isVADActive, isRecording, isRecordingShared, isVADActiveShared]);

  // ============================================================================
  // RIPPLE SYNC EFFECT - Ensures ripple matches actual state
  // ============================================================================
  // This is a safety net: if state changes externally (or due to race conditions),
  // this effect ensures the ripple animation matches the actual recording/VAD state
  useEffect(() => {
    const shouldBeActive = isVADActive || isRecording;

    if (shouldBeActive) {
      // If we should be active but ripple is not at 1, snap it to 1
      // (This handles cases where state changed before animation completed)
      if (rippleProgress.value < 0.9) {
        rippleProgress.value = withTiming(1, { duration: 100 });
        rippleOpacity.value = withTiming(0, { duration: 100 });
      }
    } else {
      // If we should be inactive but ripple is not at 0, reset it
      // (This is the main sync: ensures ripple resets when recording/VAD stops)
      if (rippleProgress.value > 0.1) {
        cancelAnimation(rippleProgress);
        cancelAnimation(rippleOpacity);
        rippleProgress.value = withTiming(0, { duration: 200 });
        rippleOpacity.value = withTiming(0, { duration: 200 });
      }

      // Also clear busy state when becoming inactive
      isBusyRef.current = false;
    }
  }, [isVADActive, isRecording, rippleProgress, rippleOpacity]);

  // Append a live sample for recording playback
  const appendLiveSample = (amplitude01: number) => {
    const clampedAmplitude = Math.max(0.01, Math.min(1, amplitude01));
    recordedSamplesRef.current.push(clampedAmplitude);
    // Update SharedValue for waveform visualization during walkie-talkie recording
    // Note: SharedValues are designed to be mutated - this is intentional and correct
    if (energyShared) {
      // React Compiler warning here is a false positive - SharedValues are meant to be mutated
      energyShared.value = clampedAmplitude;
    }
  };

  // Cleanup timers on unmount (recorder cleanup handled by useAudioRecorder hook)
  useEffect(() => {
    return () => {
      if (activationTimer.current) {
        clearTimeout(activationTimer.current);
      }
      if (releaseDelayTimer.current) {
        clearTimeout(releaseDelayTimer.current);
      }
      // Recorder cleanup is handled automatically by useAudioRecorder hook
    };
  }, []);

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

      recordedSamplesRef.current = [];

      // Permission check removed - parent RecordingControls ensures canRecord=true
      // before this component is even rendered/interactive

      // Reset cancellation flag at start
      shouldCancelRecordingRef.current = false;

      // Notify parent IMMEDIATELY - we're in "recording mode" now
      // This ensures isRecording is true synchronously, preventing race conditions
      // where user releases before async setup completes
      onRecordingStart();

      // Heavy operations - but user already sees feedback
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true
      });

      // Prepare and start recording with metering-enabled options
      const highQuality = RecordingPresets.HIGH_QUALITY;
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
      };

      await recorder.prepareToRecordAsync(options);

      // Check if we were cancelled during async setup (user released early)
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (shouldCancelRecordingRef.current) {
        shouldCancelRecordingRef.current = false;
        return;
      }

      recorder.record();

      setHasActiveRecording(true);
      setRecordingDuration(0);

      // Reset energy range for this recording
      energyRangeRef.current = { min: Infinity, max: -Infinity };
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      onRecordingStop(); // Clean up
    }
  };

  const stopRecording = async () => {
    if (!hasActiveRecording) {
      // Recording not started yet (user released during async setup)
      // Set cancellation flag so startRecording() knows to abort
      shouldCancelRecordingRef.current = true;
      onRecordingStop();
      return;
    }

    try {
      await recorder.stop();
      const uri = recorder.uri;

      if (uri) {
        if (recordingDuration >= MIN_RECORDING_DURATION) {
          const waveformData = [...recordedSamplesRef.current];
          onRecordingComplete(uri, recordingDuration, waveformData);
        } else {
          onRecordingDiscarded?.();
        }
      }

      setHasActiveRecording(false);
      setRecordingDuration(0);
      recordedSamplesRef.current = [];

      onRecordingStop();
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setHasActiveRecording(false);
      setRecordingDuration(0);
      recordedSamplesRef.current = [];
      onRecordingStop();
    }
  };

  // ============================================================================
  // CLEANUP HELPER - Resets all interaction state
  // ============================================================================
  const cleanupInteractionState = () => {
    // Clear any pending timers
    if (activationTimer.current) {
      clearTimeout(activationTimer.current);
      activationTimer.current = null;
    }
    if (releaseDelayTimer.current) {
      clearTimeout(releaseDelayTimer.current);
      releaseDelayTimer.current = null;
    }

    // Reset refs
    isActivatingRef.current = false;
    pressStartTimeRef.current = null;
    isPendingStartRef.current = false;
  };

  const handlePressIn = () => {
    // ============================================================================
    // GUARD: Prevent interactions during busy state or active recording
    // ============================================================================
    if (isBusyRef.current) {
      return;
    }

    // If release delay timer is active (user just released), cancel it to keep recording
    if (releaseDelayTimer.current) {
      clearTimeout(releaseDelayTimer.current);
      releaseDelayTimer.current = null;
      return; // Don't start new activation, just cancel the stop
    }

    // If already recording (push-to-talk), ignore new presses
    if (isRecording && !isVADActive) {
      return;
    }

    // If VAD is active, allow tap to stop it
    if (isVADActive) {
      pressStartTimeRef.current = Date.now();
      return;
    }

    // ============================================================================
    // CLEANUP: Cancel any existing activation in progress
    // ============================================================================
    if (isActivatingRef.current) {
      cleanupInteractionState();
      // Cancel existing ripple animation
      // Note: SharedValues are designed to be mutated - these mutations are intentional
      cancelAnimation(rippleProgress);
      cancelAnimation(rippleOpacity);
      rippleProgress.value = 0;
      rippleOpacity.value = 0;
    }

    // Record press start time for tap detection
    pressStartTimeRef.current = Date.now();

    // Haptic feedback when first touched
    void haptic();

    isActivatingRef.current = true;

    // ============================================================================
    // START RIPPLE ANIMATION (runs on UI thread via Reanimated)
    // ============================================================================
    // This animation is purely visual and decoupled from recording logic.
    // Cancel any existing animation first
    cancelAnimation(rippleProgress);
    cancelAnimation(rippleOpacity);

    // Initialize ripple: starts at center, 50% opacity white
    rippleProgress.value = 0;
    rippleOpacity.value = 0.5;

    // Animate ripple expanding from center over ACTIVATION_TIME
    rippleProgress.value = withTiming(1, {
      duration: ACTIVATION_TIME,
      easing: Easing.linear
    });

    // Fade white overlay to reveal red underneath
    rippleOpacity.value = withTiming(0, {
      duration: ACTIVATION_TIME,
      easing: Easing.linear
    });

    // ============================================================================
    // ACTIVATION TIMER
    // ============================================================================
    activationTimer.current = setTimeout(() => {
      // Double-check we're still in activating state (prevents stale timer execution)
      if (!isActivatingRef.current) {
        return;
      }

      isActivatingRef.current = false;

      // Mark that we're pending start - this bridges the gap between
      // calling startRecording() and isRecording prop becoming true
      isPendingStartRef.current = true;

      void startRecording();
    }, ACTIVATION_TIME);
  };

  const handlePressOut = () => {
    const pressDuration = pressStartTimeRef.current
      ? Date.now() - pressStartTimeRef.current
      : Infinity;
    pressStartTimeRef.current = null;

    // If VAD is active, any tap stops VAD
    if (isVADActive) {
      // Haptic feedback when VAD stops
      void haptic();

      // Set busy to prevent rapid re-activation
      isBusyRef.current = true;
      setTimeout(() => {
        isBusyRef.current = false;
      }, 300); // Brief lock after stopping VAD

      onVADActiveChange?.(false);

      // ============================================================================
      // RESET RIPPLE ANIMATION (VAD stopped)
      // ============================================================================
      // Note: SharedValues are designed to be mutated - these mutations are intentional
      cancelAnimation(rippleProgress);
      cancelAnimation(rippleOpacity);
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
      if (pressDuration < ACTIVATION_TIME) {
        onVADActiveChange?.(true);
      } else {
        // Edge case: released after ACTIVATION_TIME but before timer fired
        // Reset ripple since nothing is starting
        // Note: SharedValues are designed to be mutated - these mutations are intentional
        cancelAnimation(rippleProgress);
        cancelAnimation(rippleOpacity);
        rippleProgress.value = withTiming(0, { duration: 150 });
        rippleOpacity.value = withTiming(0, { duration: 150 });
      }

      return;
    }

    // If recording was active OR pending start, stop it with delay
    // isPendingStartRef handles the race condition where user releases after
    // activation timer fired but before isRecording prop updated
    if (isRecording || isPendingStartRef.current) {
      // Haptic feedback when hold-to-record stops
      void haptic();
      isPendingStartRef.current = false;

      // Clear any existing release delay timer
      if (releaseDelayTimer.current) {
        clearTimeout(releaseDelayTimer.current);
        releaseDelayTimer.current = null;
      }

      // Delay stopping recording by RELEASE_DELAY
      releaseDelayTimer.current = setTimeout(() => {
        releaseDelayTimer.current = null;
        void stopRecording();

        // Reset ripple animation after stopping
        cancelAnimation(rippleProgress);
        cancelAnimation(rippleOpacity);
        rippleProgress.value = withTiming(0, { duration: 200 });
        rippleOpacity.value = withTiming(0, { duration: 200 });
      }, RELEASE_DELAY);

      return; // Don't reset ripple immediately - wait for delay
    }

    // ============================================================================
    // RESET RIPPLE ANIMATION (for non-recording cases)
    // ============================================================================
    cancelAnimation(rippleProgress);
    cancelAnimation(rippleOpacity);
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
      backgroundColor
    };
  });

  // Permission check is now handled by parent component
  if (!canRecord) {
    return null;
  }

  // Determine button background color class based on state
  const buttonBgClass =
    isVADActive || isRecording ? 'bg-destructive' : 'bg-primary';

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
                pointerEvents: 'none'
              }
            ]}
          />

          {/* Button content - rendered after ripple so it appears on top */}
          {isVADActive ? (
            <View className="flex-row items-center gap-2">
              <Icon as={Square} size={24} className="text-primary-foreground" />
              <Text className="text-lg font-semibold text-primary-foreground">
                {t('stopRecording')}
              </Text>
            </View>
          ) : (
            <View className="flex-row items-center gap-2">
              <Icon as={MicIcon} size={24} className="text-background" />
              <Text className="text-lg font-semibold text-background">
                {isRecording ? `${t('recording')}...` : t('startRecording')}
              </Text>
            </View>
          )}
        </Pressable>
      </AnimatedView>
    </View>
  );
};

export default WalkieTalkieRecorder;
