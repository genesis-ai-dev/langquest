import { cn, useNotoSans } from '@/utils/styleUtils';
import * as LabelPrimitive from '@rn-primitives/label';
import * as React from 'react';

const Label = React.forwardRef<
  LabelPrimitive.TextRef,
  LabelPrimitive.TextProps
>(
  (
    { className, onPress, onLongPress, onPressIn, onPressOut, style, ...props },
    ref
  ) => (
    <LabelPrimitive.Root
      className="web:cursor-default"
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      <LabelPrimitive.Text
        ref={ref}
        className={cn(
          'native:text-base text-sm font-medium leading-none text-foreground web:peer-disabled:cursor-not-allowed web:peer-disabled:opacity-70',
          className
        )}
        style={useNotoSans(className, style)}
        {...props}
      />
    </LabelPrimitive.Root>
  )
);
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
