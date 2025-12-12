import { BookmarkIcon } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';
import { Button } from './ui/button';
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
    <View className={`items-center ${className}`}>
      <Button
        variant="ghost"
        size="sm"
        onPress={onPress}
        disabled={disabled}
        className="flex-row items-center gap-1 border border-primary px-4"
      >
        <Icon as={BookmarkIcon} size={14} className="text-primary" />
        <Text className="text-xs text-primary">Add Verse</Text>
      </Button>
    </View>
  );
}
