import React from 'react';
import { Pressable, View } from 'react-native';
import { Icon } from './ui/icon';
import { Text } from './ui/text';

interface AddVerseLabelButtonProps {
  onPress: () => void;
  disabled?: boolean;
  className?: string;
}

export function AddVerseLabelButton({
  onPress,
  disabled = false,
  className = ''
}: AddVerseLabelButtonProps) {
  return (
    <View className={`-mb-3 w-full flex-row items-center ${className}`}>
      {/* <View className="h-px flex-1 bg-primary/10" /> */}
      <View className="h-px flex-1" />
      <Pressable
        onPress={onPress}
        disabled={disabled}
        className={`mx-1.5 flex-row items-center gap-1.5 rounded-full border border-dashed border-primary/30 px-2.5 active:bg-primary/10 ${
          disabled ? 'opacity-40' : ''
        }`}
      >
        <Icon name="plus-circle" size={12} className="text-primary/70" />
        <Text className="text-[10.5px] font-semibold text-primary/70">
          Add verse
        </Text>
      </Pressable>
      {/* <View className="h-px flex-1 bg-primary/10" /> */}
    </View>
  );
}
