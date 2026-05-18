import { cn } from '@/utils/styleUtils';
import { ChevronRight } from 'lucide-react-native';
import React from 'react';
import { Pressable, View } from 'react-native';
import { Icon } from './ui/icon';
import { Text } from './ui/text';

interface RecordButtonProps {
  onPress: () => void;
  disabled?: boolean;
  className?: string;
}

export function RecordButton({
  onPress,
  disabled = false,
  className
}: RecordButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      className={cn(
        'flex-row items-center gap-4 self-center rounded-full bg-primary px-3 py-1.5 active:opacity-90',
        disabled && 'opacity-50',
        className
      )}
    >
      <View className="h-5 w-5 items-center justify-center rounded-full bg-white">
        <View className="h-2.5 w-2.5 rounded-full bg-destructive" />
      </View>

      <View className="items-center justify-center">
        <Text className="text-center text-xs font-semibold text-secondary">
          START RECORDING
        </Text>
      </View>

      <Icon as={ChevronRight} size={16} className="text-secondary" />
    </Pressable>
  );
}
