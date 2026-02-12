/**
 * SegmentCard - Individual audio segment display (nested under AssetCard)
 *
 * Features:
 * - Play/pause segment
 * - Delete segment
 * - Visual indent to show nesting
 */

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import React from 'react';
import { View } from 'react-native';

interface SegmentCardProps {
  segment: {
    id: string;
    audio_id: string | null;
  };
  index: number; // Segment number within the asset
  isPlaying: boolean;
  onPlay: () => void;
  onDelete: () => void;
}

export const SegmentCard = React.memo(function SegmentCard({
  segment,
  index,
  isPlaying,
  onPlay,
  onDelete
}: SegmentCardProps) {
  return (
    <View className="ml-6 flex-row items-center gap-2 rounded-md border border-border/50 bg-muted/30 p-2">
      {/* Segment number */}
      <Text className="text-sm text-muted-foreground">#{index + 1}</Text>

      {/* Play button */}
      <Button variant="ghost" size="icon-sm" onPress={onPlay}>
        <Icon
          name={isPlaying ? 'pause' : 'play'}
          size={14}
          className={isPlaying ? 'text-primary' : 'text-foreground'}
        />
      </Button>

      {/* Segment info */}
      <View className="flex-1">
        <Text className="text-xs text-muted-foreground">
          {segment.audio_id ? `Segment ${index + 1}` : 'No audio'}
        </Text>
      </View>

      {/* Delete button */}
      <Button variant="ghost" size="icon-sm" onPress={onDelete}>
        <Icon name="trash-2" size={14} className="text-destructive" />
      </Button>
    </View>
  );
});
