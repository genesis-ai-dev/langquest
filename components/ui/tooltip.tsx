import { NativeOnlyAnimatedView } from '@/components/ui/native-only-animated-view';
import { TextClassContext } from '@/components/ui/text';
import { cn } from '@/utils/styleUtils';
import * as TooltipPrimitive from '@rn-primitives/tooltip';
import { cva } from 'class-variance-authority';
import * as React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { Easing, Keyframe } from 'react-native-reanimated';
import { FullWindowOverlay as RNFullWindowOverlay } from 'react-native-screens';

/**
 * Animation Guidelines Applied:
 * - Ease-out for natural deceleration
 * - Exit faster than enter (100ms vs 200ms) for responsive feel
 * - Origin-aware: animation direction AND scale origin match tooltip placement
 * - Never scale from zero: starts at 0.97
 * - Tooltip delay: 400ms on web for first tooltip (prevents accidental activation)
 */

const EASE_OUT = Easing.out(Easing.ease);
const ENTER_DURATION = 150;
const EXIT_DURATION = 100; // Exit faster than enter for snappy feel
const DEFAULT_DELAY_DURATION = Platform.OS === 'web' ? 400 : 0;

type TooltipAlign = 'start' | 'center' | 'end';

/**
 * Returns the transform origin based on tooltip side and alignment.
 * Scale should originate from where the tooltip connects to its trigger.
 * Uses percentage format for React Native compatibility.
 */
const getTransformOrigin = (
  side: 'top' | 'bottom' | 'left' | 'right',
  align?: TooltipAlign
): string => {
  const resolvedAlign = align ?? 'center';
  // Determine horizontal position based on side and align
  const getX = () => {
    if (side === 'left') return '100%'; // Connect on right edge
    if (side === 'right') return '0%'; // Connect on left edge
    // For top/bottom, use align
    if (resolvedAlign === 'start') return '0%';
    if (resolvedAlign === 'end') return '100%';
    return '50%'; // center
  };

  // Determine vertical position based on side and align
  const getY = () => {
    if (side === 'top') return '0%'; // Connect on bottom edge
    if (side === 'bottom') return '100%'; // Connect on top edge
    // For left/right, use align
    if (resolvedAlign === 'start') return '0%';
    if (resolvedAlign === 'end') return '100%';
    return '50%'; // center
  };

  return `${getX()} ${getY()}`;
};

/**
 * Creates an origin-aware entering animation based on tooltip side.
 * Uses Keyframe API to properly combine opacity, scale, and translate.
 * Note: All keyframes must have the same transform properties defined.
 */
const createEnteringAnimation = (
  side: 'top' | 'bottom' | 'left' | 'right',
  align?: 'start' | 'center' | 'end'
) => {
  const resolvedAlign = align ?? 'center';

  // Determine initial offset based on side and align
  // Primary axis: slide from the direction opposite to where tooltip appears
  // Secondary axis: slight offset based on alignment for natural feel
  const getInitialTransform = () => {
    const SLIDE = 4;
    const ALIGN_OFFSET = 2;

    // Secondary axis offset based on alignment
    const alignOffset =
      resolvedAlign === 'start'
        ? -ALIGN_OFFSET
        : resolvedAlign === 'end'
          ? ALIGN_OFFSET
          : 0;

    switch (side) {
      case 'top':
        // Tooltip above, slides up from below
        return [
          { translateX: alignOffset },
          { translateY: SLIDE },
          { scale: 0.97 }
        ];
      case 'bottom':
        // Tooltip below, slides down from above
        return [
          { translateX: alignOffset },
          { translateY: -SLIDE },
          { scale: 0.97 }
        ];
      case 'left':
        // Tooltip left, slides from right
        return [
          { translateX: SLIDE },
          { translateY: alignOffset },
          { scale: 0.97 }
        ];
      case 'right':
        // Tooltip right, slides from left
        return [
          { translateX: -SLIDE },
          { translateY: alignOffset },
          { scale: 0.97 }
        ];
    }
  };

  return new Keyframe({
    0: {
      opacity: 0,
      transform: getInitialTransform()
    },
    100: {
      opacity: 1,
      transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }],
      easing: EASE_OUT
    }
  }).duration(ENTER_DURATION);
};

/**
 * Fast exit animation - exits faster than enter for snappy feel.
 * Animates in reverse direction of enter for natural feel.
 */
const createExitingAnimation = (
  side: 'top' | 'bottom' | 'left' | 'right',
  align?: 'start' | 'center' | 'end'
) => {
  const resolvedAlign = align ?? 'center';

  const getExitTransform = () => {
    const SLIDE = 4;
    const ALIGN_OFFSET = 2;

    const alignOffset =
      resolvedAlign === 'start'
        ? -ALIGN_OFFSET
        : resolvedAlign === 'end'
          ? ALIGN_OFFSET
          : 0;

    switch (side) {
      case 'top':
        return [
          { translateX: alignOffset },
          { translateY: SLIDE },
          { scale: 0.97 }
        ];
      case 'bottom':
        return [
          { translateX: alignOffset },
          { translateY: -SLIDE },
          { scale: 0.97 }
        ];
      case 'left':
        return [
          { translateX: SLIDE },
          { translateY: alignOffset },
          { scale: 0.97 }
        ];
      case 'right':
        return [
          { translateX: -SLIDE },
          { translateY: alignOffset },
          { scale: 0.97 }
        ];
    }
  };

  return new Keyframe({
    0: {
      opacity: 1,
      transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }]
    },
    100: {
      opacity: 0,
      transform: getExitTransform(),
      easing: EASE_OUT
    }
  }).duration(EXIT_DURATION);
};

const Tooltip = ({
  delayDuration = DEFAULT_DELAY_DURATION,
  ...props
}: TooltipPrimitive.RootProps) => (
  <TooltipPrimitive.Root delayDuration={delayDuration} {...props} />
);

const TooltipTrigger = TooltipPrimitive.Trigger;

const FullWindowOverlay =
  Platform.OS === 'ios' ? RNFullWindowOverlay : React.Fragment;

const tooltipVariants = cva(
  'z-[6000] rounded-md border border-border bg-background px-3 py-2 sm:py-1.5'
);

const tooltipTextVariants = cva('text-xs text-foreground');

function TooltipContent({
  className,
  sideOffset = 4,
  portalHost,
  side = 'top',
  align,
  ...props
}: TooltipPrimitive.ContentProps &
  React.RefAttributes<TooltipPrimitive.ContentRef> & {
    portalHost?: string;
  }) {
  return (
    <TooltipPrimitive.Portal hostName={portalHost}>
      <FullWindowOverlay>
        <TooltipPrimitive.Overlay
          style={Platform.select({ native: StyleSheet.absoluteFill })}
          className={Platform.select({
            web: 'z-[7000]'
          })}
        >
          <NativeOnlyAnimatedView
            entering={createEnteringAnimation(side, align)}
            exiting={createExitingAnimation(side, align)}
            style={{ transformOrigin: getTransformOrigin(side, align) }}
          >
            <TextClassContext.Provider value={tooltipTextVariants()}>
              <TooltipPrimitive.Content
                sideOffset={sideOffset}
                side={side}
                align={align}
                className={cn(
                  tooltipVariants(),
                  Platform.select({
                    web: cn(
                      'origin-(--radix-tooltip-content-transform-origin) w-fit text-balance animate-in fade-in-0 zoom-in-95',
                      side === 'bottom' && 'slide-in-from-top-2',
                      side === 'left' && 'slide-in-from-right-2',
                      side === 'right' && 'slide-in-from-left-2',
                      side === 'top' && 'slide-in-from-bottom-2'
                    )
                  }),
                  className
                )}
                {...props}
              />
            </TextClassContext.Provider>
          </NativeOnlyAnimatedView>
        </TooltipPrimitive.Overlay>
      </FullWindowOverlay>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipContent, TooltipTrigger };
