// theme colors no longer needed after removing overlay
import React from 'react';
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent
} from 'react-native';
import { FlatList, Platform, TouchableOpacity, View } from 'react-native';
// Text no longer needed after removing overlay

export interface ArrayInsertionListHandle {
  scrollToInsertionIndex: (index: number, animated?: boolean) => void;
  getInsertionIndex: () => number;
  scrollItemToTop: (index: number, animated?: boolean) => void;
}

interface ArrayInsertionListProps {
  children: React.ReactNode[];
  value: number; // controlled insertion index (0..N)
  onChange?: (index: number) => void;
  rowHeight: number; // fixed row height for wheel behavior
  className?: string;
  topInset?: number;
  bottomInset?: number;
}

function ArrayInsertionListInternal(
  {
    children,
    value,
    onChange,
    rowHeight,
    className,
    topInset = 0,
    bottomInset = 0
  }: ArrayInsertionListProps,
  ref: React.Ref<ArrayInsertionListHandle>
) {
  const flatListRef = React.useRef<FlatList>(null);
  const controlledInsertionIndex = Math.max(
    0,
    Math.min(children.length, value)
  );
  const scrollPositionRef = React.useRef(0);
  const containerHeightRef = React.useRef<number>(0);
  const [containerHeight, setContainerHeight] = React.useState(0);
  // No programmatic snapping
  // Simplify: rely on FlatList snapping; avoid programmatic snap loops

  // Controlled insertion index (0..N)
  const insertionIndex = controlledInsertionIndex;

  // Data indices for rendering only content
  const dataIndices = React.useMemo(() => {
    return children.map((_, idx) => idx);
  }, [children]);

  // Compute dynamic padding so the centered indicator aligns with insertion boundary 0
  const getIndicatorY = React.useCallback(() => {
    const ch = containerHeightRef.current || 0;
    const top = Math.max(0, topInset);
    const bottom = Math.max(0, bottomInset);
    const usable = Math.max(0, ch - top - bottom);
    return top + usable / 2;
  }, [topInset, bottomInset]);

  const getPaddingTop = React.useCallback(() => {
    return getIndicatorY();
  }, [getIndicatorY]);

  const getPaddingBottom = getPaddingTop;

  // With fixed row height and paddingTop=indicatorY, offset to align boundary k
  const getOffsetToAlignInsertionIndex = React.useCallback(
    (k: number) => {
      return Math.max(0, k * rowHeight);
    },
    [rowHeight]
  );

  // Handle scroll: choose nearest insertion boundary from content offset
  const handleScroll = React.useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const scrollY = event.nativeEvent.contentOffset.y;
      scrollPositionRef.current = scrollY;

      // Derive insertion index purely from offset; no programmatic snapping here
      const k = Math.round(scrollY / rowHeight);
      const clamped = Math.max(0, Math.min(children.length, k));
      if (clamped !== insertionIndex) onChange?.(clamped);
    },
    [children.length, insertionIndex, onChange, rowHeight]
  );

  // Handle programmatic scroll to insertion boundary
  const scrollToInsertionIndex = React.useCallback(
    (newInsertionIndex: number, animated = true) => {
      const clamped = Math.max(0, Math.min(children.length, newInsertionIndex));
      const targetOffset = getOffsetToAlignInsertionIndex(clamped);
      flatListRef.current?.scrollToOffset({ offset: targetOffset, animated });
    },
    [children.length, getOffsetToAlignInsertionIndex]
  );

  const scrollItemToTop = React.useCallback(
    (itemIndex: number, animated = true) => {
      const clamped = Math.max(0, Math.min(children.length - 1, itemIndex));
      const targetOffset = clamped * rowHeight + getPaddingTop();
      flatListRef.current?.scrollToOffset({ offset: targetOffset, animated });
    },
    [children.length, rowHeight, getPaddingTop]
  );

  React.useImperativeHandle(
    ref,
    () => ({
      scrollToInsertionIndex: (index: number, animated = true) =>
        scrollToInsertionIndex(index, animated),
      getInsertionIndex: () => insertionIndex,
      scrollItemToTop: (index: number, animated = true) =>
        scrollItemToTop(index, animated)
    }),
    [scrollToInsertionIndex, scrollItemToTop, insertionIndex]
  );

  // Render a list item (fixed height)
  const renderItem = React.useCallback(
    ({ item: index }: { item: number }) => {
      return (
        <View
          className="px-4"
          style={{ height: rowHeight, justifyContent: 'center' }}
        >
          <TouchableOpacity
            onPress={() => onChange?.(index + 1)}
            activeOpacity={0.9}
          >
            <View>{children[index]}</View>
          </TouchableOpacity>
        </View>
      );
    },
    [children, onChange, rowHeight]
  );

  // Handle keyboard navigation
  React.useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
        scrollToInsertionIndex(insertionIndex - 1);
      } else if (e.key === 'ArrowDown') {
        scrollToInsertionIndex(insertionIndex + 1);
      }
    };

    if (Platform.OS === 'web') {
      window.addEventListener('keydown', handleKeyPress);
      return () => window.removeEventListener('keydown', handleKeyPress);
    }
  }, [insertionIndex, scrollToInsertionIndex]);

  // Measure container height for dynamic centering paddings
  const onContainerLayout = React.useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    containerHeightRef.current = h;
    setContainerHeight(h);
  }, []);

  // Snap once on mount and when container ready
  React.useEffect(() => {
    if (children.length > 0 && containerHeight > 0) {
      const offset = getOffsetToAlignInsertionIndex(insertionIndex);
      flatListRef.current?.scrollToOffset({ offset, animated: false });
    }
  }, [children.length, containerHeight]);

  // Stop forcing scroll alignment on external value changes to avoid tug of war

  // Remove custom drag/momentum snapping; rely on FlatList snapToInterval
  const handleScrollBeginDrag = undefined as unknown as () => void;
  const handleScrollEndDrag = undefined as unknown as (
    e: NativeSyntheticEvent<NativeScrollEvent>
  ) => void;
  const handleMomentumScrollBegin = undefined as unknown as () => void;
  const handleMomentumScrollEnd = undefined as unknown as () => void;

  // No timers to cleanup

  return (
    <View className={className} onLayout={onContainerLayout}>
      <FlatList
        ref={flatListRef}
        data={dataIndices}
        renderItem={renderItem}
        keyExtractor={(index) => `content-${index}`}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollBegin={handleMomentumScrollBegin}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        scrollEventThrottle={16}
        snapToInterval={rowHeight}
        disableIntervalMomentum
        getItemLayout={(_, index) => ({
          length: rowHeight,
          offset: rowHeight * index + getPaddingTop(),
          index
        })}
        contentContainerStyle={{
          paddingTop: getPaddingTop(),
          paddingBottom: getPaddingBottom()
        }}
        // Optimize performance
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={10}
        initialNumToRender={10}
        // Picker feel
        decelerationRate="fast"
      />

      {/* No overlay; styling of active index handled by parent content */}
    </View>
  );
}

export default React.forwardRef<
  ArrayInsertionListHandle,
  ArrayInsertionListProps
>(
  ArrayInsertionListInternal as unknown as (
    props: ArrayInsertionListProps & {
      ref?: React.Ref<ArrayInsertionListHandle>;
    }
  ) => React.ReactElement
);
