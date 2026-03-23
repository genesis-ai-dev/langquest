import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/utils/styleUtils';
import {
  FastForwardIcon,
  PauseIcon,
  PlayIcon,
  SkipBackIcon,
  SkipForwardIcon,
  SquareIcon,
  RewindIcon
} from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type AudioControlsMode = 'individual' | 'playAll';
type ControlsPosition = 'top' | 'footer';

interface AudioPlayerControlsProps {
  mode: AudioControlsMode;
  position?: ControlsPosition;
  currentAssetName?: string | null;
  currentSegmentIndex?: number | null;
  totalSegments?: number | null;
  isPlaying: boolean;
  isPaused?: boolean;
  positionShared?: SharedValue<number>;
  durationShared?: SharedValue<number>;
  positionMs?: number;
  durationMs?: number;
  onPrevious?: () => void;
  onRewind?: () => void;
  onPlayPause?: () => void;
  onStop?: () => void;
  onForward?: () => void;
  onNext?: () => void;
  disabled?: boolean;
  className?: string;
}

export const AudioPlayerControls = React.memo(function AudioPlayerControls({
  mode,
  position = 'footer',
  currentAssetName,
  currentSegmentIndex,
  totalSegments,
  isPlaying,
  isPaused = false,
  positionShared,
  durationShared,
  positionMs = 0,
  durationMs = 0,
  onPrevious,
  onRewind,
  onPlayPause,
  onStop,
  onForward,
  onNext,
  disabled = false,
  className
}: AudioPlayerControlsProps) {
  const insets = useSafeAreaInsets();
  const isPlayAll = mode === 'playAll';
  const isActive = isPlaying || isPaused;
  const assetName = currentAssetName?.trim() || 'No audio selected';
  const shouldShowSegment =
    isPlayAll &&
    typeof currentSegmentIndex === 'number' &&
    currentSegmentIndex > 0 &&
    typeof totalSegments === 'number' &&
    totalSegments > 0;

  const fallbackProgress = React.useMemo(() => {
    if (durationMs <= 0) return 0;
    const raw = positionMs / durationMs;
    if (raw < 0) return 0;
    if (raw > 1) return 1;
    return raw;
  }, [durationMs, positionMs]);

  // Progress animation is driven by shared values when provided.
  const progressStyle = useAnimatedStyle(() => {
    'worklet';
    let progress = fallbackProgress;
    if (positionShared && durationShared && durationShared.value > 0) {
      const raw = positionShared.value / durationShared.value;
      if (raw < 0) {
        progress = 0;
      } else if (raw > 1) {
        progress = 1;
      } else {
        progress = raw;
      }
    }
    return {
      width: `${progress * 100}%`
    };
  }, [durationShared, fallbackProgress, positionShared]);

  return (
    <View
      className={cn(
        'absolute left-0 right-0 z-50 border-t border-border bg-background/95 px-4 py-3',
        position === 'top' ? 'top-0 border-b border-t-0' : 'bottom-0',
        className
      )}
      style={{
        paddingTop: position === 'top' ? insets.top + 8 : 12,
        paddingBottom: position === 'footer' ? insets.bottom + 8 : 12
      }}
    >
      <View className="mb-2 flex-row items-center justify-between">
        <Text numberOfLines={1} className="mr-2 flex-1 text-sm font-medium">
          {assetName}
        </Text>
        {shouldShowSegment ? (
          <Text className="text-xs text-muted-foreground">
            {currentSegmentIndex}/{totalSegments}
          </Text>
        ) : null}
      </View>

      <View className="mb-3 h-1 overflow-hidden rounded-full bg-muted">
        <Animated.View className="h-full bg-primary" style={progressStyle} />
      </View>

      <View className="flex-row items-center justify-between">
        {isPlayAll ? (
          <Button
            variant="ghost"
            size="icon"
            onPress={onPrevious}
            disabled={disabled || !isActive || !onPrevious}
          >
            <Icon as={SkipBackIcon} />
          </Button>
        ) : (
          <View className="size-10" />
        )}

        <Button
          variant="ghost"
          size="icon"
          onPress={onRewind}
          disabled={disabled || !isActive || !onRewind}
        >
          <Icon as={RewindIcon} />
        </Button>

        <Button
          variant="default"
          size="icon"
          onPress={onPlayPause}
          disabled={disabled || !onPlayPause}
        >
          <Icon
            as={isPlaying ? PauseIcon : PlayIcon}
            className="text-primary-foreground"
          />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onPress={onStop}
          disabled={disabled || !isActive || !onStop}
        >
          <Icon as={SquareIcon} />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onPress={onForward}
          disabled={disabled || !isActive || !onForward}
        >
          <Icon as={FastForwardIcon} />
        </Button>

        {isPlayAll ? (
          <Button
            variant="ghost"
            size="icon"
            onPress={onNext}
            disabled={disabled || !isActive || !onNext}
          >
            <Icon as={SkipForwardIcon} />
          </Button>
        ) : (
          <View className="size-10" />
        )}
      </View>
    </View>
  );
});
