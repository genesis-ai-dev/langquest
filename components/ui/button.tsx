import { TextClassContext } from '@/components/ui/text';
import { easeButton, easeOut } from '@/constants/animations';
import { cn, useThemeColor } from '@/utils/styleUtils';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import * as React from 'react';
import type { GestureResponderEvent, Pressable } from 'react-native';
import { ActivityIndicator, Pressable as RNPressable } from 'react-native';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';
import * as Slot from './slot';

const AnimatedPressable = Animated.createAnimatedComponent(RNPressable);

const buttonVariants = cva(
  'group flex items-center justify-center rounded-md web:ring-offset-background web:transition-[color] web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-ring web:focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'bg-primary web:hover:opacity-90',
        destructive: 'bg-destructive web:hover:opacity-90',
        outline:
          'border border-input bg-background active:bg-accent web:hover:bg-accent web:hover:text-accent-foreground',
        secondary: 'bg-secondary web:hover:opacity-80',
        ghost:
          'active:bg-accent web:hover:bg-accent web:hover:text-accent-foreground',
        link: 'web:underline-offset-4 web:hover:underline web:focus:underline',
        plain: ''
      },
      size: {
        sm: 'h-10 rounded-md px-3',
        default: 'native:px-5 native:py-3 h-12 px-4 py-2',
        lg: 'h-14 rounded-md px-8',
        'icon-sm': 'size-8',
        icon: 'size-10',
        'icon-lg': 'size-12',
        'icon-xl': 'size-14',
        'icon-2xl': 'size-16',
        auto: ''
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
);

const buttonTextVariants = cva(
  'native:text-base text-sm font-medium text-foreground web:whitespace-nowrap web:transition-colors',
  {
    variants: {
      variant: {
        default: 'text-primary-foreground',
        destructive: 'text-destructive-foreground',
        outline: 'group-active:text-accent-foreground',
        secondary:
          'text-secondary-foreground group-active:text-secondary-foreground',
        ghost: 'group-active:text-accent-foreground',
        link: 'text-primary group-active:underline',
        plain: 'text-primary'
      },
      size: {
        default: '',
        sm: 'native:text-sm',
        lg: 'native:text-lg',
        'icon-sm': '',
        icon: '',
        'icon-lg': '',
        'icon-xl': '',
        'icon-2xl': '',
        auto: ''
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
);

type ButtonPressableComponentProps = React.ComponentPropsWithoutRef<
  typeof RNPressable
> & {
  ref?: React.ComponentRef<typeof RNPressable>;
  disabled?: boolean;
  className?: string;
};

/**
 * ButtonPressable - A Pressable component with built-in scale animation on press
 * Handles scale animation on press (0.97 scale) with smooth transitions
 * Uses react-native-reanimated on all platforms (native and web)
 */
const ButtonPressable = React.forwardRef<
  React.ComponentRef<typeof RNPressable>,
  ButtonPressableComponentProps
>(({ disabled, onPressIn, onPressOut, style, className, ...props }, ref) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(disabled ? 0.5 : 1);

  useAnimatedReaction(
    () => disabled,
    (isDisabled) => {
      opacity.set(
        withTiming(isDisabled ? 0.5 : 1, {
          duration: 160,
          easing: easeButton
        })
      );
    }
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
    opacity: opacity.get()
  }));

  return (
    <AnimatedPressable
      ref={ref}
      disabled={disabled}
      onPressIn={(e: GestureResponderEvent) => {
        if (!disabled) {
          scale.set(
            withTiming(0.97, {
              duration: 160,
              easing: easeButton
            })
          );
          opacity.set(
            withTiming(0.9, {
              duration: 160,
              easing: easeButton
            })
          );
        }
        onPressIn?.(e);
      }}
      onPressOut={(e: GestureResponderEvent) => {
        if (!disabled) {
          scale.set(
            withTiming(1, {
              duration: 160,
              easing: easeButton
            })
          );
          opacity.set(
            withTiming(1, {
              duration: 160,
              easing: easeButton
            })
          );
        }
        onPressOut?.(e);
      }}
      style={[animatedStyle, style]}
      className={className}
      {...props}
    />
  );
});

ButtonPressable.displayName = 'ButtonPressable';

type PressableOpacityProps = React.ComponentPropsWithoutRef<
  typeof RNPressable
> & {
  ref?: React.ComponentRef<typeof RNPressable>;
  disabled?: boolean;
  activeOpacity?: number;
  className?: string;
};

/**
 * PressableOpacity - A Pressable component with opacity animation on press
 * Similar to TouchableOpacity but uses react-native-reanimated for better performance
 * Uses opacity animation (default 0.7) on press with smooth transitions
 */
const OpacityPressable = React.forwardRef<
  React.ComponentRef<typeof RNPressable>,
  PressableOpacityProps
>(
  (
    {
      disabled,
      activeOpacity = 0.4, // official TouchableOpacity default is 0.2
      onPressIn,
      onPressOut,
      style,
      className,
      ...props
    },
    ref
  ) => {
    const opacity = useSharedValue(disabled ? 0.5 : 1);

    useAnimatedReaction(
      () => disabled,
      (isDisabled) => {
        opacity.set(
          withTiming(isDisabled ? 0.5 : 1, {
            duration: 160,
            easing: easeOut
          })
        );
      }
    );

    const animatedStyle = useAnimatedStyle(() => ({
      opacity: opacity.get()
    }));

    return (
      <AnimatedPressable
        ref={ref}
        disabled={disabled}
        onPressIn={(e: GestureResponderEvent) => {
          opacity.set(
            withTiming(activeOpacity, {
              duration: 160,
              easing: easeOut
            })
          );
          onPressIn?.(e);
        }}
        onPressOut={(e: GestureResponderEvent) => {
          opacity.set(
            withTiming(1, {
              duration: 160,
              easing: easeOut
            })
          );
          onPressOut?.(e);
        }}
        style={[animatedStyle, style]}
        className={className}
        {...props}
      />
    );
  }
);

OpacityPressable.displayName = 'OpacityPressable';

type ButtonPressableProps = React.ComponentPropsWithoutRef<typeof Pressable> & {
  ref?: React.ComponentRef<typeof Pressable>;
  role?: string;
  disabled?: boolean;
};

type ButtonProps = ButtonPressableProps &
  VariantProps<typeof buttonVariants> & {
    loading?: boolean;
    className?: string;
    asChild?: boolean;
  };

const Button = React.forwardRef<
  React.ComponentRef<typeof Pressable>,
  ButtonProps
>(
  (
    {
      children,
      className,
      variant,
      size,
      loading,
      disabled,
      asChild,
      onPressIn: _onPressIn,
      onPressOut: _onPressOut,
      ...props
    }: ButtonProps,
    ref
  ) => {
    const primaryForeground = useThemeColor('primary-foreground');
    const destructiveForeground = useThemeColor('destructive-foreground');
    const accentForeground = useThemeColor('accent-foreground');
    const secondaryForeground = useThemeColor('secondary-foreground');

    const activityIndicatorColors = {
      default: primaryForeground,
      destructive: destructiveForeground,
      secondary: secondaryForeground,
      outline: accentForeground,
      ghost: accentForeground,
      link: primaryForeground,
      plain: primaryForeground
    } as const;

    const isDisabled = disabled || loading;

    // When asChild, pass children directly to allow Slot to merge props onto the child element.
    // Otherwise, wrap with Fragment to support the loading indicator.
    const content = asChild ? (
      (children as React.ReactElement)
    ) : (
      <>
        {loading && (
          <ActivityIndicator
            size="small"
            color={activityIndicatorColors[variant ?? 'default']}
          />
        )}
        {children}
      </>
    );

    // Use PressableOpacity for link and plain variants (subtle opacity animation)
    // Use ButtonPressable for other variants (scale animation)
    const Component = asChild
      ? Slot.Pressable
      : variant === 'link' || variant === 'plain'
        ? OpacityPressable
        : ButtonPressable;

    return (
      <TextClassContext.Provider
        value={buttonTextVariants({
          variant,
          size
          // className: cn('web:pointer-events-none', isDisabled && 'opacity-50')
        })}
      >
        <Component
          className={cn(
            'flex flex-row items-center gap-2',
            isDisabled && 'web:pointer-events-none web:cursor-default',
            buttonVariants({ variant, size, className })
          )}
          role="button"
          disabled={isDisabled}
          {...props}
          ref={ref}
        >
          {content}
        </Component>
      </TextClassContext.Provider>
    );
  }
);

Button.displayName = 'Button';

export {
  Button,
  ButtonPressable,
  buttonTextVariants,
  buttonVariants,
  OpacityPressable
};
export type { ButtonProps };
