/**
 * RecordingSelectionList - Simple list with click-to-select behavior
 *
 * Unlike ArrayInsertionWheel which selects the centered item,
 * this list selects the item the user taps on.
 *
 * Features:
 * - Click item to select it
 * - Visual highlight on selected item
 * - Smooth scroll to selected item
 * - Supports lazy rendering with data + renderItem
 */

import type { LegendListRef } from '@legendapp/list';
import { LegendList } from '@legendapp/list';
import { ArrowDownNarrowWide, Mic } from 'lucide-react-native';
import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Icon } from './ui/icon';

export interface RecordingSelectionListHandle {
  scrollToIndex: (index: number, animated?: boolean) => void;
  getSelectedIndex: () => number;
}

interface RecordingSelectionListPropsBase {
  value: number; // selected index (0..N, where N is "insert at end")
  onChange?: (index: number) => void;
  onLongPress?: (index: number) => void; // Long press on an item
  rowHeight: number;
  className?: string;
  bottomInset?: number;
  boundaryComponent?: React.ReactNode;
  /** Extra data that triggers re-render when changed (e.g., isSelectionMode) */
  extraData?: unknown;
}

// Lazy rendering with data + renderItem
interface RecordingSelectionListPropsLazy<T>
  extends RecordingSelectionListPropsBase {
  data: T[];
  renderItem: (
    item: T,
    index: number,
    isSelected: boolean
  ) => React.ReactElement;
  /** Return true if this item supports long press (for batch selection mode) */
  canLongPress?: (item: T, index: number) => boolean;
}

type RecordingSelectionListProps<T = unknown> =
  RecordingSelectionListPropsLazy<T>;

function RecordingSelectionListInternal<T>(
  props: RecordingSelectionListProps<T>,
  ref: React.Ref<RecordingSelectionListHandle>
) {
  const {
    value,
    onChange,
    rowHeight,
    className,
    bottomInset = 0,
    boundaryComponent,
    data,
    renderItem,
    extraData
  } = props;

  const listRef = React.useRef<LegendListRef>(null);
  const selectedIndexRef = React.useRef(value);

  // Total item count includes all data items + 1 boundary item at the end
  const itemCount = data.length + 1;

  // Update ref when prop changes
  React.useEffect(() => {
    selectedIndexRef.current = value;
  }, [value]);

  // Scroll to selected item
  const scrollToIndex = React.useCallback(
    (index: number, animated = true) => {
      const clamped = Math.max(0, Math.min(itemCount - 1, index));
      listRef.current?.scrollToIndex({ index: clamped, animated });
    },
    [itemCount]
  );

  React.useImperativeHandle(
    ref,
    () => ({
      scrollToIndex: (index: number, animated = true) =>
        scrollToIndex(index, animated),
      getSelectedIndex: () => selectedIndexRef.current
    }),
    [scrollToIndex]
  );

  // Handle item press - select this item
  const handleItemPress = React.useCallback(
    (index: number) => {
      selectedIndexRef.current = index;
      onChange?.(index);
    },
    [onChange]
  );

  // Build list data: all items + boundary
  const listData = React.useMemo(() => {
    const items: { type: 'item' | 'boundary'; index: number; data?: T }[] = [];

    // Add all data items
    data.forEach((item, index) => {
      items.push({ type: 'item', index, data: item });
    });

    // Add boundary at the end (represents "insert after all items")
    items.push({ type: 'boundary', index: data.length });

    return items;
  }, [data]);

  // Render list item
  const renderListItem = React.useCallback(
    ({ item }: { item: (typeof listData)[number] }) => {
      const isSelected = item.index === value;

      // Render boundary item
      if (item.type === 'boundary') {
        if (boundaryComponent) {
          return (
            // <TouchableOpacity
            //   onPress={() => handleItemPress(item.index)}
            //   activeOpacity={0.7}
            // >
              <View
                style={{ height: rowHeight }}
                // className={isSelected ? 'bg-primary/10' : ''}
              >
                {boundaryComponent}
              </View>
            // </TouchableOpacity>
          );
        }

        // Default boundary component
        return (
          <TouchableOpacity
            onPress={() => handleItemPress(item.index)}
            activeOpacity={0.7}
          >
            <View
              style={{ height: rowHeight }}
              className={`flex-row items-center justify-center px-4`}
            >
              <View className="flex-row items-center gap-2">
                <View className="flex-row items-center justify-center rounded-full bg-primary/10 p-2">
                  <Icon as={Mic} size={20} />
                  <Icon
                    as={ArrowDownNarrowWide}
                    size={20}
                    style={{ marginLeft: 4 }}
                  />
                </View>
              </View>
            </View>
          </TouchableOpacity>
        );
      }

      // Render data item - card handles its own press and long press
      return (
        <View
          style={{ height: rowHeight, justifyContent: 'center' }}
          className="px-2"
        >
          {renderItem(item.data!, item.index, isSelected)}
        </View>
      );
    },
    [
      value,
      rowHeight,
      boundaryComponent,
      handleItemPress,
      renderItem
    ]
  );

  return (
    <View className={className} style={{ flex: 1 }}>
      <LegendList
        ref={listRef}
        data={listData}
        renderItem={renderListItem}
        keyExtractor={(item) =>
          item.type === 'boundary' ? 'boundary' : `item-${item.index}`
        }
        estimatedItemSize={rowHeight}
        showsVerticalScrollIndicator={true}
        contentContainerStyle={{
          paddingBottom: bottomInset
        }}
        extraData={extraData}
      />
    </View>
  );
}

const RecordingSelectionList = React.forwardRef(
  RecordingSelectionListInternal
) as <T = unknown>(
  props: RecordingSelectionListProps<T> & {
    ref?: React.Ref<RecordingSelectionListHandle>;
  }
) => React.ReactElement;

export default RecordingSelectionList;
