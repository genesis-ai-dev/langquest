import {
  LegendList as LegendListBase,
  type LegendListProps,
  type LegendListRef
} from '@legendapp/list';
import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type { LegendListProps, LegendListRef };

type AppLegendListProps<T> = LegendListProps<T> & {
  /** Extra clearance above the system inset (e.g. for a FAB). */
  bottomExtra?: number;
  /**
   * Skip the system bottom inset (e.g. list already sits above a padded
   * footer, or lives inside a sheet that handles safe area itself).
   */
  ignoreSafeBottom?: boolean;
};

/**
 * App LegendList: keeps the last row clear of the Android nav bar / iOS home
 * indicator unless `ignoreSafeBottom` is set.
 *
 * Import from `@/components/ui/legend-list` — not `@legendapp/list` (ESLint-enforced).
 * LegendList ignores contentContainerStyle.paddingBottom when sizing scroll
 * content; a footer spacer is the reliable inset mechanism.
 */
function LegendListInner<T>(
  {
    bottomExtra = 0,
    ignoreSafeBottom = false,
    ListFooterComponent,
    ...rest
  }: AppLegendListProps<T>,
  ref: React.Ref<LegendListRef>
) {
  const { bottom } = useSafeAreaInsets();
  const spacerHeight = (ignoreSafeBottom ? 0 : bottom) + bottomExtra;

  return (
    <LegendListBase
      ref={ref}
      {...rest}
      ListFooterComponent={() => (
        <View>
          {ListFooterComponent ? (
            React.isValidElement(ListFooterComponent) ? (
              ListFooterComponent
            ) : (
              React.createElement(ListFooterComponent as React.ComponentType)
            )
          ) : null}
          {spacerHeight > 0 ? <View style={{ height: spacerHeight }} /> : null}
        </View>
      )}
    />
  );
}

export const LegendList = React.forwardRef(LegendListInner) as <T>(
  props: AppLegendListProps<T> & { ref?: React.Ref<LegendListRef> }
) => React.ReactElement;
