import { TextClassContext } from '@/components/ui/text';
import { cn, getThemeColor } from '@/utils/styleUtils';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import * as React from 'react';
import { ActivityIndicator, Pressable } from 'react-native';

const buttonVariants = cva(
  'group flex items-center justify-center rounded-md active:scale-95 web:ring-offset-background web:transition-[transform,color] web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-ring web:focus-visible:ring-offset-2',
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
        sm: 'h-9 rounded-md px-3',
        default: 'native:px-5 native:py-3 h-12 px-4 py-2',
        lg: 'h-14 rounded-md px-8',
        icon: 'h-10 w-10',
        'icon-lg': 'h-12 w-12',
        'icon-xl': 'h-14 w-14'
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
        sm: '',
        lg: 'native:text-lg',
        icon: '',
        'icon-lg': '',
        'icon-xl': ''
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
);

const activityIndicatorColorVariants = cva('', {
  variants: {
    variant: {
      default: getThemeColor('primary-foreground'),
      destructive: getThemeColor('destructive-foreground'),
      outline: getThemeColor('accent-foreground'),
      secondary: getThemeColor('secondary-foreground'),
      ghost: getThemeColor('accent-foreground'),
      link: getThemeColor('primary-foreground')
    }
  },
  defaultVariants: {
    variant: 'default'
  }
});

type ButtonProps = React.ComponentPropsWithoutRef<typeof Pressable> &
  VariantProps<typeof buttonVariants> & {
    loading?: boolean;
  };

const Button = React.forwardRef<
  React.ComponentRef<typeof Pressable>,
  ButtonProps
>(({ children, className, variant, size, ...props }, ref) => {
  return (
    <TextClassContext.Provider
      value={buttonTextVariants({
        variant,
        size,
        className: 'web:pointer-events-none'
      })}
    >
      <Pressable
        className={cn(
          'flex-row items-center gap-2',
          props.disabled ||
            (props.loading && 'opacity-50 web:pointer-events-none'),
          buttonVariants({ variant, size, className })
        )}
        ref={ref}
        role="button"
        {...props}
      >
        <>
          {props.loading && (
            <ActivityIndicator
              size="small"
              color={activityIndicatorColorVariants({ variant })}
            />
          )}
          {children}
        </>
      </Pressable>
    </TextClassContext.Provider>
  );
});
Button.displayName = 'Button';

export { Button, buttonTextVariants, buttonVariants };
export type { ButtonProps };
