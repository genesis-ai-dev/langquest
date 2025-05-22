import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming
} from 'react-native-reanimated';

interface ShimmerProps {
  width: number;
  height: number;
  backgroundColor: string;
  highlightColor: string;
}

const Shimmer: React.FC<ShimmerProps> = ({
  width,
  height,
  backgroundColor,
  highlightColor
}) => {
  const translateX = useSharedValue(-width);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }]
  }));

  useEffect(() => {
    translateX.value = withRepeat(
      withTiming(width, { duration: 1500 }),
      -1,
      false
    );
  }, []);

  return (
    <View style={[styles.container, { width, height, backgroundColor }]}>
      <Animated.View
        style={[
          styles.shimmer,
          { width, height, backgroundColor: highlightColor },
          animatedStyle
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden'
  },
  shimmer: {
    position: 'absolute',
    start: 0
  }
});

export default Shimmer;
