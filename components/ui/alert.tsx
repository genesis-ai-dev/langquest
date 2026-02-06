import { Icon } from '@/components/ui/icon';
import { Text, TextClassContext } from '@/components/ui/text';
import { cn } from '@/utils/styleUtils';
import type { LucideIcon } from 'lucide-react-native';
import * as React from 'react';
import type { ViewProps } from 'react-native';
import { View } from 'react-native';

function Alert({
  className,
  variant,
  children,
  icon,
  iconClassName,
  ...props
}: ViewProps &
  React.RefAttributes<View> & {
    icon: LucideIcon;
    variant?: 'default' | 'destructive';
    iconClassName?: string;
  }) {
  return (
    <TextClassContext.Provider
      value={cn(
        'text-sm text-foreground',
        variant === 'destructive' && 'text-destructive',
        className
      )}
    >
      <View
        role="alert"
        className={cn(
          'relative flex w-full flex-row items-start gap-3 rounded-lg border border-border bg-card px-4 py-3',
          variant === 'destructive' &&
            'border-destructive/30 bg-destructive/10',
          className
        )}
        {...props}
      >
        <Icon as={icon} className={iconClassName} />
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
        className
      )}
      {...props}
    />
  );
}

export { Alert, AlertDescription, AlertTitle };
