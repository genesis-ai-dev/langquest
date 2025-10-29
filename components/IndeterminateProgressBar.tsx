import { cn } from '@/utils/styleUtils';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming
} from 'react-native-reanimated';

interface IndeterminateProgressBarProps {
  className?: string;
  barClassName?: string;
  isActive?: boolean;
}

/**
 * Ultra-performant indeterminate progress bar using react-native-reanimated
 * Shows a shimmer animation that runs at 60fps
 */
export function IndeterminateProgressBar({
  className,
  barClassName,
  isActive = true
}: IndeterminateProgressBarProps) {
  const translateX = useSharedValue(-1);

  useEffect(() => {
    if (isActive) {
      // Animate from -100% to 100% of container width
      translateX.value = withRepeat(
        withTiming(1, {
          duration: 1500,
          easing: Easing.bezier(0.65, 0, 0.35, 1)
        }),
        -1,
        false
      );
    } else {
      cancelAnimation(translateX);
      translateX.value = -1;
    }

    return () => {
      cancelAnimation(translateX);
    };
  }, [isActive, translateX]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateX: `${translateX.value * 100}%`
        }
      ]
    };
  });

  return (
    <View
      className={cn(
        'h-1 w-full overflow-hidden rounded-full bg-muted',
        className
      )}
    >
      <Animated.View
        style={[animatedStyle]}
        className={cn(
          'h-full w-1/3 rounded-full bg-primary opacity-70',
          barClassName
        )}
      />
    </View>
  );
}
