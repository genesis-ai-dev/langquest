import { colors } from '@/styles/theme';
import React, { useEffect, useRef, useState } from 'react';
import type { DimensionValue, ViewStyle } from 'react-native';
import { Animated, View } from 'react-native';

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
  const shimmerValue = useRef(new Animated.Value(0)).current;
  const [containerWidth, setContainerWidth] = useState(100); // Default width

  useEffect(() => {
    const shimmerAnimation = Animated.loop(
      Animated.timing(shimmerValue, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: false
      })
    );

    shimmerAnimation.start();

    return () => {
      shimmerAnimation.stop();
    };
  }, [shimmerValue]);

  const translateX = shimmerValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-containerWidth, containerWidth]
  });

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
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: shimmerColors[1],
          opacity: 0.7,
          transform: [{ translateX }]
        }}
      />
    </View>
  );
};
