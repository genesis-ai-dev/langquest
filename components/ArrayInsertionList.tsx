// theme colors no longer needed after removing overlay
import { useHaptic } from '@/hooks/useHaptic';
import type { LegendListRef } from '@legendapp/list';
import { LegendList } from '@legendapp/list';
import React from 'react';
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent
} from 'react-native';
import { Platform, TouchableOpacity, View } from 'react-native';
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
  const lightHaptic = useHaptic('light');
  const flatListRef = React.useRef<LegendListRef>(null);
  const currentIndexRef = React.useRef(value);
  const isUserScrollingRef = React.useRef(false);
  const scrollTimeoutRef = React.useRef<number | null>(null);
  const containerHeightRef = React.useRef<number>(0);
  const [containerHeight, setContainerHeight] = React.useState(0);

  // Update ref when prop changes (but don't force scroll immediately)
  React.useEffect(() => {
    currentIndexRef.current = value;
  }, [value]);

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

  // Detect when user starts scrolling - don't interrupt their gesture
  const handleScrollBeginDrag = React.useCallback(() => {
    isUserScrollingRef.current = true;
    if (scrollTimeoutRef.current !== null) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }
  }, []);

  // Only read final position when momentum ends - let FlatList handle snapping
  const handleMomentumScrollEnd = React.useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const scrollY = event.nativeEvent.contentOffset.y;
      const newIndex = Math.round(scrollY / rowHeight);
      const clamped = Math.max(0, Math.min(children.length, newIndex));

      // Haptic feedback on snap
      void lightHaptic();

      currentIndexRef.current = clamped;
      isUserScrollingRef.current = false;

      // Notify parent of final position
      if (clamped !== value) {
        onChange?.(clamped);
      }
    },
    [children.length, onChange, rowHeight, value]
  );

  // Programmatic scroll - only when not user-scrolling to avoid conflicts
  const scrollToInsertionIndex = React.useCallback(
    (newInsertionIndex: number, animated = true) => {
      // Don't interrupt user gesture!
      if (isUserScrollingRef.current) {
        return;
      }

      const clamped = Math.max(0, Math.min(children.length, newInsertionIndex));
      const targetOffset = getOffsetToAlignInsertionIndex(clamped);

      currentIndexRef.current = clamped;
      flatListRef.current?.scrollToOffset({ offset: targetOffset, animated });
    },
    [children.length, getOffsetToAlignInsertionIndex]
  );

  const scrollItemToTop = React.useCallback(
    (itemIndex: number, animated = true) => {
      // Don't interrupt user gesture!
      if (isUserScrollingRef.current) {
        return;
      }

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
      getInsertionIndex: () => currentIndexRef.current,
      scrollItemToTop: (index: number, animated = true) =>
        scrollItemToTop(index, animated)
    }),
    [scrollToInsertionIndex, scrollItemToTop]
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
            onPress={() => {
              const nextIndex = index + 1;
              scrollToInsertionIndex(nextIndex, true);
              onChange?.(nextIndex);
            }}
            activeOpacity={0.9}
          >
            <View>{children[index]}</View>
          </TouchableOpacity>
        </View>
      );
    },
    [children, onChange, rowHeight, scrollToInsertionIndex]
  );

  // Handle keyboard navigation
  React.useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
        scrollToInsertionIndex(currentIndexRef.current - 1);
      } else if (e.key === 'ArrowDown') {
        scrollToInsertionIndex(currentIndexRef.current + 1);
      }
    };

    if (Platform.OS === 'web') {
      window.addEventListener('keydown', handleKeyPress);
      return () => window.removeEventListener('keydown', handleKeyPress);
    }
  }, [scrollToInsertionIndex]);

  // Measure container height for dynamic centering paddings
  const onContainerLayout = React.useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    containerHeightRef.current = h;
    setContainerHeight(h);
  }, []);

  // Snap to position on mount
  React.useEffect(() => {
    if (children.length > 0 && containerHeight > 0) {
      const offset = getOffsetToAlignInsertionIndex(value);
      flatListRef.current?.scrollToOffset({ offset, animated: false });
    }
  }, [children.length, containerHeight, getOffsetToAlignInsertionIndex, value]);

  // Only sync prop changes when not user-scrolling, with debounce
  React.useEffect(() => {
    if (!isUserScrollingRef.current && value !== currentIndexRef.current) {
      // Debounce to avoid rapid re-scrolls
      if (scrollTimeoutRef.current !== null) {
        clearTimeout(scrollTimeoutRef.current);
      }

      scrollTimeoutRef.current = setTimeout(() => {
        scrollToInsertionIndex(value, false);
      }, 100) as unknown as number;
    }
  }, [value, scrollToInsertionIndex]);

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current !== null) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
    };
  }, []);

  return (
    <View className={className} onLayout={onContainerLayout}>
      <LegendList
        ref={flatListRef}
        data={dataIndices}
        renderItem={renderItem}
        keyExtractor={(index) => `content-${index}`}
        showsVerticalScrollIndicator={false}
        // Let FlatList handle ALL snapping - no mid-scroll updates
        onScrollBeginDrag={handleScrollBeginDrag}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        snapToInterval={rowHeight}
        decelerationRate="fast"
        disableIntervalMomentum
        // getItemLayout={(_, index) => ({
        //   length: rowHeight,
        //   offset: rowHeight * index + getPaddingTop(),
        //   index
        // })}
        contentContainerStyle={{
          paddingTop: getPaddingTop(),
          paddingBottom: getPaddingBottom()
        }}
        // Optimize performance
        // removeClippedSubviews={true}
        // maxToRenderPerBatch={10}
        // windowSize={10}
        // initialNumToRender={10}
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
