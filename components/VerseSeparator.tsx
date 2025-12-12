import { CircleDashedIcon } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';
import { Icon } from './ui/icon';
import { Text } from './ui/text';

interface VerseSeparatorProps {
  from?: number;
  to?: number;
  label: string;
  className?: string;
}

export function VerseSeparator({
  from,
  to,
  label,
  className = ''
}: VerseSeparatorProps) {
  const hasNumbers = from !== undefined || to !== undefined;

  const getText = () => {
    // No numbers provided
    if (!hasNumbers) {
      return `No ${label} assigned`;
    }

    // Only one number or both are the same
    if (from === to || from === undefined || to === undefined) {
      const value = from ?? to;
      return `${label} ${value}`;
    }

    // Range of numbers
    return `${label} ${from}-${to}`;
  };

  if (!hasNumbers) {
    // No assigned - ghost pill with dashed icon
    return (
      <View className={`w-full flex-row items-center py-2 ${className}`}>
        <View className="h-px flex-1 bg-muted-foreground/10" />
        <View className="mx-2 flex-row items-center gap-2 rounded-full border border-dashed border-muted-foreground/30 px-3 py-1.5">
          <Icon
            as={CircleDashedIcon}
            size={14}
            className="text-muted-foreground/40"
          />
          <Text className="text-xs text-muted-foreground/50">{getText()}</Text>
        </View>
        <View className="h-px flex-1 bg-muted-foreground/10" />
      </View>
    );
  }

  // Has numbers - pill style
  return (
    <View className={`w-full flex-row items-center py-2 ${className}`}>
      <View className="h-px flex-1 bg-primary/20" />
      <View className="mx-2 rounded-full bg-primary/10 px-4 py-1.5">
        <Text className="text-xs font-semibold text-primary">{getText()}</Text>
      </View>
      <View className="h-px flex-1 bg-primary/20" />
    </View>
  );
}
