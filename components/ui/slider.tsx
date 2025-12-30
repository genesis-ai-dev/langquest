import { cn } from '@/utils/styleUtils';
import * as SliderPrimitive from '@rn-primitives/slider';
import * as React from 'react';
import { Platform } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  withSpring
} from 'react-native-reanimated';

function Slider({
  className,
  ...props
}: SliderPrimitive.RootProps & { max: number }) {
  const min = props.min ?? 0;
  const max = props.max;
  const value = typeof props.value === 'number' ? props.value : 0;

  const percent = React.useMemo(() => {
    const range = Math.max(1e-6, max - min);
    const raw = ((value - min) / range) * 100;
    return Math.max(0, Math.min(100, isFinite(raw) ? raw : 0));
  }, [min, max, value]);

  return (
    <SliderPrimitive.Root
      className={cn(
        'relative h-14 touch-none select-none justify-center aria-disabled:opacity-50',
        className
      )}
      {...props}
    >
      {/* Larger track for easier touch */}
      <SliderPrimitive.Track className="relative h-3 overflow-hidden rounded-full bg-muted">
        {Platform.OS === 'web' ? (
          <SliderPrimitive.Range
            className="h-full rounded-full rounded-r-none bg-primary transition-all"
            style={{ width: `${percent}%` }}
          />
        ) : (
          <NativeRange percent={percent} />
        )}
      </SliderPrimitive.Track>

      {Platform.OS === 'web' ? (
        <SliderPrimitive.Thumb
          className="focus-visible:outline-hidden native:absolute size-6 shrink-0 -translate-x-3 rounded-full border-2 border-primary bg-background shadow-md ring-ring/50 transition-colors hover:ring-4 focus-visible:ring-4 disabled:pointer-events-none"
          style={{ left: `${percent}%` }}
        />
      ) : (
        <NativeThumb percent={percent} />
      )}
    </SliderPrimitive.Root>
  );
}

export { Slider };

interface NativeIndicatorProps {
  percent: number;
}

function NativeRange({ percent }: NativeIndicatorProps) {
  const progress = useDerivedValue(() => percent);

  const animatedStyle = useAnimatedStyle(() => {
    const widthPercent = interpolate(
      progress.value,
      [0, 100],
      [1, 100],
      Extrapolation.CLAMP
    );
    return {
      width: withSpring(`${widthPercent}%`, { overshootClamping: true })
    };
  }, []);

  return (
    <SliderPrimitive.Range asChild>
      <Animated.View
        className="h-full rounded-full rounded-r-none bg-primary"
        style={animatedStyle}
      />
    </SliderPrimitive.Range>
  );
}

function NativeThumb({ percent }: NativeIndicatorProps) {
  const progress = useDerivedValue(() => percent);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      left: withSpring(
        `${interpolate(progress.value, [0, 100], [0, 100], Extrapolation.CLAMP)}%`,
        {
          overshootClamping: true
        }
      )
    };
  }, []);

  return (
    <SliderPrimitive.Thumb asChild>
      <Animated.View
        style={animatedStyle}
        // Larger touch area for better UX (44x44 is iOS recommended minimum)
        hitSlop={20}
        className={cn(
          'focus-visible:outline-hidden native:absolute size-6 shrink-0 -translate-x-3 rounded-full border-2 border-primary bg-background shadow-md ring-ring/50',
          'transition-colors hover:ring-4 focus-visible:ring-4 disabled:pointer-events-none'
        )}
      />
    </SliderPrimitive.Thumb>
  );
}
