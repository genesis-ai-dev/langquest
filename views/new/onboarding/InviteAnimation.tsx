import { Icon } from '@/components/ui/icon';
import { UserIcon, UserPlusIcon } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming
} from 'react-native-reanimated';

export function InviteAnimation() {
  const user1X = useSharedValue(-40);
  const user2X = useSharedValue(-40);
  const plusOpacity = useSharedValue(0);
  const user1Opacity = useSharedValue(0);
  const user2Opacity = useSharedValue(0);

  useEffect(() => {
    // Simple: two users slide in with plus icon between
    user1Opacity.value = withDelay(200, withTiming(1, { duration: 400 }));
    user1X.value = withDelay(200, withSpring(0, { damping: 12, stiffness: 100 }));

    plusOpacity.value = withDelay(400, withTiming(1, { duration: 300 }));

    user2Opacity.value = withDelay(500, withTiming(1, { duration: 400 }));
    user2X.value = withDelay(500, withSpring(0, { damping: 12, stiffness: 100 }));
  }, [user1X, user2X, plusOpacity, user1Opacity, user2Opacity]);

  const user1Style = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: user1X.value }],
      opacity: user1Opacity.value
    };
  });

  const user2Style = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: user2X.value }],
      opacity: user2Opacity.value
    };
  });

  const plusStyle = useAnimatedStyle(() => {
    return {
      opacity: plusOpacity.value
    };
  });

  return (
    <View className="flex-row items-center justify-center gap-3">
      <Animated.View style={user1Style}>
        <View className="h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Icon as={UserIcon} size={28} className="text-primary" />
        </View>
      </Animated.View>
      <Animated.View style={plusStyle}>
        <Icon as={UserPlusIcon} size={20} className="text-primary" />
      </Animated.View>
      <Animated.View style={user2Style}>
        <View className="h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Icon as={UserIcon} size={28} className="text-primary" />
        </View>
      </Animated.View>
    </View>
  );
}

