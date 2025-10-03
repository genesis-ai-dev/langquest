/**
 * AssetCard - Individual asset display with actions
 *
 * Features:
 * - Play/pause audio with visual progress
 * - Delete
 * - Merge with next
 * - Selection mode (WhatsApp-style long-press)
 */

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import {
  CheckCircle,
  Circle,
  Edit,
  GitMerge,
  Pause,
  Play,
  Trash2
} from 'lucide-react-native';
import React from 'react';
import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native';

interface AssetCardProps {
  asset: {
    id: string;
    name: string;
    source?: string;
    order_index?: number;
  };
  index: number;
  isSelected: boolean;
  isSelectionMode: boolean;
  isPlaying: boolean;
  canMergeDown: boolean;
  progress?: number; // 0-100 percentage
  segmentCount?: number; // Number of audio segments in this asset
  onPress: () => void;
  onLongPress: () => void;
  onPlay: (assetId: string) => void;
  onDelete: (assetId: string) => void;
  onMerge: (index: number) => void;
  onEdit?: (assetId: string, assetName: string) => void;
}

const PROGRESS_STEPS = 500; // Number of steps for smooth animation

export function AssetCard({
  asset,
  index,
  isSelected,
  isSelectionMode,
  isPlaying,
  canMergeDown,
  progress,
  segmentCount,
  onPress,
  onLongPress,
  onPlay,
  onDelete,
  onMerge,
  onEdit
}: AssetCardProps) {
  const isOptimistic = asset.source === 'optimistic';
  const isCloud = asset.source === 'cloud';
  const isLocal = !isCloud && !isOptimistic;

  // Animated value for smooth progress transitions
  const animatedProgress = React.useRef(new Animated.Value(0)).current;
  const previousProgressRef = React.useRef(0);
  const currentValueRef = React.useRef(0);

  // Smooth progress animation with clamping
  React.useEffect(() => {
    if (!isPlaying || progress === undefined) {
      // Reset animation when not playing
      Animated.timing(animatedProgress, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false
      }).start(() => {
        currentValueRef.current = 0;
      });
      previousProgressRef.current = 0;
      return;
    }

    // Clamp progress to discrete steps for smoother animation
    const clampedProgress =
      (Math.round((progress / 100) * PROGRESS_STEPS) / PROGRESS_STEPS) * 100;

    // Only animate if progress actually changed
    if (clampedProgress !== previousProgressRef.current) {
      const progressDelta = clampedProgress - previousProgressRef.current;

      // For multi-segment assets, ensure smooth transitions between segments
      // If progress jumped backwards (new segment started), animate from previous position
      const fromValue =
        progressDelta < 0
          ? previousProgressRef.current
          : currentValueRef.current;

      // Calculate animation duration based on segment count
      // Multi-segment assets get slightly faster animations to stay ahead
      const baseSpeed = segmentCount && segmentCount > 1 ? 400 : 500;
      const duration = Math.min(baseSpeed, Math.abs(progressDelta) * 10);

      animatedProgress.setValue(fromValue);
      Animated.timing(animatedProgress, {
        toValue: clampedProgress,
        duration,
        useNativeDriver: false
      }).start(() => {
        currentValueRef.current = clampedProgress;
      });

      previousProgressRef.current = clampedProgress;
    }
  }, [progress, isPlaying, animatedProgress, segmentCount]);

  // Interpolate to slightly lead the actual progress for smoother finish
  const displayProgress = animatedProgress.interpolate({
    inputRange: [0, 95, 100],
    outputRange: ['0%', '97%', '100%'], // Slightly ahead at the end
    extrapolate: 'clamp'
  });

  return (
    <TouchableOpacity
      className={`relative overflow-hidden rounded-lg border p-3 ${
        isSelected ? 'border-primary bg-primary/10' : 'border-border bg-card'
      }`}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      {/* Progress bar overlay - positioned absolutely behind content */}
      {isPlaying && progress !== undefined && (
        <View
          style={[StyleSheet.absoluteFillObject, { zIndex: 0 }]}
          pointerEvents="none"
        >
          <Animated.View
            className="h-full bg-primary/20"
            style={{ width: displayProgress }}
          />
        </View>
      )}

      {/* Content - z-index ensures it appears above progress bar */}
      <View className="flex-row items-center gap-3" style={{ zIndex: 1 }}>
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="text-base font-medium text-foreground">
              {asset.name}
            </Text>
            {segmentCount && segmentCount > 1 && (
              <View className="rounded bg-primary/20 px-1.5 py-0.5">
                <Text className="text-xs font-medium text-primary">
                  {segmentCount} clips
                </Text>
              </View>
            )}
          </View>
          <Text className="text-sm text-muted-foreground">
            {`${isCloud ? 'Cloud' : isOptimistic ? 'Saving…' : 'Local'} • Position ${index + 1}`}
          </Text>
        </View>

        {/* Action buttons - only show for local assets when NOT in selection mode */}
        {!isSelectionMode && isLocal && (
          <View className="flex-row gap-1" style={{ zIndex: 1 }}>
            {/* Play button */}
            <Button
              variant="outline"
              size="icon"
              onPress={() => onPlay(asset.id)}
              disabled={isOptimistic}
            >
              <Icon
                as={isPlaying ? Pause : Play}
                size={16}
                className={isPlaying ? 'text-primary' : ''}
              />
            </Button>

            {/* Edit segments */}
            {onEdit && (
              <Button
                variant="outline"
                size="icon"
                onPress={() => onEdit(asset.id, asset.name)}
                disabled={isOptimistic}
              >
                <Icon as={Edit} size={16} />
              </Button>
            )}

            {/* Delete asset */}
            <Button
              variant="destructive"
              size="icon"
              onPress={() => onDelete(asset.id)}
              disabled={isOptimistic}
            >
              <Icon as={Trash2} size={16} />
            </Button>

            {/* Merge down */}
            {canMergeDown && (
              <Button
                variant="outline"
                size="icon"
                onPress={() => onMerge(index)}
                disabled={isOptimistic}
              >
                <Icon as={GitMerge} size={16} />
              </Button>
            )}
          </View>
        )}

        {/* Selection checkbox - only show for local assets in selection mode */}
        {isSelectionMode && isLocal && (
          <View className="pl-2" style={{ zIndex: 1 }}>
            <Icon
              as={isSelected ? CheckCircle : Circle}
              size={20}
              className={isSelected ? 'text-primary' : 'text-muted-foreground'}
            />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}
