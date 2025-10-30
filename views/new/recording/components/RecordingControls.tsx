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
import { MicOffIcon, Settings } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
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
    currentEnergy,
    vadThreshold,
    energyShared,
    isRecordingShared,
    displayMode = 'footer'
  }: RecordingControlsProps) {
    const { t } = useLocalization();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    // Permissions are handled by native module
    const hasPermission = true;

    // Shared value for activation progress bar - tracks button hold activation (0-1)
    const activationProgressShared = useSharedValue(0);
    
    // Track the displayed progress - slightly lags behind actual activation for smoother UX
    const displayProgressShared = useSharedValue(0);

    // Reset progress bar when recording stops
    useEffect(() => {
      if (!isRecording) {
        activationProgressShared.value = 0;
        displayProgressShared.value = 0;
      }
    }, [isRecording, activationProgressShared, displayProgressShared]);

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

    // Animated style for progress bar - shows activation progress and turns red when recording
    const progressBarStyle = useAnimatedStyle(() => {
      'worklet';
      // When recording, show full width (red). Otherwise use display progress (blue, slightly lagging)
      const progress = isRecording ? 1 : displayProgressShared.value;
      const progressWidth = progress * width;
      
      return {
        width: progressWidth,
        opacity: progress > 0 || isRecording ? 1 : 0,
        backgroundColor: isRecording ? '#ef4444' : '#3b82f6' // Red when recording, blue during activation
      };
    }, [isRecording, width]);

    const requestPermission = async () => {
      // Native module handles permissions
    };

    // Fallback SharedValues for backward compatibility
    // Note: useSharedValue is already imported at the top, don't require it again
    const fallbackEnergyShared = useSharedValue(currentEnergy ?? 0);
    const fallbackIsRecordingShared = useSharedValue(isRecording);

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

    // Show permission UI only if we explicitly know permission is denied
    if (!hasPermission) {
      return (
        <View
          className="absolute bottom-0 left-0 right-0 border-t border-border bg-background"
          style={{ paddingBottom: insets.bottom }}
          onLayout={(e) => onLayout?.(e.nativeEvent.layout.height)}
        >
          <View className="flex w-full items-center justify-center py-6">
            <View className="mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <Icon as={MicOffIcon} size={32} className="text-red-500" />
            </View>
            <Button
              variant="destructive"
              onPress={requestPermission}
              className="w-48"
            >
              <Text className="text-base font-bold">
                {t('grantMicrophonePermission')}
              </Text>
            </Button>
          </View>
        </View>
      );
    }

    return (
      <View
        className="absolute bottom-0 left-0 right-0 border-t border-border bg-background"
        style={{ paddingBottom: insets.bottom }}
        onLayout={(e) => onLayout?.(e.nativeEvent.layout.height)}
      >
        {/* Progress bar at the top - shows activation progress (fills during hold), turns red when recording */}
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

        {/* Waveform visualization above controls - only visible in footer mode */}
        <WaveformVisualization
          isVisible={isVADLocked ?? false}
          energyShared={energyShared ?? fallbackEnergyShared}
          vadThreshold={vadThreshold ?? 0.085}
          isRecordingShared={isRecordingShared ?? fallbackIsRecordingShared}
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
              canRecord={hasPermission}
              activationProgressShared={activationProgressShared}
              onRecordingDurationUpdate={(duration) => {
                // Duration tracking for other purposes if needed
                // Progress bar uses activationProgressShared instead
              }}
            />
          </View>

          {/* Spacer to balance layout */}
          <View className="h-20 w-20" />
        </View>
      </View>
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
