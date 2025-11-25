import { Text } from '@/components/ui/text';
import { BOOK_ICON_MAP } from '@/utils/BOOK_GRAPHICS';
import { useThemeColor } from '@/utils/styleUtils';
import React, { useEffect } from 'react';
import { Image } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming
} from 'react-native-reanimated';

interface BibleBookListAnimationProps {
  showChapters?: boolean;
  renderGenesis?: (genesisElement: React.ReactElement) => React.ReactElement;
}

export function BibleBookListAnimation({
  showChapters: _showChapters = false,
  renderGenesis
}: BibleBookListAnimationProps) {
  const primaryColor = useThemeColor('primary');
  const secondaryColor = useThemeColor('chart-2');

  const book1X = useSharedValue(-30);
  const book2X = useSharedValue(-30);
  const book1Opacity = useSharedValue(0);
  const book2Opacity = useSharedValue(0);

  useEffect(() => {
    // Animate books sliding in
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

  const genesisElement = (
    <Animated.View style={book1Style} className="flex-row items-center gap-3">
      <Image
        source={BOOK_ICON_MAP.gen}
        style={{
          width: 24,
          height: 24,
          tintColor: primaryColor
        }}
        resizeMode="contain"
      />
      <Text variant="default">Genesis</Text>
    </Animated.View>
  );

  return (
    <>
      {/* Genesis - can be wrapped by parent if needed */}
      {renderGenesis ? renderGenesis(genesisElement) : genesisElement}

      {/* Matthew */}
      <Animated.View style={book2Style} className="flex-row items-center gap-3">
        <Image
          source={BOOK_ICON_MAP.mat}
          style={{
            width: 24,
            height: 24,
            tintColor: secondaryColor
          }}
          resizeMode="contain"
        />
        <Text variant="default">Matthew</Text>
      </Animated.View>
    </>
  );
}
