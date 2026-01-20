import React from 'react';
import { View } from 'react-native';
import { Text } from './ui/text';

interface VersePillProps {
  text: string;
  className?: string;
  largeText?: boolean;
}

const VersePillComponent = ({
  text,
  className = '',
  largeText = false
}: VersePillProps) => {
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
};

/**
 * Memoized VersePill component
 * Only re-renders when text, className, or largeText changes
 *
 * Performance: Prevents unnecessary re-renders when assets list changes
 * but verse pills remain the same (common scenario in BibleRecordingView)
 */
export const VersePill = React.memo(
  VersePillComponent,
  (prevProps, nextProps) => {
    // Return TRUE if props are EQUAL (skip re-render)
    // Return FALSE if props are DIFFERENT (re-render needed)
    return (
      prevProps.text === nextProps.text &&
      prevProps.className === nextProps.className &&
      prevProps.largeText === nextProps.largeText
    );
  }
);

VersePill.displayName = 'VersePill';
