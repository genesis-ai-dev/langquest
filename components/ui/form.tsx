import * as React from 'react';
import type {
  ControllerProps,
  ControllerRenderProps,
  FieldPath,
  FieldValues
} from 'react-hook-form';
import {
  Controller,
  FormProvider,
  useFormContext,
  useFormState
} from 'react-hook-form';

import { Label } from '@/components/ui/label';
import { cn, getThemeColor } from '@/utils/styleUtils';
import type { ViewProps } from 'react-native';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { buttonTextVariants, buttonVariants } from './button';
import type { Option } from './select';
import { getOptionFromValue } from './select';
import * as Slot from './slot';
import { Text, TextClassContext } from './text';

const Form = FormProvider;

interface FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> {
  name: TName;
}

const FormFieldContext = React.createContext<FormFieldContextValue | undefined>(
  undefined
);

const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  ...props
}: ControllerProps<TFieldValues, TName>) => {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
};

export const transformInputProps = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>(
  props: ControllerRenderProps<TFieldValues, TName>
) => {
  const { disabled, ...rest } = props;
  return {
    ...rest,
    onChangeText: props.onChange,
    editable: !disabled
  };
};

export const transformSelectProps = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>(
  props: ControllerRenderProps<TFieldValues, TName>,
  valueExtractor?: (value: TFieldValues[TName]) => Option
) => {
  const { value, onChange, ...rest } = props;
  return {
    ...rest,
    onValueChange: (option: Option) => {
      onChange(option?.value);
    },
    value: valueExtractor
      ? (valueExtractor(value) ?? { value: '', label: '' })
      : getOptionFromValue(value)
  };
};

export const transformSwitchProps = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>(
  props: ControllerRenderProps<TFieldValues, TName>
) => {
  const { value, onChange, ...rest } = props;
  return { ...rest, onCheckedChange: onChange, checked: !!value };
};

const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext);
  const itemContext = React.useContext(FormItemContext);
  const { control, getFieldState } = useFormContext();
  const formState = useFormState({ control });

  if (!fieldContext) {
    throw new Error('useFormField should be used within <FormField>');
  }

  const fieldState = getFieldState(fieldContext.name, formState);
  const { id } = itemContext;

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState
  };
};

interface FormItemContextValue {
  id: string;
}

const FormItemContext = React.createContext<FormItemContextValue>(
  {} as FormItemContextValue
);

const FormItem = React.forwardRef<View, ViewProps>(
  ({ className, ...props }, ref) => {
    const id = React.useId();

    return (
      <FormItemContext.Provider value={{ id }}>
        <View
          ref={ref}
          className={cn('flex flex-col gap-2', className)}
          {...props}
        />
      </FormItemContext.Provider>
    );
  }
);
FormItem.displayName = 'FormItem';

const FormLabel = React.forwardRef<
  React.ComponentRef<typeof Label>,
  React.ComponentPropsWithoutRef<typeof Label>
>(({ className, ...props }, ref) => {
  const { error, formItemId } = useFormField();

  return (
    <Label
      ref={ref}
      className={cn('native:text-sm', error && 'text-destructive', className)}
      htmlFor={formItemId}
      {...props}
    />
  );
});
FormLabel.displayName = 'FormLabel';

const FormControl = React.forwardRef<
  React.ComponentRef<typeof Slot.Input>,
  React.ComponentPropsWithoutRef<typeof Slot.Input>
>(({ ...props }, ref) => {
  const { error, formItemId, formDescriptionId, formMessageId } =
    useFormField();

  return (
    <Slot.Input
      ref={ref}
      id={formItemId}
      aria-describedby={
        !error
          ? `${formDescriptionId}`
          : `${formDescriptionId} ${formMessageId}`
      }
      aria-invalid={!!error}
      {...props}
    />
  );
});
FormControl.displayName = 'FormControl';

const FormDescription = React.forwardRef<
  React.ComponentRef<typeof Text>,
  React.ComponentPropsWithoutRef<typeof Text>
>(({ className, ...props }, ref) => {
  const { formDescriptionId } = useFormField();

  return (
    <Text
      ref={ref}
      id={formDescriptionId}
      className={cn('text-[0.8rem] text-muted-foreground', className)}
      {...props}
    />
  );
});
FormDescription.displayName = 'FormDescription';

const FormMessage = React.forwardRef<
  React.ComponentRef<typeof Text>,
  React.ComponentPropsWithoutRef<typeof Text>
>(({ className, children, ...props }, ref) => {
  const { error, formMessageId } = useFormField();
  const body = error ? String(error.message ?? '') : children;

  if (!body) {
    return null;
  }

  return (
    <Text
      ref={ref}
      id={formMessageId}
      className={cn('text-[0.8rem] font-medium text-destructive', className)}
      {...props}
    >
      {body}
    </Text>
  );
});
FormMessage.displayName = 'FormMessage';

const FormSubmit = React.forwardRef<
  React.ComponentRef<typeof Slot.Pressable>,
  React.ComponentPropsWithoutRef<typeof Slot.Pressable> & {
    asChild?: boolean;
    activityIndicatorClassName?: string;
    activityIndicatorColor?: string;
  }
>(
  (
    {
      children,
      asChild,
      className,
      activityIndicatorClassName,
      activityIndicatorColor,
      ...props
    },
    ref
  ) => {
    const { control } = useFormContext();
    const { isValid, isSubmitting } = useFormState({ control });
    const isDisabled = !isValid || isSubmitting || props.disabled;

    const Component = asChild ? Slot.Pressable : Pressable;

    return (
      <TextClassContext.Provider value={buttonTextVariants({ className })}>
        <Component
          ref={ref}
          disabled={isDisabled}
          {...props}
          className={cn(
            'flex flex-row items-center gap-2',
            isDisabled &&
              'opacity-50 hover:opacity-50 web:pointer-events-none web:cursor-default',
            buttonVariants({ className })
          )}
        >
          <>
            {isSubmitting && (
              <ActivityIndicator
                size="small"
                color={activityIndicatorColor || getThemeColor('secondary')}
                className={activityIndicatorClassName}
              />
            )}
            {children}
          </>
        </Component>
      </TextClassContext.Provider>
    );
  }
);
FormSubmit.displayName = 'FormSubmit';

export {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormSubmit,
  useFormField
};
