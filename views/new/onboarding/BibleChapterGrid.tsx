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
  const chapters = React.useMemo(() => [1, 2, 3, 4, 5, 6], []);

  // Hooks must be called at the top level, not inside useMemo
  const chapter1Opacity = useSharedValue(0);
  const chapter2Opacity = useSharedValue(0);
  const chapter3Opacity = useSharedValue(0);
  const chapter4Opacity = useSharedValue(0);
  const chapter5Opacity = useSharedValue(0);
  const chapter6Opacity = useSharedValue(0);

  const chapter1Scale = useSharedValue(0.8);
  const chapter2Scale = useSharedValue(0.8);
  const chapter3Scale = useSharedValue(0.8);
  const chapter4Scale = useSharedValue(0.8);
  const chapter5Scale = useSharedValue(0.8);
  const chapter6Scale = useSharedValue(0.8);

  const dotsOpacity = useSharedValue(0);

  // Create arrays for easier iteration - memoized to avoid recreating on every render
  const chapterOpacities = React.useMemo(
    () => [
      chapter1Opacity,
      chapter2Opacity,
      chapter3Opacity,
      chapter4Opacity,
      chapter5Opacity,
      chapter6Opacity
    ],
    [
      chapter1Opacity,
      chapter2Opacity,
      chapter3Opacity,
      chapter4Opacity,
      chapter5Opacity,
      chapter6Opacity
    ]
  );
  const chapterScales = React.useMemo(
    () => [
      chapter1Scale,
      chapter2Scale,
      chapter3Scale,
      chapter4Scale,
      chapter5Scale,
      chapter6Scale
    ],
    [
      chapter1Scale,
      chapter2Scale,
      chapter3Scale,
      chapter4Scale,
      chapter5Scale,
      chapter6Scale
    ]
  );

  useEffect(() => {
    if (visible) {
      // Animate chapters appearing one by one
      chapters.forEach((_, index) => {
        const opacity = chapterOpacities[index];
        const scale = chapterScales[index];
        if (opacity && scale) {
          opacity.value = withDelay(
            200 + index * 50,
            withTiming(1, { duration: 300 })
          );
          scale.value = withDelay(
            200 + index * 50,
            withSpring(1, { damping: 10, stiffness: 100 })
          );
        }
      });
      // Animate dots appearing last
      dotsOpacity.value = withDelay(600, withTiming(1, { duration: 300 }));
    } else {
      // Reset when hidden
      chapters.forEach((_, index) => {
        const opacity = chapterOpacities[index];
        const scale = chapterScales[index];
        if (opacity && scale) {
          opacity.value = 0;
          scale.value = 0.8;
        }
      });
      dotsOpacity.value = 0;
    }
  }, [visible, chapterOpacities, chapterScales, dotsOpacity, chapters]);

  // Create animated styles at the top level
  const chapter1Style = useAnimatedStyle(() => ({
    opacity: chapter1Opacity.value,
    transform: [{ scale: chapter1Scale.value }]
  }));
  const chapter2Style = useAnimatedStyle(() => ({
    opacity: chapter2Opacity.value,
    transform: [{ scale: chapter2Scale.value }]
  }));
  const chapter3Style = useAnimatedStyle(() => ({
    opacity: chapter3Opacity.value,
    transform: [{ scale: chapter3Scale.value }]
  }));
  const chapter4Style = useAnimatedStyle(() => ({
    opacity: chapter4Opacity.value,
    transform: [{ scale: chapter4Scale.value }]
  }));
  const chapter5Style = useAnimatedStyle(() => ({
    opacity: chapter5Opacity.value,
    transform: [{ scale: chapter5Scale.value }]
  }));
  const chapter6Style = useAnimatedStyle(() => ({
    opacity: chapter6Opacity.value,
    transform: [{ scale: chapter6Scale.value }]
  }));
  const dotsStyle = useAnimatedStyle(() => ({
    opacity: dotsOpacity.value
  }));

  const chapterStyles = [
    chapter1Style,
    chapter2Style,
    chapter3Style,
    chapter4Style,
    chapter5Style,
    chapter6Style
  ];

  return (
    <View className="w-full gap-3">
      <View className="flex-row flex-wrap gap-2">
        {chapters.map((chapterNum, index) => (
          <Animated.View
            key={chapterNum}
            style={chapterStyles[index]}
            className="h-12 w-12 items-center justify-center rounded-lg border border-border bg-muted"
          >
            <Text className="text-sm font-semibold">{chapterNum}</Text>
          </Animated.View>
        ))}
        <Animated.View
          style={dotsStyle}
          className="h-12 w-12 items-center justify-center"
        >
          <Text className="text-lg text-muted-foreground">...</Text>
        </Animated.View>
      </View>
    </View>
  );
}
