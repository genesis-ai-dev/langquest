import { Text } from '@/components/ui/text';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming
} from 'react-native-reanimated';

interface BibleChapterGridProps {
  visible: boolean;
}

export function BibleChapterGrid({ visible }: BibleChapterGridProps) {
  // Show chapters 1-6 in a grid, then "..."
  const chapters = [1, 2, 3, 4, 5, 6];
  const chapterOpacities = React.useMemo(
    () => chapters.map(() => useSharedValue(0)),
    []
  );
  const chapterScales = React.useMemo(
    () => chapters.map(() => useSharedValue(0.8)),
    []
  );
  const dotsOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      // Animate chapters appearing one by one
      chapters.forEach((_, index) => {
        chapterOpacities[index].value = withDelay(
          200 + index * 50,
          withTiming(1, { duration: 300 })
        );
        chapterScales[index].value = withDelay(
          200 + index * 50,
          withSpring(1, { damping: 10, stiffness: 100 })
        );
      });
      // Animate dots appearing last
      dotsOpacity.value = withDelay(600, withTiming(1, { duration: 300 }));
    } else {
      // Reset when hidden
      chapters.forEach((_, index) => {
        chapterOpacities[index].value = 0;
        chapterScales[index].value = 0.8;
      });
      dotsOpacity.value = 0;
    }
  }, [visible, chapterOpacities, chapterScales, dotsOpacity]);

  return (
    <View className="w-full gap-3">
      <View className="flex-row flex-wrap gap-2">
        {chapters.map((chapterNum, index) => {
          const chapterStyle = useAnimatedStyle(() => {
            return {
              opacity: chapterOpacities[index].value,
              transform: [{ scale: chapterScales[index].value }]
            };
          });

          return (
            <Animated.View
              key={chapterNum}
              style={chapterStyle}
              className="h-12 w-12 items-center justify-center rounded-lg border border-border bg-muted"
            >
              <Text className="text-sm font-semibold">{chapterNum}</Text>
            </Animated.View>
          );
        })}
        <Animated.View
          style={useAnimatedStyle(() => ({
            opacity: dotsOpacity.value
          }))}
          className="h-12 w-12 items-center justify-center"
        >
          <Text className="text-lg text-muted-foreground">...</Text>
        </Animated.View>
      </View>
    </View>
  );
}

