import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Slider } from '@/components/ui/slider';
import { Text } from '@/components/ui/text';
import { cn } from '@/utils/styleUtils';
import {
  FastForwardIcon,
  PauseIcon,
  PlayIcon,
  RewindIcon,
  SquareIcon
} from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';

interface MiniMediaPlayerProps {
  currentAssetName?: string | null;
  isPlaying: boolean;
  isPaused?: boolean;
  positionMs?: number;
  durationMs?: number;
  onSeek?: (positionMs: number) => void;
  onRewind?: () => void;
  onPlayPause?: () => void;
  onStop?: () => void;
  onForward?: () => void;
  disabled?: boolean;
  className?: string;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`;
}

export const MiniMediaPlayer = React.memo(function MiniMediaPlayer({
  currentAssetName,
  isPlaying,
  isPaused = false,
  positionMs = 0,
  durationMs = 0,
  onSeek,
  onRewind,
  onPlayPause,
  onStop,
  onForward,
  disabled = false,
  className
}: MiniMediaPlayerProps) {
  const isActive = isPlaying || isPaused;
  const assetName = currentAssetName?.trim() || 'No audio selected';
  const maxDuration = durationMs > 0 ? durationMs : 1;
  const clampedPosition = Math.max(0, Math.min(positionMs, maxDuration));

  const [dragPosition, setDragPosition] = React.useState<number | null>(null);
  const displayPosition = dragPosition ?? clampedPosition;

  return (
    <View
      className={cn(
        'z-10 rounded-xl border border-border bg-background/95 p-3',
        className
      )}
    >
      <Text numberOfLines={1} className="mb-2 text-sm font-medium">
        {assetName}
      </Text>

      <Slider
        minimumValue={0}
        maximumValue={maxDuration}
        value={clampedPosition}
        onValueChange={setDragPosition}
        onSlidingComplete={(ms) => {
          setDragPosition(null);
          onSeek?.(ms);
        }}
        disabled={disabled || !isActive || !onSeek}
        animated={false}
      />

      <View className="mt-1 flex-row items-center justify-between">
        <Text className="text-xs text-muted-foreground">
          {formatTime(displayPosition)}
        </Text>
        <Text className="text-xs text-muted-foreground">
          {formatTime(durationMs)}
        </Text>
      </View>

      <View className="mt-2 flex-row items-center justify-between">
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
      </View>
    </View>
  );
});
