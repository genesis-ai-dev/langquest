import { Icon } from '@/components/ui/icon';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSpring,
    withTiming
} from 'react-native-reanimated';

export function QuestListAnimation() {
  const book1X = useSharedValue(-30);
  const book2X = useSharedValue(-30);
  const book1Opacity = useSharedValue(0);
  const book2Opacity = useSharedValue(0);

  useEffect(() => {
    // Simple slide-in animation - just two quests sliding in from left
    book1Opacity.value = withDelay(200, withTiming(1, { duration: 400 }));
    book1X.value = withDelay(
      200,
      withSpring(0, { damping: 12, stiffness: 100 })
    );

    book2Opacity.value = withDelay(400, withTiming(1, { duration: 400 }));
    book2X.value = withDelay(
      400,
      withSpring(0, { damping: 12, stiffness: 100 })
    );
  }, [book1X, book2X, book1Opacity, book2Opacity]);

  const book1Style = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: book1X.value }],
      opacity: book1Opacity.value
    };
  });

  const book2Style = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: book2X.value }],
      opacity: book2Opacity.value
    };
  });

  return (
    <View className="flex-row items-center justify-center gap-3">
      <Animated.View style={book1Style}>
        <Icon name="book-open" size={28} className="text-primary" />
      </Animated.View>
      <Animated.View style={book2Style}>
        <Icon name="book-open" size={28} className="text-primary" />
      </Animated.View>
    </View>
  );
}
