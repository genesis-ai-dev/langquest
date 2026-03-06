import { cn, useThemeColor } from '@/utils/styleUtils';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import * as React from 'react';
import type { TextInputProps } from 'react-native';
import { Platform, TextInput } from 'react-native';
import { DrawerInput } from './drawer';

const textareaVariants = cva(
  'flex w-full flex-row rounded-md border border-border bg-card text-foreground shadow-sm shadow-black/5',
  {
    variants: {
      size: {
        sm: 'min-h-24 px-3 py-2 text-sm',
        default: 'min-h-32 px-3 py-2 text-base md:text-sm'
      }
    },
    defaultVariants: {
      size: 'default'
    }
  }
);

interface TextareaProps
  extends TextInputProps, VariantProps<typeof textareaVariants> {
  drawerInput?: boolean;
}

const Textarea = React.forwardRef<
  React.ComponentRef<typeof TextInput>,
  TextareaProps
>(
  (
    {
      className,
      multiline = true,
      drawerInput = true,
      numberOfLines = Platform.select({ web: 2, native: 8 }), // On web, numberOfLines also determines initial height. On native, it determines the maximum height.
      placeholderClassName,
      size,
      ...props
    },
    ref
  ) => {
    const primaryColor = useThemeColor('primary');
    const Component = drawerInput ? DrawerInput : TextInput;
    return (
      <Component
        // @ts-expect-error - ref is not passed the same type as TextInput
        ref={ref}
        className={cn(
          textareaVariants({ size }),
          'placeholder:text-muted-foreground',
          Platform.select({
            web: 'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive field-sizing-content resize-y outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed'
          }),
          props.editable === false && 'opacity-50',
          className
        )}
        placeholderClassName={cn('text-muted-foreground', placeholderClassName)}
        selectionColor={primaryColor}
        multiline={multiline}
        numberOfLines={numberOfLines}
        textAlignVertical="top"
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';

export { Textarea };
