import type { PickerItem } from '@quidone/react-native-wheel-picker';
import WheelPicker from '@quidone/react-native-wheel-picker';
import { ArrowDownNarrowWide, Mic } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';
import ArrayInsertionWheelContainer from './ArrayInsertionWheelContainer';
import { Icon } from './ui/icon';

export interface ArrayInsertionWheelHandle {
  scrollToInsertionIndex: (index: number, animated?: boolean) => void;
  getInsertionIndex: () => number;
  scrollItemToTop: (index: number, animated?: boolean) => void;
}

interface ArrayInsertionWheelProps {
  children: React.ReactNode[];
  value: number; // 0..N insertion boundary
  onChange?: (index: number) => void;
  rowHeight: number;
  className?: string;
  topInset?: number; // unused in native wheel, kept for API parity
  bottomInset?: number; // unused in native wheel, kept for API parity
  boundaryComponent?: React.ReactNode;
}

function ArrayInsertionWheelInternal(
  {
    children,
    value,
    onChange,
    rowHeight,
    className,
    topInset = 0,
    bottomInset = 0,
    boundaryComponent
  }: ArrayInsertionWheelProps,
  ref: React.Ref<ArrayInsertionWheelHandle>
) {
  const itemCount = children.length + 1; // extra end boundary
  const clampedValue = Math.max(0, Math.min(itemCount - 1, value));

  // Stabilize clampedValue to prevent unnecessary WheelPicker updates
  const prevClampedRef = React.useRef(clampedValue);
  const stableClampedValue = React.useMemo(() => {
    if (prevClampedRef.current !== clampedValue) {
      console.log(
        '📊 Wheel value changed:',
        prevClampedRef.current,
        '→',
        clampedValue,
        '| itemCount:',
        itemCount
      );
      prevClampedRef.current = clampedValue;
    }
    return clampedValue;
  }, [clampedValue, itemCount]);

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

  const data = React.useMemo<PickerItem<number>[]>(
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

  const renderItem = React.useCallback(
    ({ item }: { item: PickerItem<number> }) => {
      const i = item.value;

      // Render actual items (not the final boundary)
      if (i < children.length) {
        return (
          <View style={{ height: rowHeight, justifyContent: 'center' }}>
            {children[i]}
          </View>
        );
      }

      // Final boundary (i === children.length)
      // When empty (0 items), this is position 0 - the only insertion point
      // When non-empty, this is position N - insert after all items
      if (boundaryComponent) {
        return boundaryComponent;
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
              <Icon as={Mic} size={20} />
              <Icon
                as={ArrowDownNarrowWide}
                size={20}
                style={{ marginLeft: 4 }}
              />
            </View>
          </View>
        </View>
      );
    },
    [children, rowHeight, boundaryComponent]
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
        data={data}
        value={stableClampedValue}
        itemHeight={rowHeight}
        visibleItemCount={visibleCount}
        // Fire only on final change to avoid thrashing parent state during scroll
        onValueChanged={({ item }) => onChange?.(item.value)}
        // Constrain height to an exact multiple of rowHeight so overlay aligns
        style={{ height: wheelHeight }}
        renderItem={renderItem}
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

export default React.forwardRef<
  ArrayInsertionWheelHandle,
  ArrayInsertionWheelProps
>(
  ArrayInsertionWheelInternal as unknown as (
    props: ArrayInsertionWheelProps & {
      ref?: React.Ref<ArrayInsertionWheelHandle>;
    }
  ) => React.ReactElement
);
