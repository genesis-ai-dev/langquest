import { Eye } from '@/lib/icons/Eye';
import { EyeOff } from '@/lib/icons/EyeOff';
import { cn } from '@/lib/utils';
import * as React from 'react';
import type { TextInputProps } from 'react-native';
import { Pressable, TextInput, View } from 'react-native';

interface InputProps extends TextInputProps {
  prefix?: React.ReactNode;
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
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = React.useState(false);

    const EyeIcon = showPassword ? EyeOff : Eye;

    return (
      <View
        className={cn(
          'flex flex-row gap-4 justify-center web:flex h-10 native:h-12 web:w-full rounded-lg border border-input bg-background text-base lg:text-sm native:text-lg native:leading-[1.25] text-foreground web:ring-offset-background web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-ring web:focus-visible:ring-offset-2',
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
              prefixStyling &&
                'border-r border-muted w-12 flex items-center justify-center text-input'
            )}
          >
            {prefix}
          </View>
        )}
        <TextInput
          ref={ref}
          // className={cn(
          //   'web:flex h-10 native:h-12 web:w-full rounded-md border border-input bg-background px-3 web:py-2 text-base lg:text-sm native:text-lg native:leading-[1.25] text-foreground web:ring-offset-background file:border-0 file:bg-transparent file:font-medium web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-ring web:focus-visible:ring-offset-2',
          //   props.editable === false && 'opacity-50 web:cursor-not-allowed',
          //   className
          // )}
          className={cn(
            'flex flex-1 file:border-0 file:bg-transparent file:font-medium text-foreground py-2',
            'placeholder:text-muted-foreground'
          )}
          placeholderClassName={cn(
            'text-muted-foreground',
            placeholderClassName
          )}
          // TODO: change this color to the theme color whenever it changes in the global.css file
          selectionColor="hsl(251.9 55.25% 57.06%)"
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
            <EyeIcon className="text-muted-foreground" size={22} />
          </Pressable>
        )}
        {suffix && (
          <View
            className={cn(
              suffixStyling &&
                'border-l border-muted w-fit flex items-center justify-center p-3 text-input'
            )}
          >
            {prefix}
          </View>
        )}
      </View>
    );
  }
);

Input.displayName = 'Input';

export { Input };
