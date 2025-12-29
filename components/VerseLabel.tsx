import { AlertCircleIcon } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';
import { Icon } from './ui/icon';
import { Text } from './ui/text';

interface VerseLabelProps {
  from?: number;
  to?: number;
  label: string;
  className?: string;
  largeText?: boolean;
}

export function VerseLabel({
  from,
  to,
  label,
  className = '',
  largeText = false
}: VerseLabelProps) {
  const hasNumbers = from !== undefined || to !== undefined;

  const getText = () => {
    // No numbers provided
    if (!hasNumbers) {
      return `No label assigned`;
    }

    // Only one number or both are the same
    if (from === to || from === undefined || to === undefined) {
      const value = from ?? to;
      return `${label}:${value}`;
    }

    // Range of numbers
    return `${label}:${from}-${to}`;
  };

  if (!hasNumbers) {
    // No assigned - warning style with amber/orange tones
    return (
      <View
        className={`w-full items-center ${className}`}
        style={{ marginTop: -12 }}
      >
        <View className="flex-row items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1">
          <Icon as={AlertCircleIcon} size={14} className="text-amber-600/70" />
          <Text
            className={`${
              largeText ? 'text-sm' : 'text-xs'
            } font-medium text-amber-600/80`}
          >
            {getText()}
          </Text>
        </View>
      </View>
    );
  }

  // Has numbers - pill style
  return (
    <View
      className={`w-full items-center ${className}`}
      style={{ marginTop: -12 }}
    >
      <View className="flex flex-row items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1">
        <Text
          className={`${
            largeText ? 'text-sm' : 'text-xs'
          } font-semibold text-primary`}
        >
          {getText()}
        </Text>
      </View>
    </View>
  );
}
