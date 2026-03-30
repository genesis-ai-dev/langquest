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
import { ActivityIndicator, View } from 'react-native';

interface MiniMediaPlayerProps {
  currentAssetName?: string | null;
  isPlaying: boolean;
  isPaused?: boolean;
  loading?: boolean;
  positionMs?: number;
  durationMs?: number;
  onSeek?: (positionMs: number) => void;
  onRewind?: () => void;
  onPlayPause?: () => void;
  onStop?: () => void;
  onForward?: () => void;
  disabled?: boolean;
  className?: string;
  ticks?: { pct: number }[];
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
  loading = false,
  positionMs = 0,
  durationMs = 0,
  onSeek,
  onRewind,
  onPlayPause,
  onStop,
  onForward,
  disabled = false,
  className,
  ticks
}: MiniMediaPlayerProps) {
  const isActive = isPlaying || isPaused;
  const assetName = currentAssetName?.trim() || 'No audio selected';
  const hasKnownDuration = durationMs > 0;
  const maxDuration = durationMs > 0 ? durationMs : 1;
  const clampedPosition = Math.max(0, Math.min(positionMs, maxDuration));

  const [dragPosition, setDragPosition] = React.useState<number | null>(null);
  const displayPosition = dragPosition ?? clampedPosition;
  const displayPositionLabel =
    !hasKnownDuration && !isActive ? '--:--' : formatTime(displayPosition);
  const displayDurationLabel = hasKnownDuration
    ? formatTime(durationMs)
    : '--:--';

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

      <View style={{ position: 'relative' }}>
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
        {ticks && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: '50%',
              height: 20,
              marginTop: -10
            }}
          >
            {ticks.map((tick, i) => (
              <View
                key={i}
                className="bg-primary/70"
                style={{
                  position: 'absolute',
                  left: `${tick.pct}%`,
                  top: 0,
                  bottom: 0,
                  width: 2,
                  marginLeft: -1,
                  borderRadius: 1
                }}
              />
            ))}
          </View>
        )}
      </View>

      <View className="mt-1 flex-row items-center justify-between">
        <Text className="text-xs text-muted-foreground">
          {displayPositionLabel}
        </Text>
        <Text className="text-xs text-muted-foreground">
          {displayDurationLabel}
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
          disabled={disabled || loading || !onPlayPause}
        >
          {loading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Icon
              as={isPlaying ? PauseIcon : PlayIcon}
              className="text-primary-foreground"
            />
          )}
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
