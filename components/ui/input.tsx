import { cn, getThemeColor } from '@/utils/styleUtils';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import type { LucideIcon } from 'lucide-react-native';
import { EyeIcon, EyeOffIcon } from 'lucide-react-native';
import * as React from 'react';
import type { TextInputProps } from 'react-native';
import { Pressable, TextInput, View } from 'react-native';
import { Icon } from './icon';

const inputVariants = cva(
  'native:text-lg flex flex-row justify-center rounded-lg border border-border bg-input text-base text-foreground web:flex web:w-full web:ring-offset-background web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-ring web:focus-visible:ring-offset-2 lg:text-sm',
  {
    variants: {
      size: {
        sm: 'native:h-12 h-8',
        default: 'native:h-14 h-10',
        lg: 'native:h-16 h-12'
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
        sm: 'native:text-sm native:leading-[1.25] text-sm',
        default: 'native:text-base native:leading-[1.25] text-base',
        lg: 'native:text-lg native:leading-[1.25]'
      }
    },
    defaultVariants: {
      size: 'default'
    }
  }
);

const iconSizeVariants = cva('text-muted-foreground', {
  variants: {
    size: {
      sm: 'size-4',
      default: 'size-5',
      lg: 'size-6'
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

const prefixStyledVariants = cva('border-r border-border', {
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

const suffixStyledVariants = cva('', {
  variants: {
    size: {
      sm: 'flex w-fit items-center justify-center border-l border-muted p-2 text-input',
      default:
        'flex w-fit items-center justify-center border-l border-muted p-3 text-input',
      lg: 'flex w-fit items-center justify-center border-l border-muted p-4 text-input'
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
  suffix?: React.ReactNode;
  prefixStyling?: boolean;
  suffixStyling?: boolean;
  hideEye?: boolean;
  mask?: boolean;
}

const Input = React.forwardRef<React.ElementRef<typeof TextInput>, InputProps>(
  (
    {
      className,
      placeholderClassName,
      prefix,
      suffix,
      prefixStyling = true,
      suffixStyling = true,
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
          props.editable === false && 'opacity-50 web:cursor-not-allowed',
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
              'flex items-center justify-center text-input',
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
                className={iconSizeVariants({ size })}
              />
            )}
          </View>
        )}
        <TextInput
          ref={ref}
          // className={cn(
          //   'web:flex h-10 native:h-12 web:w-full rounded-md border border-input bg-background px-3 web:py-2 text-base lg:text-sm native:text-lg native:leading-[1.25] text-foreground web:ring-offset-background file:border-0 file:bg-transparent file:font-medium web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-ring web:focus-visible:ring-offset-2',
          //   props.editable === false && 'opacity-50 web:cursor-not-allowed',
          //   className
          // )}
          className={cn(inputTextVariants({ size }))}
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
          <View className={cn(suffixStyling && suffixStyledVariants({ size }))}>
            {suffix}
          </View>
        )}
      </View>
    );
  }
);

Input.displayName = 'Input';

export { Input };
