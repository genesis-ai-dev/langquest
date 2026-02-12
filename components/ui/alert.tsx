import { Icon } from '@/components/ui/icon';
import { Text, TextClassContext } from '@/components/ui/text';
import { cn } from '@/utils/styleUtils';
import type { LucideIconName } from '@react-native-vector-icons/lucide';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import * as React from 'react';
import type { ViewProps } from 'react-native';
import { View } from 'react-native';

const alertVariants = cva(
  'relative flex w-full flex-row items-start gap-3 rounded-lg border border-border bg-card px-4 py-3',
  {
    variants: {
      variant: {
        default: '',
        destructive: 'border-destructive/30 bg-destructive/10',
        warn: 'border-warning/30 bg-warning/10'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
);

const alertTextVariants = cva('text-sm text-foreground', {
  variants: {
    variant: {
      default: '',
      destructive: 'text-destructive',
      warn: 'text-warning'
    }
  },
  defaultVariants: {
    variant: 'default'
  }
});

type AlertProps = ViewProps &
  React.RefAttributes<View> & {
    icon: LucideIconName;
    iconClassName?: string;
  } & VariantProps<typeof alertVariants>;

function Alert({
  className,
  variant,
  children,
  icon,
  iconClassName,
  ...props
}: AlertProps) {
  return (
    <TextClassContext.Provider value={alertTextVariants({ variant })}>
      <View
        role="alert"
        className={cn(alertVariants({ variant }), className)}
        {...props}
      >
        <Icon name={icon} className={iconClassName} />
        <View className="flex flex-1 flex-col">{children}</View>
      </View>
    </TextClassContext.Provider>
  );
}

function AlertTitle({
  className,
  ...props
}: React.ComponentProps<typeof Text> & React.RefAttributes<Text>) {
  return (
    <Text
      className={cn('font-medium leading-[1.3] tracking-tight', className)}
      {...props}
    />
  );
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<typeof Text> & React.RefAttributes<Text>) {
  const textClass = React.useContext(TextClassContext);
  return (
    <Text
      className={cn(
        'text-sm leading-relaxed text-muted-foreground',
        textClass?.includes('text-destructive') && 'text-destructive/90',
        textClass?.includes('text-warning') && 'text-warning/90',
        className
      )}
      {...props}
    />
  );
}

export {
  Alert,
  AlertDescription,
  alertTextVariants,
  AlertTitle,
  alertVariants
};
export type { AlertProps };
