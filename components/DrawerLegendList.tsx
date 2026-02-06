import { useBottomSheetScrollableCreator } from '@gorhom/bottom-sheet';
import type { LegendListProps, LegendListRef } from '@legendapp/list';
import { LegendList } from '@legendapp/list';
import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export interface DrawerLegendListProps<T>
  extends Omit<
    LegendListProps<T>,
    'renderScrollComponent' | 'style' | 'contentContainerStyle'
  > {
  /**
   * Optional ref for the LegendList
   */
  ref?: React.Ref<LegendListRef>;
  /**
   * Optional style for the scroll container
   */
  style?: StyleProp<ViewStyle>;
  /**
   * Optional contentContainerStyle override
   */
  contentContainerStyle?: StyleProp<ViewStyle>;
}

/**
 * DrawerLegendList - A LegendList component optimized for use inside Drawer/BottomSheet
 *
 * This component integrates LegendList with @gorhom/bottom-sheet using
 * useBottomSheetScrollableCreator to ensure proper scroll behavior and gesture handling.
 *
 * @example
 * ```tsx
 * import { Drawer, DrawerContent } from '@/components/ui/drawer';
 * import { DrawerLegendList } from '@/components/DrawerLegendList';
 *
 * <Drawer>
 *   <DrawerContent>
 *     <DrawerLegendList
 *       data={data}
 *       renderItem={renderItem}
 *       keyExtractor={(item) => item.id}
 *       estimatedItemSize={200}
 *     />
 *   </DrawerContent>
 * </Drawer>
 * ```
 */
export function DrawerLegendList<T>({
  ref,
  style,
  contentContainerStyle,
  ...legendListProps
}: DrawerLegendListProps<T>) {
  const BottomSheetScrollable = useBottomSheetScrollableCreator();

  return (
    <LegendList<T>
      ref={ref}
      style={style ? [style, { flex: 1 }] : { flex: 1 }}
      contentContainerStyle={contentContainerStyle}
      renderScrollComponent={BottomSheetScrollable}
      {...(legendListProps as LegendListProps<T>)}
    />
  );
}

DrawerLegendList.displayName = 'DrawerLegendList';

export default DrawerLegendList;
