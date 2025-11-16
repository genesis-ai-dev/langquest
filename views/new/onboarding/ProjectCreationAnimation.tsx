import { Icon } from '@/components/ui/icon';
import { FolderPenIcon } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming
} from 'react-native-reanimated';

export function ProjectCreationAnimation() {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);

  useEffect(() => {
    // Simple fade in and gentle pulse
    opacity.value = withTiming(1, { duration: 500 });
    scale.value = withRepeat(
      withSequence(
        withTiming(1.05, {
          duration: 1200,
          easing: Easing.inOut(Easing.ease)
        }),
        withTiming(1, {
          duration: 1200,
          easing: Easing.inOut(Easing.ease)
        })
      ),
      -1,
      false
    );
  }, [scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value
    };
  });

  return (
    <Animated.View style={animatedStyle}>
      <View className="h-24 w-24 items-center justify-center rounded-full bg-primary/10">
        <Icon as={FolderPenIcon} size={48} className="text-primary" />
      </View>
    </Animated.View>
  );
}
