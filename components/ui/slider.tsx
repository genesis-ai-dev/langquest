import { cn, useThemeColor } from '@/utils/styleUtils';
import * as React from 'react';
import RNCommunitySlider from '@react-native-community/slider';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

interface SliderProps {
  // API compatibility: support both naming conventions
  min?: number;
  max?: number;
  minimumValue?: number;
  maximumValue?: number;
  value?: number;
  step?: number;
  onValueChange?: (value: number) => void;
  onSlidingComplete?: (value: number) => void;
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
 * Slider wrapper built on @react-native-community/slider.
 *
 * We render our own styled track/thumb (NativeWind classes) and place the
 * actual native slider on top (invisible) to handle gestures reliably.
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
  onSlidingComplete,
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

  const clampedValue = React.useMemo(() => {
    const clamped = Math.max(min, Math.min(max, value));
    return isFinite(clamped) ? clamped : min;
  }, [min, max, value]);

  // Keep a local value for smooth UI while parent state updates.
  const [internalValue, setInternalValue] = React.useState(clampedValue);
  React.useEffect(() => {
    setInternalValue(clampedValue);
  }, [clampedValue]);

  const snapValue = React.useCallback(
    (newValue: number) => {
      if (!isFinite(newValue)) return clampedValue;

      let finalValue = newValue;
      if (step && step > 0) {
        const stepIndex = Math.round((newValue - min) / step);
        finalValue = stepIndex * step + min;
      }
      const clamped = Math.max(min, Math.min(max, finalValue));
      return isFinite(clamped) ? clamped : clampedValue;
    },
    [clampedValue, min, max, step]
  );

  const handleValueChange = React.useCallback(
    (newValue: number) => {
      const next = snapValue(newValue);
      setInternalValue(next);
      onValueChange?.(next);
    },
    [onValueChange, snapValue]
  );

  const handleSlidingComplete = React.useCallback(
    (newValue: number) => {
      const next = snapValue(newValue);
      setInternalValue(next);
      onSlidingComplete?.(next);
    },
    [onSlidingComplete, snapValue]
  );

  // Theme colors (fallback to props if provided) - must be called unconditionally
  const themePrimary = useThemeColor('primary');
  const themeMuted = useThemeColor('muted');
  const themeBackground = useThemeColor('background');
  const primaryColor = thumbTintColor ?? themePrimary;
  const mutedColor = maximumTrackTintColor ?? themeMuted;
  const rangeColor = minimumTrackTintColor ?? primaryColor;

  const percent = React.useMemo(() => {
    const range = Math.max(1e-6, max - min);
    const raw = ((internalValue - min) / range) * 100;
    const result = Math.max(0, Math.min(100, raw));
    return isFinite(result) ? result : 0;
  }, [internalValue, min, max]);

  return (
    <View
      className={cn(
        'relative h-14 touch-none select-none justify-center',
        disabled && 'opacity-50',
        className
      )}
      style={style}
    >
      <View style={{ position: 'relative', width: '100%' }}>
        {/* Styled track background */}
        <View
          className="relative h-3 overflow-hidden rounded-full"
          style={{ backgroundColor: mutedColor }}
        >
          {/* Styled track range (filled portion) */}
          <View
            className="h-full rounded-full rounded-r-none"
            style={{ width: `${percent}%`, backgroundColor: rangeColor }}
          />
        </View>

        {/* Styled thumb */}
        <View
          style={[
            {
              position: 'absolute',
              left: `${percent}%`,
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
          pointerEvents="none"
        />

        {/* Invisible native slider overlay for gesture handling */}
        <RNCommunitySlider
          style={[StyleSheet.absoluteFill, { opacity: 0 }]}
          minimumValue={min}
          maximumValue={max}
          value={internalValue}
          step={step}
          onValueChange={handleValueChange}
          onSlidingComplete={handleSlidingComplete}
          disabled={disabled}
          // Ensure the underlying slider doesn't visually leak through if opacity changes.
          minimumTrackTintColor="transparent"
          maximumTrackTintColor="transparent"
          thumbTintColor="transparent"
        />
      </View>
    </View>
  );
}

export { Slider };
