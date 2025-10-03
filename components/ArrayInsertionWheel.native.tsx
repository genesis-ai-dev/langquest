import type { PickerItem } from '@quidone/react-native-wheel-picker';
import WheelPicker from '@quidone/react-native-wheel-picker';
import React from 'react';
import { Text, View } from 'react-native';

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
}

function ArrayInsertionWheelInternal(
  {
    children,
    value,
    onChange,
    rowHeight,
    className,
    topInset = 0,
    bottomInset = 0
  }: ArrayInsertionWheelProps,
  ref: React.Ref<ArrayInsertionWheelHandle>
) {
  const itemCount = children.length + 1; // extra end boundary
  const clampedValue = Math.max(0, Math.min(itemCount - 1, value));

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
      // Keep it odd for a centered selection line
      if (count % 2 === 0) count = Math.max(3, count - 1);
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
      getInsertionIndex: () => clampedValue,
      scrollItemToTop: (index: number) => {
        onChange?.(Math.max(0, Math.min(itemCount - 1, index + 1)));
      }
    }),
    [clampedValue, itemCount, onChange]
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
      return (
        <View style={{ height: rowHeight }} className="justify-center px-4">
          <Text className="text-center text-sm text-muted-foreground">
            {children.length === 0
              ? '⬇ Tap record button to start'
              : '⬇ Insert at end'}
          </Text>
        </View>
      );
    },
    [children, rowHeight]
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
        value={clampedValue}
        itemHeight={rowHeight}
        visibleItemCount={visibleCount}
        // Fire only on final change to avoid thrashing parent state during scroll
        onValueChanged={({ item }) => onChange?.(item.value)}
        // Constrain height to an exact multiple of rowHeight so overlay aligns
        style={{ height: wheelHeight }}
        renderItem={renderItem}
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
