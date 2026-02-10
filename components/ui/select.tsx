import { cn } from '@/utils/styleUtils';
import * as SelectPrimitive from '@rn-primitives/select';
import { MotiView } from 'moti';
import * as React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Icon } from './icon';

export function getOptionFromValue(value?: string | null): Option {
  if (value) {
    return {
      value: value,
      label: value
    };
  }
}

type Option = SelectPrimitive.Option;

const Select = SelectPrimitive.Root;

const SelectGroup = SelectPrimitive.Group;

const SelectValue = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Value>,
  React.ComponentProps<typeof SelectPrimitive.Value>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Value
    ref={ref}
    className={cn('text-foreground', className)}
    {...props}
  />
));
SelectValue.displayName = 'SelectValue';

const SelectTrigger = React.forwardRef<
  SelectPrimitive.TriggerRef,
  SelectPrimitive.TriggerProps
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'native:h-12 native:text-base flex h-10 flex-row items-center justify-between rounded-md border border-input bg-card px-3 py-2 text-sm text-muted-foreground web:ring-offset-background web:focus:outline-none web:focus:ring-2 web:focus:ring-ring web:focus:ring-offset-2 [&>span]:line-clamp-1',
      props.disabled && 'opacity-50 web:cursor-not-allowed',
      className
    )}
    {...props}
  >
    <>{children}</>
    <Icon
      name="chevron-down"
      aria-hidden={true}
      className="text-muted-foreground"
    />
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

/**
 * Platform: WEB ONLY
 */
const SelectScrollUpButton = ({
  className,
  ...props
}: SelectPrimitive.ScrollUpButtonProps) => {
  if (Platform.OS !== 'web') {
    return null;
  }
  return (
    <SelectPrimitive.ScrollUpButton
      className={cn(
        'flex items-center justify-center py-1 web:cursor-default',
        className
      )}
      {...props}
    >
      <Icon name="chevron-up" size={14} className="text-foreground" />
    </SelectPrimitive.ScrollUpButton>
  );
};

/**
 * Platform: WEB ONLY
 */
const SelectScrollDownButton = ({
  className,
  ...props
}: SelectPrimitive.ScrollDownButtonProps) => {
  if (Platform.OS !== 'web') {
    return null;
  }
  return (
    <SelectPrimitive.ScrollDownButton
      className={cn(
        'flex items-center justify-center py-1 web:cursor-default',
        className
      )}
      {...props}
    >
      <Icon name="chevron-down" size={14} className="text-muted-foreground" />
    </SelectPrimitive.ScrollDownButton>
  );
};

const SelectContent = React.forwardRef<
  SelectPrimitive.ContentRef,
  SelectPrimitive.ContentProps & { portalHost?: string }
>(({ className, children, position = 'popper', portalHost, ...props }, ref) => {
  const { open } = SelectPrimitive.useRootContext();

  return (
    <SelectPrimitive.Portal hostName={portalHost}>
      <SelectPrimitive.Overlay
        style={Platform.OS !== 'web' ? StyleSheet.absoluteFill : undefined}
        pointerEvents={open ? 'auto' : 'none'}
      >
        <View className="z-[400]">
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: open ? 1 : 0 }}
            transition={{ type: 'timing', duration: 200 }}
            pointerEvents={open ? 'auto' : 'none'}
          >
            <SelectPrimitive.Content
              ref={ref}
              className={cn(
                'relative max-h-96 min-w-[8rem] rounded-md border border-input bg-popover p-1.5 px-1 py-2 shadow-md shadow-foreground/10 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
                position === 'popper' &&
                  'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
                open
                  ? 'web:animate-in web:fade-in-0 web:zoom-in-95'
                  : 'web:animate-out web:fade-out-0 web:zoom-out-95',
                className
              )}
              position={position}
              {...props}
            >
              <SelectScrollUpButton />
              <SelectPrimitive.Viewport
                className={cn(
                  'p-1',
                  position === 'popper' &&
                    'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]'
                )}
              >
                {children}
              </SelectPrimitive.Viewport>
              <SelectScrollDownButton />
            </SelectPrimitive.Content>
          </MotiView>
        </View>
      </SelectPrimitive.Overlay>
    </SelectPrimitive.Portal>
  );
});
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = React.forwardRef<
  SelectPrimitive.LabelRef,
  SelectPrimitive.LabelProps
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn(
      'native:pb-2 native:pl-10 native:text-base py-1.5 pl-8 pr-2 text-sm font-semibold text-popover-foreground',
      className
    )}
    {...props}
  />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

const SelectItem = React.forwardRef<
  SelectPrimitive.ItemRef,
  SelectPrimitive.ItemProps & {
    textClassName?: string;
    showCheckIcon?: boolean;
  }
>(({ className, textClassName, showCheckIcon = true, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'web:group native:py-2 relative flex w-full flex-row items-center rounded-md py-1.5 pr-2 active:bg-accent web:cursor-default web:select-none web:outline-none web:hover:bg-accent/50 web:focus:bg-accent',
      showCheckIcon ? 'native:pl-10 pl-8' : 'native:pl-3 pl-3',
      props.disabled && 'opacity-50 web:pointer-events-none',
      className
    )}
    {...props}
  >
    {showCheckIcon && (
      <View className="native:left-3.5 native:pt-px absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Icon
            name="check"
            size={16}
            strokeWidth={3}
            className="text-popover-foreground"
          />
        </SelectPrimitive.ItemIndicator>
      </View>
    )}
    <SelectPrimitive.ItemText
      className={cn(
        'native:text-base flex-1 text-sm text-popover-foreground web:group-focus:text-accent-foreground',
        textClassName
      )}
    />
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef<
  SelectPrimitive.SeparatorRef,
  SelectPrimitive.SeparatorProps
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-muted', className)}
    {...props}
  />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectScrollDownButton,
    SelectScrollUpButton,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
    type Option
};

