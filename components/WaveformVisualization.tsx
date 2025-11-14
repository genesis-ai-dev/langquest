/**
 * WaveformVisualization - Ring buffer waveform display
 *
 * Shows real-time microphone energy as a scrolling waveform.
 * Red bars = captured during recording, Blue bars = monitoring only
 */

import { colors } from '@/styles/theme';
import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import Animated, {
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';

const AnimatedView = Animated.View;

interface WaveformBarProps {
  barIndex: number;
  barValue: SharedValue<number>;
  barWasRecorded: SharedValue<boolean>;
  maxHeight: number;
}

const WaveformBar = React.memo(
  ({ barValue, barWasRecorded, maxHeight }: WaveformBarProps) => {
    const barAnimatedStyle = useAnimatedStyle(() => {
      'worklet';
      const targetHeight = Math.max(2, barValue.value * maxHeight);

      return {
        height: withTiming(targetHeight, {
          duration: 20,
          easing: Easing.linear
        }),
        backgroundColor: barWasRecorded.value ? colors.error : colors.primary
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

interface WaveformVisualizationProps {
  isVisible: boolean;
  energyShared: SharedValue<number>; // OPTIMIZED: SharedValue instead of number
  vadThreshold: number;
  isRecordingShared: SharedValue<boolean>; // OPTIMIZED: SharedValue for instant updates
  barCount?: number;
  maxHeight?: number;
}

export const WaveformVisualization: React.FC<WaveformVisualizationProps> = ({
  isVisible,
  energyShared,
  vadThreshold,
  isRecordingShared, // Now a SharedValue - NO SYNC NEEDED!
  barCount = 60,
  maxHeight = 24
}) => {
  // Ring buffer arrays
  const waveformBars = useRef<SharedValue<number>[]>(
    Array.from({ length: barCount }, () => useSharedValue(0.01))
  ).current;

  const waveformRecordingState = useRef<SharedValue<boolean>[]>(
    Array.from({ length: barCount }, () => useSharedValue(false))
  ).current;

  // Opacity animation
  const waveformOpacity = useSharedValue(0);

  useEffect(() => {
    waveformOpacity.value = withTiming(isVisible ? 1 : 0, {
      duration: 300
    });
  }, [isVisible, waveformOpacity]);

  const waveformAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: waveformOpacity.value
    };
  });

  // OPTIMIZED: Update ring buffer using worklet (runs on UI thread!)
  // This eliminates JS thread blocking from shifting 60 bars on every energy update
  useAnimatedReaction(
    () => energyShared.value,
    (currentEnergy) => {
      'worklet';
      if (!isVisible) return;

      // Normalize energy: Swift/Android send raw RMS energy (0-1 range typically)
      // But values can be higher, so normalize similar to VADSettingsDrawer
      // Using MAX_ENERGY = 20.0 to match VADSettingsDrawer normalization
      const MAX_ENERGY = 20.0;
      const normalizedRaw = Math.min(1.0, Math.max(0, currentEnergy / MAX_ENERGY));
      
      // Scale relative to threshold for visualization
      // Threshold is already normalized (0-1), so we compare normalized values
      const normalizedEnergy = Math.max(
        0.01,
        Math.min(1, normalizedRaw / Math.max(vadThreshold * 3, 0.01))
      );

      // Shift all values left (runs on UI thread - no JS bridge!)
      for (let i = 0; i < barCount - 1; i++) {
        waveformBars[i]!.value = waveformBars[i + 1]!.value;
        waveformRecordingState[i]!.value = waveformRecordingState[i + 1]!.value;
      }

      // Add new value on the right with current recording state (from SharedValue!)
      waveformBars[barCount - 1]!.value = normalizedEnergy;
      waveformRecordingState[barCount - 1]!.value = isRecordingShared.value;
    },
    [isVisible, vadThreshold, barCount]
    // isRecording removed from deps - we use SharedValue now which updates without recreation
  );

  // TEMPORARILY DISABLED: React to recording state changes to update recent bars
  // DISABLED FOR TESTING: This reaction might be causing issues if it fires too frequently
  // The main reaction already sets the last bar's recording state on line 117,
  // so this retroactive update might be redundant and could cause conflicts.
  // TODO: Re-enable and optimize if needed, or remove if not necessary
  /*
  useAnimatedReaction(
    () => isRecordingShared.value,
    (isRecording, previousIsRecording) => {
      'worklet';
      if (!isVisible || previousIsRecording === isRecording) return;

      // Update the most recent 5 bars to match the new recording state
      // This ensures smooth color transitions when recording state changes
      const barsToUpdate = Math.min(5, barCount);
      for (let i = barCount - barsToUpdate; i < barCount; i++) {
        waveformRecordingState[i]!.value = isRecording;
      }
    },
    [isVisible, barCount]
  );
  */

  // Reset when hidden
  useEffect(() => {
    if (!isVisible) {
      for (let i = 0; i < barCount; i++) {
        waveformBars[i]!.value = withTiming(0.01, { duration: 200 });
        waveformRecordingState[i]!.value = false;
      }
    }
  }, [isVisible, barCount, waveformBars, waveformRecordingState]);

  const barIndices = Array.from({ length: barCount }, (_, i) => i);

  return (
    <AnimatedView
      className="flex-row items-center justify-center gap-0.5 px-4"
      style={waveformAnimatedStyle}
    >
      <View className="h-6 flex-row items-center gap-0.5">
        {barIndices.map((i) => (
          <WaveformBar
            key={i}
            barIndex={i}
            barValue={waveformBars[i]!}
            barWasRecorded={waveformRecordingState[i]!}
            maxHeight={maxHeight}
          />
        ))}
      </View>
    </AnimatedView>
  );
};
