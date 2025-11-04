/**
 * PendingCard - Shows recording/saving state
 *
 * Displays while recording is in progress or saving to database
 */

import { Text } from '@/components/ui/text';
import { getThemeColor } from '@/utils/styleUtils';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import type { PendingSegment } from '../hooks/useRecordingState';

interface PendingCardProps {
  pending: PendingSegment;
  animation?: {
    opacity: SharedValue<number>;
    translateY: SharedValue<number>;
  };
}

export const PendingCard = React.memo(function PendingCard({
  pending,
  animation
}: PendingCardProps) {
  const statusText =
    pending.status === 'recording'
      ? 'Recording… Hold to continue'
      : pending.status === 'saving'
        ? 'Saving to library…'
        : pending.status === 'ready'
          ? 'Finalizing…'
          : 'Error - Tap to retry';

  const borderColor =
    pending.status === 'recording' || pending.status === 'saving'
      ? 'border-primary bg-primary/10'
      : pending.status === 'error'
        ? 'border-destructive bg-destructive/10'
        : 'border-border bg-card';

  // ✅ Use Reanimated's useAnimatedStyle for SharedValue compatibility
  const animatedStyle = useAnimatedStyle(() => {
    if (!animation) {
      return {
        opacity: 1,
        transform: [{ translateY: 0 }]
      };
    }

    return {
      opacity: animation.opacity.value,
      transform: [{ translateY: animation.translateY.value }]
    };
  }, [animation]);

  return (
    <Animated.View
      className={`rounded-lg border p-3 ${borderColor}`}
      style={animatedStyle}
    >
      <View className="flex-row items-center gap-3">
        {/* Loading spinner for active states */}
        {(pending.status === 'recording' || pending.status === 'saving') && (
          <View className="h-8 w-8 items-center justify-center">
            <ActivityIndicator color={getThemeColor('primary')} />
          </View>
        )}
        <View className="flex-1">
          <Text className="text-base font-bold text-primary">
            {pending.name}
          </Text>
          <Text className="text-sm text-muted-foreground">{statusText}</Text>
        </View>
      </View>
    </Animated.View>
  );
});
