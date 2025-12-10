import { NativeOnlyAnimatedView } from '@/components/ui/native-only-animated-view';
import { TextClassContext } from '@/components/ui/text';
import { cn } from '@/utils/styleUtils';
import * as TooltipPrimitive from '@rn-primitives/tooltip';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import * as React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { FadeInDown, FadeInUp, FadeOut } from 'react-native-reanimated';
import { FullWindowOverlay as RNFullWindowOverlay } from 'react-native-screens';

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

const FullWindowOverlay =
  Platform.OS === 'ios' ? RNFullWindowOverlay : React.Fragment;

const tooltipVariants = cva('z-50 rounded-md px-3 py-2 sm:py-1.5', {
  variants: {
    variant: {
      default: 'bg-primary',
      outline: 'border border-border bg-background'
    }
  },
  defaultVariants: {
    variant: 'default'
  }
});

const tooltipTextVariants = cva('text-xs', {
  variants: {
    variant: {
      default: 'text-primary-foreground',
      outline: 'text-foreground'
    }
  },
  defaultVariants: {
    variant: 'default'
  }
});

function TooltipContent({
  className,
  sideOffset = 4,
  portalHost,
  side = 'top',
  variant = 'default',
  ...props
}: TooltipPrimitive.ContentProps &
  React.RefAttributes<TooltipPrimitive.ContentRef> &
  VariantProps<typeof tooltipVariants> & {
    portalHost?: string;
  }) {
  return (
    <TooltipPrimitive.Portal hostName={portalHost}>
      <FullWindowOverlay>
        <TooltipPrimitive.Overlay
          style={Platform.select({ native: StyleSheet.absoluteFill })}
        >
          <NativeOnlyAnimatedView
            entering={
              side === 'top'
                ? FadeInDown.withInitialValues({
                    transform: [{ translateY: 3 }]
                  }).duration(150)
                : FadeInUp.withInitialValues({
                    transform: [{ translateY: -5 }]
                  })
            }
            exiting={FadeOut}
          >
            <TextClassContext.Provider value={tooltipTextVariants({ variant })}>
              <TooltipPrimitive.Content
                sideOffset={sideOffset}
                className={cn(
                  tooltipVariants({ variant }),
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
                side={side}
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
