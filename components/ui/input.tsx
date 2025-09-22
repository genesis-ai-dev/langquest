import { cn, getThemeColor } from '@/utils/styleUtils';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import type { LucideIcon } from 'lucide-react-native';
import { EyeIcon, EyeOffIcon } from 'lucide-react-native';
import * as React from 'react';
import type { TextInputProps } from 'react-native';
import { Platform, Pressable, TextInput, View } from 'react-native';
import { Icon } from './icon';

const inputVariants = cva(
  'flex w-full min-w-48 flex-row items-center rounded-md border border-border bg-input text-foreground shadow-sm shadow-black/5 web:w-full',
  {
    variants: {
      size: {
        sm: 'h-12',
        default: 'h-14',
        lg: 'h-16'
      }
    },
    defaultVariants: {
      size: 'default'
    }
  }
);

const inputTextVariants = cva(
  [
    'flex flex-1 text-foreground file:border-0 file:bg-transparent file:font-medium',
    'placeholder:text-muted-foreground'
  ],
  {
    variants: {
      size: {
        sm: 'native:leading-4 text-sm',
        default: 'native:leading-5 text-base',
        lg: 'native:leading-5 text-lg'
      }
    },
    defaultVariants: {
      size: 'default'
    }
  }
);

const iconSizeVariants = cva(undefined, {
  variants: {
    size: {
      sm: 16,
      default: 20,
      lg: 24
    }
  },
  defaultVariants: {
    size: 'default'
  }
});

const prefixUnstyledVariants = cva('', {
  variants: {
    size: {
      sm: 'w-10',
      default: 'w-12',
      lg: 'w-14'
    }
  },
  defaultVariants: {
    size: 'default'
  }
});

const prefixStyledVariants = cva('h-full border-r border-border', {
  variants: {
    size: {
      sm: 'mr-3 w-10',
      default: 'mr-4 w-12',
      lg: 'mr-4 w-14'
    }
  },
  defaultVariants: {
    size: 'default'
  }
});

const suffixUnstyledVariants = cva('', {
  variants: {
    size: {
      sm: 'w-10',
      default: 'w-12',
      lg: 'w-14'
    }
  },
  defaultVariants: {
    size: 'default'
  }
});

const suffixStyledVariants = cva('h-full border-l border-border', {
  variants: {
    size: {
      sm: 'ml-3 w-10',
      default: 'ml-4 w-12',
      lg: 'ml-4 w-14'
    }
  },
  defaultVariants: {
    size: 'default'
  }
});

interface InputProps
  extends TextInputProps,
    VariantProps<typeof inputVariants> {
  prefix?: React.ReactNode | LucideIcon;
  suffix?: React.ReactNode | LucideIcon;
  prefixStyling?: boolean;
  suffixStyling?: boolean;
  hideEye?: boolean;
  mask?: boolean;
}

const Input = React.forwardRef<
  React.ComponentRef<typeof TextInput>,
  InputProps
>(
  (
    {
      className,
      placeholderClassName,
      prefix,
      suffix,
      prefixStyling = false,
      suffixStyling = false,
      hideEye,
      secureTextEntry,
      mask,
      size,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = React.useState(false);

    return (
      <View
        className={cn(
          inputVariants({ size }),
          props.editable === false &&
            cn(
              'opacity-50',
              Platform.select({
                web: 'disabled:pointer-events-none disabled:cursor-not-allowed'
              })
            ),
          !prefix && 'pl-3',
          !suffix && 'pr-3',
          className
        )}
        accessibilityLabel={
          mask || secureTextEntry ? 'ph-no-capture' : undefined
        }
      >
        {prefix && (
          <View
            className={cn(
              'flex flex-row items-center justify-center py-1 text-input',
              prefixStyling
                ? prefixStyledVariants({ size })
                : prefixUnstyledVariants({ size })
            )}
          >
            {prefix && React.isValidElement(prefix) ? (
              prefix
            ) : (
              <Icon
                as={prefix as LucideIcon}
                className="text-muted-foreground"
                size={iconSizeVariants({ size })}
              />
            )}
          </View>
        )}
        <TextInput
          ref={ref}
          className={cn(
            inputTextVariants({ size }),
            Platform.select({
              web: cn(
                'outline-none transition-[color,box-shadow] selection:bg-primary selection:text-primary-foreground md:text-sm',
                'placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
                'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive py-1'
              )
            })
          )}
          placeholderClassName={cn(
            'text-muted-foreground',
            placeholderClassName
          )}
          // TODO: change this color to the theme color whenever it changes in the global.css file
          selectionColor={getThemeColor('primary')}
          // @ts-expect-error - onChangeText is not passed from react-hook-form
          onChangeText={props.onChange}
          secureTextEntry={secureTextEntry && !showPassword}
          {...props}
        />
        {!hideEye && secureTextEntry && (
          <Pressable
            className="flex items-center justify-center"
            onPress={() => setShowPassword(!showPassword)}
          >
            <Icon
              as={showPassword ? EyeOffIcon : EyeIcon}
              className={iconSizeVariants({ size })}
            />
          </Pressable>
        )}
        {suffix && (
          <View
            className={cn(
              'flex flex-row items-center justify-center py-1 text-input',
              suffixStyling
                ? suffixStyledVariants({ size })
                : suffixUnstyledVariants({ size })
            )}
          >
            {suffix && React.isValidElement(suffix) ? (
              suffix
            ) : (
              <Icon
                as={suffix as LucideIcon}
                className={iconSizeVariants({ size })}
              />
            )}
          </View>
        )}
      </View>
    );
  }
);

Input.displayName = 'Input';

export { Input };
