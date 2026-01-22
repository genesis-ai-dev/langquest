import { cn, useThemeColor } from '@/utils/styleUtils';
import * as React from 'react';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring
} from 'react-native-reanimated';

interface SliderProps {
  // API compatibility: support both naming conventions
  min?: number;
  max?: number;
  minimumValue?: number;
  maximumValue?: number;
  value?: number;
  step?: number;
  onValueChange?: (value: number) => void;
  // Tint color props for compatibility
  minimumTrackTintColor?: string;
  maximumTrackTintColor?: string;
  thumbTintColor?: string;
  // Style prop
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  className?: string;
  // Whether to animate value changes (default: true)
  animated?: boolean;
}

/**
 * Custom Slider component with gesture handling
 * Does NOT use @rn-primitives/slider to avoid precision errors in native code
 * All rendering and gesture handling is done in JS/React Native
 */
function Slider({
  className,
  min: minProp,
  max: maxProp,
  minimumValue,
  maximumValue,
  value: valueProp,
  step,
  onValueChange,
  minimumTrackTintColor,
  maximumTrackTintColor,
  thumbTintColor,
  style,
  disabled,
  animated = true
}: SliderProps) {
  // API compatibility: map minimumValue/maximumValue to min/max
  const min = minProp ?? minimumValue ?? 0;
  const max = maxProp ?? maximumValue ?? 100;
  const value =
    typeof valueProp === 'number' && isFinite(valueProp) ? valueProp : min;

  // Track width for calculations
  const trackWidth = useSharedValue(0);
  const isDragging = useSharedValue(false);
  const dragValue = useSharedValue(value);
  const startPercent = useSharedValue(0); // Capture start position for dragging

  // Clamp value to min/max range
  const clampedValue = React.useMemo(() => {
    const clamped = Math.max(min, Math.min(max, value));
    return isFinite(clamped) ? clamped : min;
  }, [min, max, value]);

  // Calculate percentage (0-100) - used for initial render only
  const _percent = React.useMemo(() => {
    const range = Math.max(1e-6, max - min);
    const raw = ((clampedValue - min) / range) * 100;
    const result = Math.max(0, Math.min(100, raw));
    return isFinite(result) ? result : 0;
  }, [min, max, clampedValue]);

  // Store min, max, step, animated, and current value in shared values for worklet access
  // Using useSharedValue instead of useRef avoids Reanimated serialization warnings
  const minShared = useSharedValue(min);
  const maxShared = useSharedValue(max);
  const stepShared = useSharedValue(step ?? 0);
  const animatedShared = useSharedValue(animated);
  const currentValueShared = useSharedValue(clampedValue);

  // Sync shared values when props change
  React.useEffect(() => {
    minShared.value = min;
    maxShared.value = max;
    stepShared.value = step ?? 0;
    animatedShared.value = animated;
  }, [
    min,
    max,
    step,
    animated,
    minShared,
    maxShared,
    stepShared,
    animatedShared
  ]);

  // Sync dragValue and currentValueShared when value prop changes externally (programmatic updates)
  React.useEffect(() => {
    if (!isDragging.value) {
      currentValueShared.value = clampedValue;
      dragValue.value = clampedValue;
    }
  }, [clampedValue, isDragging, dragValue, currentValueShared]);

  // Handle value change (with step snapping)
  const handleValueChange = React.useCallback(
    (newValue: number) => {
      if (!isFinite(newValue)) return;

      let finalValue = newValue;
      if (step && step > 0) {
        // Use integer arithmetic for step snapping to avoid precision issues
        const stepIndex = Math.round((newValue - min) / step);
        finalValue = stepIndex * step + min;
      }
      const clamped = Math.max(min, Math.min(max, finalValue));
      if (isFinite(clamped)) {
        onValueChange?.(clamped);
      }
    },
    [min, max, step, onValueChange]
  );

  // Stable callback wrapper to call onValueChange from worklets via runOnJS
  // The ref is accessed on JS thread (inside callOnValueChange), not in the worklet
  // This avoids Reanimated serialization warnings from modifying ref.current after capture
  const onValueChangeRef = React.useRef(handleValueChange);
  React.useEffect(() => {
    onValueChangeRef.current = handleValueChange;
  }, [handleValueChange]);

  const callOnValueChange = React.useCallback((value: number) => {
    onValueChangeRef.current(value);
  }, []);

  // Pan gesture for dragging thumb
  const panGesture = Gesture.Pan()
    .enabled(!disabled)
    .activeOffsetX([-10, 10]) // Horizontal movement activates
    .failOffsetY([-5, 5]) // Vertical movement cancels (allows BottomSheet vertical drag)
    .onStart(() => {
      'worklet';
      isDragging.value = true;
      // Use currentValueShared (SharedValue) instead of clampedValue (JS value) to avoid serialization warnings
      dragValue.value = currentValueShared.value;
      // Capture starting percent for relative dragging
      const range = Math.max(1e-6, maxShared.value - minShared.value);
      startPercent.value =
        ((currentValueShared.value - minShared.value) / range) * 100;
    })
    .onUpdate((event) => {
      'worklet';
      if (trackWidth.value === 0) return;

      // Calculate new position based on translation from start position
      const trackWidthPx = trackWidth.value;
      const translationPercent = (event.translationX / trackWidthPx) * 100;
      const newPercent = Math.max(
        0,
        Math.min(100, startPercent.value + translationPercent)
      );

      // Convert to value
      const range = maxShared.value - minShared.value;
      const rawValue = minShared.value + (newPercent / 100) * range;
      let newValue = Math.max(
        minShared.value,
        Math.min(maxShared.value, rawValue)
      );

      // Apply step snapping using integer arithmetic
      if (stepShared.value > 0) {
        const stepIndex = Math.round(
          (newValue - minShared.value) / stepShared.value
        );
        newValue = stepIndex * stepShared.value + minShared.value;
        newValue = Math.max(
          minShared.value,
          Math.min(maxShared.value, newValue)
        );
      }

      dragValue.value = newValue;
      runOnJS(callOnValueChange)(newValue);
    })
    .onEnd(() => {
      'worklet';
      isDragging.value = false;
      // Snap to final value (with optional spring animation)
      let finalValue = dragValue.value;
      if (stepShared.value > 0) {
        const stepIndex = Math.round(
          (finalValue - minShared.value) / stepShared.value
        );
        finalValue = stepIndex * stepShared.value + minShared.value;
        finalValue = Math.max(
          minShared.value,
          Math.min(maxShared.value, finalValue)
        );
      }
      dragValue.value = animatedShared.value
        ? withSpring(finalValue, { overshootClamping: true })
        : finalValue;
      runOnJS(callOnValueChange)(finalValue);
    })
    .onFinalize(() => {
      'worklet';
      isDragging.value = false;
    });

  // Tap gesture for track tapping
  const tapGesture = Gesture.Tap()
    .enabled(!disabled)
    .onEnd((event) => {
      'worklet';
      if (trackWidth.value === 0) return;

      // Calculate tap position relative to track
      const tapPercent = Math.max(
        0,
        Math.min(100, (event.x / trackWidth.value) * 100)
      );

      // Convert to value
      const range = maxShared.value - minShared.value;
      const rawValue = minShared.value + (tapPercent / 100) * range;
      let newValue = Math.max(
        minShared.value,
        Math.min(maxShared.value, rawValue)
      );

      // Apply step snapping using integer arithmetic
      if (stepShared.value > 0) {
        const stepIndex = Math.round(
          (newValue - minShared.value) / stepShared.value
        );
        newValue = stepIndex * stepShared.value + minShared.value;
        newValue = Math.max(
          minShared.value,
          Math.min(maxShared.value, newValue)
        );
      }

      dragValue.value = animatedShared.value
        ? withSpring(newValue, { overshootClamping: true })
        : newValue;
      runOnJS(callOnValueChange)(newValue);
    });

  // Combined gesture (tap on track, pan on thumb)
  const composedGesture = Gesture.Race(tapGesture, panGesture);

  // Track layout handler
  const handleTrackLayout = React.useCallback(
    (event: LayoutChangeEvent) => {
      const { width } = event.nativeEvent.layout;
      trackWidth.value = width;
    },
    [trackWidth]
  );

  // Animated value for display - always use dragValue since it's synced with clampedValue via useEffect
  // Using dragValue (SharedValue) instead of clampedValue (JS value) avoids worklet serialization warnings
  const displayValue = useDerivedValue(() => {
    return dragValue.value;
  });

  // Calculate display percentage using SharedValues to avoid worklet serialization warnings
  const displayPercent = useDerivedValue(() => {
    const val = displayValue.value;
    const range = Math.max(1e-6, maxShared.value - minShared.value);
    const raw = ((val - minShared.value) / range) * 100;
    return Math.max(0, Math.min(100, isFinite(raw) ? raw : 0));
  });

  // Theme colors (fallback to props if provided) - must be called unconditionally
  const themePrimary = useThemeColor('primary');
  const themeMuted = useThemeColor('muted');
  const themeBackground = useThemeColor('background');
  const primaryColor = thumbTintColor ?? themePrimary;
  const mutedColor = maximumTrackTintColor ?? themeMuted;
  const rangeColor = minimumTrackTintColor ?? primaryColor;

  // Animated styles for track range (filled portion)
  const rangeStyle = useAnimatedStyle(() => {
    const widthPercent = interpolate(
      displayPercent.value,
      [0, 100],
      [0, 100],
      Extrapolation.CLAMP
    );
    return {
      width: `${widthPercent}%`
    };
  }, []);

  // Animated styles for thumb position
  const thumbStyle = useAnimatedStyle(() => {
    const leftPercent = interpolate(
      displayPercent.value,
      [0, 100],
      [0, 100],
      Extrapolation.CLAMP
    );

    // Always use direct value if animations are disabled or during dragging
    if (!animatedShared.value || isDragging.value) {
      return {
        left: `${leftPercent}%`
      };
    }

    // Use spring for programmatic changes when animated
    return {
      left: withSpring(`${leftPercent}%`, {
        overshootClamping: true
      })
    };
  }, []);

  return (
    <View
      className={cn(
        'relative h-14 touch-none select-none justify-center',
        disabled && 'opacity-50',
        className
      )}
      style={style}
    >
      <GestureDetector gesture={composedGesture}>
        <View
          onLayout={handleTrackLayout}
          style={{ position: 'relative', width: '100%' }}
        >
          {/* Track background */}
          <View
            className="relative h-3 overflow-hidden rounded-full"
            style={{ backgroundColor: mutedColor }}
          >
            {/* Track range (filled portion) */}
            <Animated.View
              className="h-full rounded-full rounded-r-none"
              style={[rangeStyle, { backgroundColor: rangeColor }]}
            />
          </View>

          {/* Thumb */}
          <Animated.View
            style={[
              thumbStyle,
              {
                position: 'absolute',
                top: -6, // Center vertically on track (track height 12, thumb height 24)
                width: 24,
                height: 24,
                marginLeft: -12, // Center horizontally on position
                borderRadius: 12,
                borderWidth: 2,
                borderColor: primaryColor,
                backgroundColor: themeBackground,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 4
              }
            ]}
            hitSlop={20}
          />
        </View>
      </GestureDetector>
    </View>
  );
}

export { Slider };
