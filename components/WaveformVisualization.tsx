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
          duration: 30,
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
  currentEnergy: number;
  vadThreshold: number;
  isRecording: boolean;
  barCount?: number;
  maxHeight?: number;
}

export const WaveformVisualization: React.FC<WaveformVisualizationProps> = ({
  isVisible,
  currentEnergy,
  vadThreshold,
  isRecording,
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

  // Update ring buffer when energy changes
  useEffect(() => {
    if (!isVisible) return;

    const normalizedEnergy = Math.max(
      0.01,
      Math.min(1, currentEnergy / (vadThreshold * 3))
    );

    // Shift all values left
    for (let i = 0; i < barCount - 1; i++) {
      waveformBars[i]!.value = waveformBars[i + 1]!.value;
      waveformRecordingState[i]!.value = waveformRecordingState[i + 1]!.value;
    }

    // Add new value on the right with current recording state
    waveformBars[barCount - 1]!.value = normalizedEnergy;
    waveformRecordingState[barCount - 1]!.value = isRecording;
  }, [
    currentEnergy,
    isVisible,
    vadThreshold,
    isRecording,
    barCount,
    waveformBars,
    waveformRecordingState
  ]);

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
