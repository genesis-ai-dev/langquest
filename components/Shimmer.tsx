import { colors } from '@/styles/theme';
import React, { useEffect, useState } from 'react';
import type { DimensionValue, ViewStyle } from 'react-native';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming
} from 'react-native-reanimated';

interface ShimmerProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: ViewStyle;
  shimmerColors?: [string, string, string];
}

export const Shimmer: React.FC<ShimmerProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
  shimmerColors = [
    colors.inputBackground,
    colors.backgroundSecondary,
    colors.inputBackground
  ]
}) => {
  const shimmerValue = useSharedValue(0);
  const [containerWidth, setContainerWidth] = useState(100); // Default width

  useEffect(() => {
    shimmerValue.value = withRepeat(
      withTiming(1, { duration: 1500 }),
      -1,
      true
    );
    return () => {
      cancelAnimation(shimmerValue);
      shimmerValue.value = 0;
    };
  }, []);

  const shimmerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          shimmerValue.value,
          [0, 1],
          [-containerWidth, containerWidth]
        )
      }
    ]
  }));

  const shimmerStyle: ViewStyle = {
    width,
    height,
    borderRadius,
    backgroundColor: shimmerColors[0],
    overflow: 'hidden',
    ...style
  };

  return (
    <View
      style={shimmerStyle}
      onLayout={(event) => {
        setContainerWidth(event.nativeEvent.layout.width);
      }}
    >
      <Animated.View
        style={[
          {
            width: '100%',
            height: '100%',
            backgroundColor: shimmerColors[1],
            opacity: 0.7
          },
          shimmerAnimatedStyle
        ]}
      />
    </View>
  );
};
