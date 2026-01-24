import {
  AlertCircleIcon,
  MoveVerticalIcon,
  PencilIcon
} from 'lucide-react-native';
import React from 'react';
import { Pressable, View } from 'react-native';
import { Icon } from './ui/icon';
import { Text } from './ui/text';

interface VerseSeparatorProps {
  from?: number;
  to?: number;
  label: string;
  className?: string;
  editable?: boolean;
  largeText?: boolean;
  onPress?: () => void;
  // Selection for recording: clicking the separator text selects it for recording
  isSelectedForRecording?: boolean;
  onSelectForRecording?: () => void;
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
  largeText = false,
  onPress,
  isSelectedForRecording = false,
  onSelectForRecording,
  dragHandleComponent: DragHandleComponent,
  dragHandleProps
}: VerseSeparatorProps) {
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
    // Background changes when selected for recording
    const unassignedBgClass = isSelectedForRecording
      ? 'border-primary bg-primary/20'
      : 'border-amber-500/30 bg-amber-500/10';

    return (
      <View className={`w-full flex-row items-center py-1 ${className}`}>
        <View
          className={`h-px flex-1 ${isSelectedForRecording ? 'bg-primary/20' : 'bg-amber-500/20'}`}
        />
        <View
          className={`mx-2 flex-row items-center gap-1.5 rounded-full border px-3 py-1 ${unassignedBgClass}`}
        >
          <Icon
            as={AlertCircleIcon}
            size={14}
            className={
              isSelectedForRecording ? 'text-primary' : 'text-amber-600/70'
            }
          />
          {/* Text is clickable for recording selection when onSelectForRecording is provided */}
          {onSelectForRecording ? (
            <Pressable
              onPress={onSelectForRecording}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text
                className={`${
                  largeText ? 'text-sm' : 'text-xs'
                } font-medium ${isSelectedForRecording ? 'text-primary underline' : 'text-amber-600/80'}`}
              >
                {getText()}
              </Text>
            </Pressable>
          ) : (
            <Text
              className={`${
                largeText ? 'text-sm' : 'text-xs'
              } font-medium text-amber-600/80`}
            >
              {getText()}
            </Text>
          )}
        </View>
        <View
          className={`h-px flex-1 ${isSelectedForRecording ? 'bg-primary/20' : 'bg-amber-500/20'}`}
        />
      </View>
    );
  }

  // Has numbers - pill style
  // Background changes when selected for recording
  const pillBgClass = isSelectedForRecording
    ? 'bg-primary/30 border border-primary'
    : 'bg-primary/10';

  const pillContent = (
    <View
      className={`mx-2 flex flex-row items-center gap-1.5 rounded-full px-3 py-1 ${pillBgClass}`}
    >
      {DragHandleComponent && editable && (
        <View className="flex size-5 items-center justify-center overflow-hidden rounded-full">
          <Icon as={MoveVerticalIcon} size={14} className="text-primary" />
        </View>
      )}
      {/* Text is clickable for recording selection when onSelectForRecording is provided */}
      {onSelectForRecording ? (
        <Pressable
          onPress={onSelectForRecording}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text
            className={`${
              largeText ? 'text-sm' : 'text-xs'
            } font-semibold text-primary ${isSelectedForRecording ? 'underline' : ''}`}
          >
            {getText()}
          </Text>
        </Pressable>
      ) : (
        <Text
          className={`${
            largeText ? 'text-sm' : 'text-xs'
          } font-semibold text-primary`}
        >
          {getText()}
        </Text>
      )}
      {/* Edit icon - only shown when editable and onPress is provided */}
      {editable && onPress && (
        <Pressable
          onPress={onPress}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className="ml-1"
        >
          <Icon as={PencilIcon} size={12} className="text-primary/70" />
        </Pressable>
      )}
    </View>
  );

  return (
    <View className={`w-full flex-row items-center py-1 ${className}`}>
      <View className="h-px flex-1 bg-primary/20" />
      {DragHandleComponent && editable ? (
        <DragHandleComponent {...dragHandleProps}>
          {pillContent}
        </DragHandleComponent>
      ) : (
        pillContent
      )}
      <View className="h-px flex-1 bg-primary/20" />
    </View>
  );
}
