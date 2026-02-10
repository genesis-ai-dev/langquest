import type { PickerItem } from '@quidone/react-native-wheel-picker';
import WheelPicker from '@quidone/react-native-wheel-picker';
import React from 'react';
import { View } from 'react-native';
import ArrayInsertionWheelContainer from './ArrayInsertionWheelContainer';
import { Icon } from './ui/icon';

export interface ArrayInsertionWheelHandle {
  scrollToInsertionIndex: (index: number, animated?: boolean) => void;
  getInsertionIndex: () => number;
  scrollItemToTop: (index: number, animated?: boolean) => void;
}

interface ArrayInsertionWheelPropsBase {
  value: number; // 0..N insertion boundary
  onChange?: (index: number) => void;
  rowHeight: number;
  className?: string;
  topInset?: number; // unused in native wheel, kept for API parity
  bottomInset?: number; // unused in native wheel, kept for API parity
  boundaryComponent?: React.ReactNode;
}

// API 1: Eager rendering with children (backward compatible)
interface ArrayInsertionWheelPropsEager extends ArrayInsertionWheelPropsBase {
  children: React.ReactNode[];
  data?: never;
  renderItem?: never;
}

// API 2: Lazy rendering with data + renderItem (optimized)
interface ArrayInsertionWheelPropsLazy<T> extends ArrayInsertionWheelPropsBase {
  children?: never;
  data: T[];
  renderItem: (item: T, index: number) => React.ReactElement;
}

type ArrayInsertionWheelProps<T = unknown> =
  | ArrayInsertionWheelPropsEager
  | ArrayInsertionWheelPropsLazy<T>;

function ArrayInsertionWheelInternal<T>(
  props: ArrayInsertionWheelProps<T>,
  ref: React.Ref<ArrayInsertionWheelHandle>
) {
  const {
    value,
    onChange,
    rowHeight,
    className,
    topInset = 0,
    bottomInset = 0,
    boundaryComponent
  } = props;

  // Determine which API is being used
  const isLazyMode = 'data' in props && props.data !== undefined;

  // Calculate item count based on mode
  let itemCount: number;
  if (isLazyMode) {
    itemCount = props.data.length + 1;
  } else {
    // Eager mode - children is guaranteed by type
    itemCount = props.children.length + 1;
  }

  const clampedValue = Math.max(0, Math.min(itemCount - 1, value));

  // Stabilize clampedValue to prevent unnecessary WheelPicker updates
  const stableClampedValue = React.useMemo(() => {
    return clampedValue;
  }, [clampedValue]);

  // Debug logging to trace clamping
  React.useEffect(() => {
    if (clampedValue !== value) {
      console.log(
        '⚠️ CLAMPING OCCURRED: input value=',
        value,
        '→ clamped=',
        clampedValue,
        '| valid range: 0-' + (itemCount - 1)
      );
    }
  }, [value, clampedValue, itemCount]);

  const pickerData = React.useMemo<PickerItem<number>[]>(
    () => Array.from({ length: itemCount }, (_, i) => ({ value: i })),
    [itemCount]
  );

  // Dynamically match visible rows to the actual available height so the
  // selection overlay stays centered and the user can reach the very end
  const [visibleCount, setVisibleCount] = React.useState(5);
  const [wheelHeight, setWheelHeight] = React.useState(rowHeight * 5);
  const [containerPad, setContainerPad] = React.useState({ top: 0, bottom: 0 });
  const onContainerLayout = React.useCallback(
    (e: { nativeEvent: { layout: { height: number } } }) => {
      const totalHeight = e.nativeEvent.layout.height;
      const available = Math.max(0, totalHeight - topInset - bottomInset);
      let count = Math.max(3, Math.floor(available / rowHeight));
      // Multiply by 2 to make the wheel taller (use more of the available space)
      count = Math.floor(count * 2);
      // Keep it odd for a centered selection line
      if (count % 2 === 0) count = Math.max(3, count - 1);
      // Ensure the wheel doesn't exceed available space
      const maxCount = Math.floor(available / rowHeight);
      if (maxCount % 2 === 0) count = Math.min(count, maxCount - 1);
      else count = Math.min(count, maxCount);

      setVisibleCount(count);
      const newWheelHeight = count * rowHeight;
      setWheelHeight(newWheelHeight);
      const leftover = Math.max(0, available - newWheelHeight);
      const half = leftover / 2;
      setContainerPad({ top: topInset + half, bottom: bottomInset + half });
    },
    [rowHeight, topInset, bottomInset]
  );

  React.useImperativeHandle(
    ref,
    () => ({
      scrollToInsertionIndex: (index: number) => {
        // Parent controls value; just notify desired change
        onChange?.(Math.max(0, Math.min(itemCount - 1, index)));
      },
      getInsertionIndex: () => stableClampedValue,
      scrollItemToTop: (index: number) => {
        onChange?.(Math.max(0, Math.min(itemCount - 1, index + 1)));
      }
    }),
    [stableClampedValue, itemCount, onChange]
  );

  const renderItemInternal = React.useCallback(
    ({ item }: { item: PickerItem<number> }): React.ReactElement => {
      const i = item.value;

      // Calculate data length based on mode
      let dataLength: number;
      if (isLazyMode) {
        dataLength = props.data.length;
      } else {
        dataLength = props.children.length;
      }

      // Render actual items (not the final boundary)
      if (i < dataLength) {
        if (isLazyMode) {
          // Lazy mode: call renderItem with data item
          const dataItem = props.data[i];
          if (!dataItem) {
            // Defensive: should never happen, but TypeScript needs this
            return <View style={{ height: rowHeight }} />;
          }
          return (
            <View style={{ height: rowHeight, justifyContent: 'center' }}>
              {props.renderItem(dataItem, i)}
            </View>
          );
        } else {
          // Eager mode: use pre-created children
          const child = props.children[i];
          return (
            <View style={{ height: rowHeight, justifyContent: 'center' }}>
              {child}
            </View>
          );
        }
      }

      // Final boundary (i === dataLength)
      // When empty (0 items), this is position 0 - the only insertion point
      // When non-empty, this is position N - insert after all items
      if (boundaryComponent) {
        return <>{boundaryComponent}</>;
      }

      return (
        <View
          style={{ height: rowHeight }}
          className="flex-row items-center justify-center px-4"
        >
          <View
            className="flex-row items-center gap-2"
            style={{ flex: 1, justifyContent: 'center' }}
          >
            {/* Language-agnostic visual: mic + circle-plus = "add recording here" */}
            <View
              className="flex-row items-center justify-center rounded-full bg-primary/10 p-2"
              style={{
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Icon name="mic" size={20} />
              <Icon
                name="arrow-down-narrow-wide"
                size={20}
                style={{ marginLeft: 4 }}
              />
            </View>
          </View>
        </View>
      );
    },
    [isLazyMode, props, rowHeight, boundaryComponent]
  );

  return (
    <View
      className={className}
      style={{
        flex: 1,
        paddingTop: containerPad.top,
        paddingBottom: containerPad.bottom
      }}
      onLayout={onContainerLayout}
    >
      <WheelPicker
        data={pickerData}
        value={stableClampedValue}
        itemHeight={rowHeight}
        visibleItemCount={visibleCount}
        // Fire only on final change to avoid thrashing parent state during scroll
        onValueChanged={({ item }) => onChange?.(item.value)}
        // Constrain height to an exact multiple of rowHeight so overlay aligns
        style={{ height: wheelHeight }}
        renderItem={renderItemInternal}
        renderItemContainer={({ key, ...props }) => (
          <ArrayInsertionWheelContainer key={key} {...props} />
        )}
        renderOverlay={() => (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              height: rowHeight,
              // Center within the WheelPicker's visible height (after margins)
              top: '50%',
              marginTop: -rowHeight / 2,
              borderTopWidth: 1,
              borderBottomWidth: 1,
              borderColor: 'rgba(255,255,255,0.12)',
              borderBottomColor: 'hsl(var(--border))'
            }}
          />
        )}
      />
    </View>
  );
}

const ArrayInsertionWheel = React.forwardRef(ArrayInsertionWheelInternal) as <
  T = unknown
>(
  props: ArrayInsertionWheelProps<T> & {
    ref?: React.Ref<ArrayInsertionWheelHandle>;
  }
) => React.ReactElement;

export default ArrayInsertionWheel;
