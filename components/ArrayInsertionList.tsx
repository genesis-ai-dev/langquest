import { colors } from '@/styles/theme';
import React from 'react';
import {
  Animated,
  FlatList,
  LayoutAnimation,
  Platform,
  TouchableOpacity,
  UIManager,
  View
} from 'react-native';
import { Text } from './ui/text';

// Enable LayoutAnimation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface ArrayInsertionListProps {
  children: React.ReactNode[];
  onInsertionChange?: (index: number) => void;
  className?: string;
}

type ListItem =
  | { type: 'content'; key: string; content: React.ReactNode }
  | { type: 'divider'; key: string };

export default function ArrayInsertionList({
  children,
  onInsertionChange,
  className
}: ArrayInsertionListProps) {
  const [insertionIndex, setInsertionIndex] = React.useState(0);
  const dividerOpacity = React.useRef(new Animated.Value(1)).current;
  const dividerScale = React.useRef(new Animated.Value(1)).current;

  // Convert children to list items with the divider inserted
  const listItems = React.useMemo((): ListItem[] => {
    const items: ListItem[] = [];

    // Convert each child to a content item
    const contentItems = children.map((child, index) => ({
      type: 'content' as const,
      key: `content-${index}`,
      content: child
    }));

    // Insert the divider at the current insertion index
    contentItems.forEach((item, index) => {
      if (index === insertionIndex) {
        items.push({ type: 'divider', key: 'divider' });
      }
      items.push(item);
    });

    // Add divider at the end if needed
    if (insertionIndex === children.length) {
      items.push({ type: 'divider', key: 'divider' });
    }

    return items;
  }, [children, insertionIndex]);

  // Handle moving the insertion point
  const moveInsertionPoint = React.useCallback(
    (newIndex: number) => {
      // Animate the divider briefly to show movement
      Animated.sequence([
        Animated.parallel([
          Animated.timing(dividerOpacity, {
            toValue: 0.5,
            duration: 100,
            useNativeDriver: true
          }),
          Animated.timing(dividerScale, {
            toValue: 0.95,
            duration: 100,
            useNativeDriver: true
          })
        ]),
        Animated.parallel([
          Animated.timing(dividerOpacity, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true
          }),
          Animated.timing(dividerScale, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true
          })
        ])
      ]).start();

      // Use LayoutAnimation for smooth item repositioning
      LayoutAnimation.configureNext(
        LayoutAnimation.create(
          200,
          LayoutAnimation.Types.easeInEaseOut,
          LayoutAnimation.Properties.opacity
        )
      );

      setInsertionIndex(newIndex);
      onInsertionChange?.(newIndex);
    },
    [dividerOpacity, dividerScale, onInsertionChange]
  );

  // Render a list item
  const renderItem = React.useCallback(
    ({ item, index }: { item: ListItem; index: number }) => {
      if (item.type === 'divider') {
        return (
          <Animated.View
            style={{
              opacity: dividerOpacity,
              transform: [{ scale: dividerScale }]
            }}
            className="my-3 px-4"
            key={`divider-${index}`}
          >
            <View className="relative">
              {/* Main divider line */}
              <View
                className="h-0.5 rounded-full"
                style={{ backgroundColor: colors.primary }}
              />

              {/* Center indicator */}
              <View className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex-row items-center gap-2">
                <View
                  className="h-3 w-3 rounded-full shadow-sm"
                  style={{ backgroundColor: colors.primary }}
                />
                <View
                  className="rounded-full px-3 py-1 shadow-sm"
                  style={{ backgroundColor: colors.primary }}
                >
                  <Text className="text-xs font-medium text-white">
                    Insert here (Position {insertionIndex + 1})
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>
        );
      }

      // Content item with tap-to-move-divider functionality
      const contentIndex = children.findIndex(
        (_, i) => `content-${i}` === item.key
      );

      return (
        <View className="px-4">
          {/* Invisible tap target above item to move divider here */}
          <TouchableOpacity
            className="-mb-4 h-8"
            onPress={() => moveInsertionPoint(contentIndex)}
            activeOpacity={1}
          />

          {/* The actual content */}
          <View className="mb-3">{item.content}</View>

          {/* Invisible tap target below item to move divider here */}
          <TouchableOpacity
            className="-mt-4 h-8"
            onPress={() => moveInsertionPoint(contentIndex + 1)}
            activeOpacity={1}
          />
        </View>
      );
    },
    [children, insertionIndex, dividerOpacity, dividerScale, moveInsertionPoint]
  );

  // Handle keyboard navigation
  React.useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' && insertionIndex > 0) {
        moveInsertionPoint(insertionIndex - 1);
      } else if (e.key === 'ArrowDown' && insertionIndex < children.length) {
        moveInsertionPoint(insertionIndex + 1);
      }
    };

    if (Platform.OS === 'web') {
      window.addEventListener('keydown', handleKeyPress);
      return () => window.removeEventListener('keydown', handleKeyPress);
    }
  }, [insertionIndex, children.length, moveInsertionPoint]);

  return (
    <FlatList
      className={className}
      data={listItems}
      renderItem={renderItem}
      keyExtractor={(item) => item.key}
      showsVerticalScrollIndicator={false}
      // contentContainerStyle={{
      //   paddingVertical: 2
      // }}
      // Optimize performance
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      windowSize={10}
      initialNumToRender={10}
      // Enable smooth scrolling
      decelerationRate="normal"
      // Maintain scroll position when items change
      maintainVisibleContentPosition={{
        minIndexForVisible: 0
      }}
    />
  );
}
