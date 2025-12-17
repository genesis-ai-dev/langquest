import { AlertCircleIcon, MoveVerticalIcon } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';
import { Icon } from './ui/icon';
import { Text } from './ui/text';

interface VerseSeparatorProps {
  from?: number;
  to?: number;
  label: string;
  className?: string;
  editable?: boolean;
  dragHandleComponent?: React.ComponentType<{
    mode?: 'fixed-order' | 'draggable';
    children?: React.ReactNode;
  }>;
  dragHandleProps?: {
    mode?: 'fixed-order' | 'draggable';
  };
}

export function VerseSeparator({
  from,
  to,
  label,
  className = '',
  editable = false,
  dragHandleComponent: DragHandleComponent,
  dragHandleProps
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
    // No assigned - warning style with amber/orange tones
    return (
      <View className={`w-full flex-row items-center py-1 ${className}`}>
        <View className="h-px flex-1 bg-amber-500/20" />
        <View className="mx-2 flex-row items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1">
          <Icon as={AlertCircleIcon} size={14} className="text-amber-600/70" />
          <Text className="text-[11px] font-medium text-amber-600/80">
            {getText()}
          </Text>
        </View>
        <View className="h-px flex-1 bg-amber-500/20" />
      </View>
    );
  }

  // Has numbers - pill style
  return (
    <View className={`w-full flex-row items-center py-1 ${className}`}>
      <View className="h-px flex-1 bg-primary/20" />
      <View className="mx-2 flex flex-row items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1">
        {DragHandleComponent && editable && (
          <DragHandleComponent {...dragHandleProps}>
            <View className="flex size-4 items-center justify-center overflow-hidden rounded-lg bg-primary-foreground/40">
              <Icon as={MoveVerticalIcon} size={12} className="text-primary" />
            </View>
          </DragHandleComponent>
        )}
        <Text className="text-[11px] font-semibold text-primary">
          {getText()}
        </Text>
      </View>
      <View className="h-px flex-1 bg-primary/20" />
    </View>
  );
}
