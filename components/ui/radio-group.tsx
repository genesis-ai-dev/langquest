import { cn } from '@/utils/styleUtils';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import { Label } from './label';

interface RadioGroupContextValue {
  value: string | undefined;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(
  null
);

function useRadioGroupContext() {
  const context = React.useContext(RadioGroupContext);
  if (!context) {
    throw new Error(
      'RadioGroup compound components must be used within RadioGroup'
    );
  }
  return context;
}

interface RadioGroupProps {
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

const RadioGroup = React.forwardRef<View, RadioGroupProps>(
  ({ className, value, onValueChange, disabled, children }, ref) => {
    return (
      <RadioGroupContext.Provider
        value={{
          value,
          onValueChange: onValueChange ?? (() => undefined),
          disabled
        }}
      >
        <View ref={ref} className={cn('gap-2', className)}>
          {children}
        </View>
      </RadioGroupContext.Provider>
    );
  }
);
RadioGroup.displayName = 'RadioGroup';

interface RadioGroupItemProps {
  value: string;
  label?: string;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const RadioGroupItem = React.forwardRef<View, RadioGroupItemProps>(
  ({ className, value, label, disabled: itemDisabled, children }, ref) => {
    const {
      value: selectedValue,
      onValueChange,
      disabled
    } = useRadioGroupContext();
    const isSelected = selectedValue === value;
    const isDisabled = disabled || itemDisabled;

    return (
      <Pressable
        ref={ref}
        disabled={isDisabled}
        onPress={() => !isDisabled && onValueChange(value)}
        className={cn(
          'flex-row items-center gap-3 rounded-lg border border-input bg-background px-4 py-3 active:bg-accent web:ring-offset-background web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-ring web:focus-visible:ring-offset-2',
          isSelected && 'border-primary bg-accent',
          isDisabled && 'opacity-50',
          className
        )}
      >
        <View
          className={cn(
            'aspect-square h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
            isSelected ? 'border-primary bg-primary' : 'border-input'
          )}
        >
          {isSelected && (
            <View className="h-2.5 w-2.5 rounded-full bg-primary-foreground" />
          )}
        </View>
        {label ? (
          <Label className="native:text-sm flex-1 text-sm web:cursor-pointer">
            {label}
          </Label>
        ) : children ? (
          <View className="flex-1">{children}</View>
        ) : null}
      </Pressable>
    );
  }
);
RadioGroupItem.displayName = 'RadioGroupItem';

export { RadioGroup, RadioGroupItem };
