import { cn } from '@/utils/styleUtils';
import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Text } from './ui/text';

interface VersePillProps {
  text: string;
  className?: string;
  largeText?: boolean;
  isHighlighted?: boolean;
  onPress?: () => void;
}

const VersePillComponent = ({
  text,
  className = '',
  largeText = false,
  isHighlighted = false,
  onPress
}: VersePillProps) => {
  const content = (
    <View
      className={`w-full flex-row items-center justify-center py-1 ${className}`}
    >
      <View
        className={cn(
          'flex flex-row items-center gap-1.5 rounded-full border-2 bg-primary/10 px-3 py-1',
          isHighlighted ? 'border-primary' : 'border-transparent'
        )}
      >
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

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

/**
 * Memoized VersePill component
 * Only re-renders when props change
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
      prevProps.largeText === nextProps.largeText &&
      prevProps.isHighlighted === nextProps.isHighlighted &&
      prevProps.onPress === nextProps.onPress
    );
  }
);

VersePill.displayName = 'VersePill';
