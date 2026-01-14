import React from 'react';
import { View } from 'react-native';
import { Text } from './ui/text';

interface VersePillProps {
  text: string;
  className?: string;
  largeText?: boolean;
}

export function VersePill({
  text,
  className = '',
  largeText = false
}: VersePillProps) {
  return (
    <View
      className={`w-full flex-row items-center justify-center py-1 ${className}`}
    >
      <View className="flex flex-row items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1">
        <Text
          className={`${
            largeText ? 'text-lg' : 'text-md'
          } font-semibold text-primary`}
        >
          {text}
        </Text>
      </View>
    </View>
  );
}
