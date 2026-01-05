import { TextClassContext } from '@/components/ui/text';
import { cn, useThemeColor } from '@/utils/styleUtils';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import * as React from 'react';
import { ActivityIndicator, Pressable, TouchableOpacity } from 'react-native';
import * as Slot from './slot';

const buttonVariants = cva(
  'group flex items-center justify-center rounded-md web:ring-offset-background web:transition-[transform,color] web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-ring web:focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'bg-primary active:opacity-90 web:hover:opacity-90',
        destructive: 'bg-destructive active:opacity-90 web:hover:opacity-90',
        outline:
          'border border-input bg-background active:bg-accent web:hover:bg-accent web:hover:text-accent-foreground',
        secondary: 'bg-secondary active:opacity-80 web:hover:opacity-80',
        ghost:
          'active:bg-accent web:hover:bg-accent web:hover:text-accent-foreground',
        link: 'active:scale-100 web:underline-offset-4 web:hover:underline web:focus:underline'
      },
      size: {
        sm: 'h-10 rounded-md px-3',
        default: 'native:px-5 native:py-3 h-12 px-4 py-2',
        lg: 'h-14 rounded-md px-8',
        'icon-sm': 'size-8',
        icon: 'size-10',
        'icon-lg': 'size-12',
        'icon-xl': 'size-14',
        'icon-2xl': 'size-16'
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
        link: 'text-primary group-active:underline'
      },
      size: {
        default: '',
        sm: 'native:text-sm',
        lg: 'native:text-lg',
        'icon-sm': '',
        icon: '',
        'icon-lg': '',
        'icon-xl': '',
        'icon-2xl': ''
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
);

const ButtonPressable = Pressable;

const ButtonPressableOpacity = TouchableOpacity;

type ButtonPressableProps = React.ComponentPropsWithoutRef<typeof Pressable> & {
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
      link: primaryForeground
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

    const commonProps = {
      className: cn(
        'flex flex-row items-center gap-2',
        isDisabled && 'opacity-50 web:pointer-events-none web:cursor-default',
        buttonVariants({ variant, size, className })
      ),
      role: 'button' as const,
      disabled: isDisabled,
      ...props
    };

    return (
      <TextClassContext.Provider
        value={buttonTextVariants({
          variant,
          size,
          className: cn('web:pointer-events-none', isDisabled && 'opacity-50')
        })}
      >
        {asChild ? (
          <Slot.Pressable {...commonProps} ref={ref}>
            {content}
          </Slot.Pressable>
        ) : (
          <Pressable {...commonProps} ref={ref}>
            {content}
          </Pressable>
        )}
      </TextClassContext.Provider>
    );
  }
);

Button.displayName = 'Button';

export {
  Button,
  ButtonPressable,
  ButtonPressableOpacity,
  buttonTextVariants,
  buttonVariants
};
export type { ButtonProps };
