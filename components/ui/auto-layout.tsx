import * as React from 'react';
import {
  FadeInDown,
  FadeOutUp,
  LinearTransition
} from 'react-native-reanimated';
import { NativeOnlyAnimatedView } from './native-only-animated-view';

type AutoLayoutProps = Omit<
  React.ComponentProps<typeof NativeOnlyAnimatedView>,
  'children' | 'entering' | 'exiting' | 'layout'
> & {
  children: React.ReactNode;
  /**
   * Default duration for entering/exiting/layout transitions.
   * Keeps motion subtle and consistent across the app.
   */
  durationMs?: number;
  entering?: React.ComponentProps<typeof NativeOnlyAnimatedView>['entering'];
  exiting?: React.ComponentProps<typeof NativeOnlyAnimatedView>['exiting'];
  layout?: React.ComponentProps<typeof NativeOnlyAnimatedView>['layout'];
};

function AutoLayout({
  children,
  durationMs = 160,
  entering,
  exiting,
  layout,
  ...rest
}: AutoLayoutProps) {
  return (
    <NativeOnlyAnimatedView
      entering={entering ?? FadeInDown.duration(durationMs)}
      exiting={exiting ?? FadeOutUp.duration(Math.max(100, durationMs - 40))}
      layout={layout ?? LinearTransition.duration(durationMs)}
      {...rest}
    >
      {children}
    </NativeOnlyAnimatedView>
  );
}

export { AutoLayout };

