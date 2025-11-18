/**
 * RecordingControls - Bottom bar with WalkieTalkie recorder and VAD settings
 *
 * - Waveform displayed above the controls
 * - Prevents re-renders from frequent currentEnergy updates
 * - Only re-renders when critical props change (isRecording, isVADLocked)
 */

import WalkieTalkieRecorder from '@/components/WalkieTalkieRecorder';
import { WaveformVisualization } from '@/components/WaveformVisualization';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useLocalization } from '@/hooks/useLocalization';
import { Audio } from 'expo-av';
import { MicOffIcon, Settings, Sparkles } from 'lucide-react-native';
import React, { useEffect, useRef } from 'react';
import { View, useWindowDimensions } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import Animated, {
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface RecordingControlsProps {
  isRecording: boolean;
  onRecordingStart: () => void;
  onRecordingStop: () => void;
  onRecordingComplete: (
    uri: string,
    duration: number,
    waveformData: number[]
  ) => void;
  onRecordingDiscarded?: () => void;
  onLayout?: (height: number) => void;
  // VAD props
  isVADLocked?: boolean;
  onVADLockChange?: (locked: boolean) => void;
  onSettingsPress?: () => void;
  onAutoCalibratePress?: () => void; // Callback to open settings drawer with auto-calibrate
  // VAD visual feedback (native module handles recording)
  currentEnergy?: number; // Keep for backward compat
  vadThreshold?: number;
  energyShared?: SharedValue<number>; // For UI performance
  isRecordingShared?: SharedValue<boolean>; // NEW: For instant waveform updates
  displayMode?: 'fullscreen' | 'footer'; // Display mode preference
}

export const RecordingControls = React.memo(
  function RecordingControls({
    isRecording,
    onRecordingStart,
    onRecordingStop,
    onRecordingComplete,
    onRecordingDiscarded,
    onLayout,
    isVADLocked,
    onVADLockChange,
    onSettingsPress,
    onAutoCalibratePress,
    currentEnergy,
    vadThreshold,
    energyShared,
    isRecordingShared,
    displayMode: _displayMode = 'footer'
  }: RecordingControlsProps) {
    const { t } = useLocalization();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();

    // Lazy permission check - start optimistic, check async to avoid blocking UI
    // null = checking, true = granted, false = denied
    const [hasPermission, setHasPermission] = React.useState<boolean | null>(
      null
    );
    // Track if this is the first time permission was granted (to show auto-calibrate prompt)
    const [showAutoCalibratePrompt, setShowAutoCalibratePrompt] =
      React.useState(false);
    const previousPermissionRef = React.useRef<boolean | null>(null);

    // Check permissions asynchronously after mount (non-blocking)
    useEffect(() => {
      let cancelled = false;

      const checkPermission = async () => {
        try {
          const permission = await Audio.getPermissionsAsync();
          if (!cancelled) {
            const wasGranted = permission.granted;
            setHasPermission(wasGranted);
            previousPermissionRef.current = wasGranted;
          }
        } catch (error) {
          console.error('Failed to check microphone permission:', error);
          if (!cancelled) {
            setHasPermission(false);
            previousPermissionRef.current = false;
          }
        }
      };

      void checkPermission();

      return () => {
        cancelled = true;
      };
    }, []);

    // Request permission handler
    const handleRequestPermission = async () => {
      try {
        const permission = await Audio.requestPermissionsAsync();
        const wasGranted = permission.granted;
        const wasPreviouslyDenied = previousPermissionRef.current === false;

        setHasPermission(wasGranted);

        // If permission was just granted for the first time (was denied before), show auto-calibrate prompt
        if (wasGranted && wasPreviouslyDenied) {
          setShowAutoCalibratePrompt(true);
        }

        previousPermissionRef.current = wasGranted;
      } catch (error) {
        console.error('Failed to request microphone permission:', error);
        setHasPermission(false);
        previousPermissionRef.current = false;
      }
    };

    // Handle auto-calibrate button press
    const handleAutoCalibratePress = () => {
      setShowAutoCalibratePrompt(false);
      onAutoCalibratePress?.();
    };

    // Shared value for activation progress bar - tracks button hold activation (0-1)
    const activationProgressShared = useSharedValue(0);

    // Track the displayed progress - slightly lags behind actual activation for smoother UX
    const displayProgressShared = useSharedValue(0);

    // Reset activation progress when recording stops
    // Note: displayProgressShared is reset in useAnimatedReaction to avoid React Compiler conflicts
    useEffect(() => {
      if (!isRecording) {
        activationProgressShared.value = 0;
      }
    }, [isRecording, activationProgressShared]);

    // Animate display progress to lag slightly behind activation progress
    // This makes the bar complete around the same time recording actually starts
    // Activation completes in 500ms, but recording takes ~50-100ms more to actually start
    // So we'll make display progress animate slightly slower (~550ms total)
    useAnimatedReaction(
      () => activationProgressShared.value,
      (currentProgress, previous) => {
        'worklet';
        if (!isRecording) {
          // Detect when activation starts (progress goes from 0 to >0)
          if (previous === 0 && currentProgress > 0) {
            // Start display animation - animate to 1 over 550ms (slightly longer than activation's 500ms)
            // This makes it complete around the same time recording actually starts
            displayProgressShared.value = withTiming(1, {
              duration: 550, // Slightly longer than activation (500ms) to sync with recording start
              easing: Easing.linear
            });
          } else if (currentProgress === 0) {
            // Reset immediately when activation is cancelled
            displayProgressShared.value = 0;
          }
        }
      },
      [isRecording]
    );

    // Animated style for progress bar - shows activation progress, hides when recording starts
    // Only shown during walkie-talkie mode (not during VAD lock)
    const progressBarStyle = useAnimatedStyle(() => {
      'worklet';
      // Hide progress bar entirely when VAD locked or when recording has started
      if (isVADLocked || isRecording) {
        return {
          width: 0,
          opacity: 0
        };
      }

      // Show activation progress (blue) during button hold
      const progress = displayProgressShared.value;
      const progressWidth = progress * width;

      return {
        width: progressWidth,
        opacity: progress > 0 ? 1 : 0,
        backgroundColor: '#3b82f6' // Blue during activation
      };
    }, [isRecording, isVADLocked, width]);

    // Fallback SharedValues for backward compatibility
    // Note: useSharedValue is already imported at the top, don't require it again
    const fallbackEnergyShared = useSharedValue(currentEnergy ?? 0);
    const fallbackIsRecordingShared = useSharedValue(isRecording);

    // SharedValue for walkie-talkie recording energy (separate from VAD energy)
    // This gets updated directly from WalkieTalkieRecorder's metering data
    const walkieTalkieEnergyShared = useSharedValue(0);

    // SharedValue for walkie-talkie recording state (ensures waveform bars are red during recording)
    const walkieTalkieIsRecordingShared = useSharedValue(false);

    // Update fallbacks if not provided (backward compat)
    useEffect(() => {
      if (!energyShared && currentEnergy !== undefined) {
        fallbackEnergyShared.value = currentEnergy;
      }
      if (!isRecordingShared) {
        fallbackIsRecordingShared.value = isRecording;
      }
    }, [
      currentEnergy,
      energyShared,
      fallbackEnergyShared,
      isRecording,
      isRecordingShared,
      fallbackIsRecordingShared
    ]);

    // Update walkie-talkie recording state SharedValue (for waveform bar color)
    // Only update when NOT in VAD mode
    useEffect(() => {
      if (!isVADLocked) {
        walkieTalkieIsRecordingShared.value = isRecording;
      }
    }, [isRecording, isVADLocked, walkieTalkieIsRecordingShared]);

    // Continuously tick walkie-talkie energy during recording to progress waveform
    // This ensures the waveform progresses even during silence - it's time-based, not just energy-based
    // The WaveformVisualization uses useAnimatedReaction which only fires when energyShared.value changes,
    // so we need to continuously update it during recording to keep the waveform shifting
    // We use a simple toggle mechanism: during silence, alternate between two tiny values to trigger updates
    const tickToggleRef = useRef<boolean>(false);

    useEffect(() => {
      if (!isRecording || isVADLocked) {
        // Reset when not recording
        walkieTalkieEnergyShared.value = 0;
        tickToggleRef.current = false;
        return;
      }

      // Update waveform at regular intervals (every ~50ms) to ensure continuous progression
      // The actual energy value from WalkieTalkieRecorder will naturally override this when audio is detected
      // During silence, we toggle between two tiny values to ensure the reaction fires continuously
      const interval = setInterval(() => {
        const currentEnergy = walkieTalkieEnergyShared.value;

        // Only tick during silence (low energy) - if there's real audio, the actual updates will drive progression
        // This prevents unnecessary updates when audio is actively being recorded
        if (currentEnergy <= 0.01) {
          // Toggle between two tiny values to trigger useAnimatedReaction
          // This ensures the waveform ring buffer shifts continuously even without audio
          tickToggleRef.current = !tickToggleRef.current;
          walkieTalkieEnergyShared.value = tickToggleRef.current ? 0.011 : 0.01;
        }
      }, 50); // Update every 50ms for smooth 20fps waveform progression

      return () => {
        clearInterval(interval);
      };
    }, [isRecording, isVADLocked, walkieTalkieEnergyShared]);

    // Show permission UI only if we explicitly know permission is denied (not while checking)
    // During check (hasPermission === null), show controls optimistically
    const showPermissionOverlay = hasPermission === false;
    // Show auto-calibrate prompt after first-time permission grant
    const showAutoCalibrateOverlay = showAutoCalibratePrompt && hasPermission === true;

    return (
      <>
        {/* Permission overlay - only shown when permission is explicitly denied */}
        {showPermissionOverlay && (
          <View
            className="absolute bottom-0 left-0 right-0 z-50 border-t border-border bg-background"
            style={{ paddingBottom: insets.bottom }}
            onLayout={(e) => onLayout?.(e.nativeEvent.layout.height)}
          >
            <View className="flex w-full items-center justify-center py-6">
              <View className="mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <Icon as={MicOffIcon} size={32} className="text-red-500" />
              </View>
              <Button
                variant="destructive"
                onPress={handleRequestPermission}
                className="w-48"
              >
                <Text className="text-base font-bold">
                  {t('grantMicrophonePermission')}
                </Text>
              </Button>
            </View>
          </View>
        )}

        {/* Auto-calibrate prompt - shown after first-time permission grant */}
        {showAutoCalibrateOverlay && (
          <View
            className="absolute bottom-0 left-0 right-0 z-50 border-t border-border bg-background"
            style={{ paddingBottom: insets.bottom }}
            onLayout={(e) => onLayout?.(e.nativeEvent.layout.height)}
          >
            <View className="flex w-full items-center justify-center gap-3 py-6">
              <View className="mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Icon as={Sparkles} size={32} className="text-primary" />
              </View>
              <Text className="text-center text-base font-semibold text-foreground">
                {t('calibrateMicrophone') || 'Calibrate your microphone'}
              </Text>
              <Text className="text-center text-sm text-muted-foreground px-8">
                {t('calibrateMicrophoneDescription') ||
                  'Let us automatically adjust the sensitivity for your environment'}
              </Text>
              <Button
                variant="default"
                onPress={handleAutoCalibratePress}
                className="w-48"
              >
                <Text className="text-base font-bold text-primary-foreground">
                  {t('autoCalibrate') || 'Auto-Calibrate'}
                </Text>
              </Button>
              <Button
                variant="ghost"
                onPress={() => setShowAutoCalibratePrompt(false)}
                className="w-48"
              >
                <Text className="text-sm text-muted-foreground">
                  {t('skip') || 'Skip'}
                </Text>
              </Button>
            </View>
          </View>
        )}
        <View
          className="absolute bottom-0 left-0 right-0 border-t border-border bg-background"
          style={{ paddingBottom: insets.bottom }}
          onLayout={(e) => onLayout?.(e.nativeEvent.layout.height)}
        >
          {/* Progress bar at the top - shows activation progress (blue, fills during hold), hides when recording starts */}
          <Animated.View
            style={[
              {
                height: 3,
                position: 'absolute',
                top: 0,
                left: 0
              },
              progressBarStyle
            ]}
          />

          {/* Waveform visualization above controls - visible during VAD lock or walkie-talkie recording */}
          <WaveformVisualization
            isVisible={(isVADLocked ?? false) || isRecording}
            energyShared={
              // Use VAD energy during VAD lock, walkie-talkie energy during walkie-talkie recording
              isVADLocked
                ? (energyShared ?? fallbackEnergyShared)
                : isRecording
                  ? walkieTalkieEnergyShared
                  : (energyShared ?? fallbackEnergyShared)
            }
            vadThreshold={vadThreshold ?? 0.085}
            isRecordingShared={
              // Use VAD recording state during VAD lock, walkie-talkie state during walkie-talkie recording
              isVADLocked
                ? (isRecordingShared ?? fallbackIsRecordingShared)
                : isRecording
                  ? walkieTalkieIsRecordingShared
                  : (isRecordingShared ?? fallbackIsRecordingShared)
            }
            barCount={60}
            maxHeight={24}
          />

          {/* Controls row */}
          <View className="flex-row items-center justify-between px-4 py-2">
            {/* Settings button on the left */}
            <Button
              variant="ghost"
              size="lg"
              onPress={onSettingsPress}
              className="h-20 w-20"
            >
              <Icon as={Settings} size={24} />
            </Button>

            {/* Recorder in center - takes remaining space */}
            <View className="flex-1 items-center">
              <WalkieTalkieRecorder
                onRecordingComplete={onRecordingComplete}
                onRecordingStart={onRecordingStart}
                onRecordingStop={onRecordingStop}
                onRecordingDiscarded={onRecordingDiscarded}
                onWaveformUpdate={undefined}
                isRecording={isRecording}
                isVADLocked={isVADLocked}
                onVADLockChange={onVADLockChange}
                // Energy values passed directly - ring buffer handles updates efficiently
                currentEnergy={currentEnergy}
                vadThreshold={vadThreshold}
                canRecord={hasPermission !== false} // Allow recording if granted or still checking
                activationProgressShared={activationProgressShared}
                energyShared={walkieTalkieEnergyShared}
                onRecordingDurationUpdate={(_duration) => {
                  // Duration tracking for other purposes if needed
                  // Progress bar uses activationProgressShared instead
                }}
              />
            </View>

            {/* Spacer to balance layout */}
            <View className="h-20 w-20" />
          </View>
        </View>
      </>
    );
  },
  // **OPTIMIZATION: Custom equality check - only re-render for critical prop changes**
  (prevProps, nextProps) => {
    // FIX: Allow immediate re-render when VAD lock changes for responsive cancel button
    if (prevProps.isVADLocked !== nextProps.isVADLocked) {
      return false; // Force re-render immediately on VAD lock change
    }

    // Re-render ONLY if these props change:
    // Note: We exclude recordingDuration from the equality check since it updates frequently
    // The progress bar uses a SharedValue that updates smoothly without causing re-renders
    return (
      prevProps.isRecording === nextProps.isRecording &&
      // isVADLocked already checked above
      prevProps.onRecordingStart === nextProps.onRecordingStart &&
      prevProps.onRecordingStop === nextProps.onRecordingStop &&
      prevProps.onRecordingComplete === nextProps.onRecordingComplete &&
      prevProps.onRecordingDiscarded === nextProps.onRecordingDiscarded &&
      prevProps.onVADLockChange === nextProps.onVADLockChange &&
      prevProps.onSettingsPress === nextProps.onSettingsPress
      // Still ignoring currentEnergy, vadThreshold, and recordingDuration changes to prevent cascade
    );
  }
);
