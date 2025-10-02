/**
 * AssetCard - Individual asset display with actions
 *
 * Features:
 * - Play/pause audio
 * - Delete
 * - Merge with next
 * - Selection mode
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
import { TouchableOpacity, View } from 'react-native';

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
  isBibleMode?: boolean; // Bible mode shows edit button
  onPress: () => void;
  onLongPress: () => void;
  onPlay: (assetId: string) => void;
  onDelete: (assetId: string) => void;
  onMerge: (index: number) => void;
  onEdit?: (assetId: string, assetName: string) => void; // Bible mode: edit segments
}

export const AssetCard = React.memo(function AssetCard({
  asset,
  index,
  isSelected,
  isSelectionMode,
  isPlaying,
  canMergeDown,
  progress,
  segmentCount,
  isBibleMode = false,
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

  return (
    <TouchableOpacity
      className={`overflow-hidden rounded-lg border p-3 ${
        isSelected ? 'border-primary bg-primary/10' : 'border-border bg-card'
      }`}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      {/* Progress bar overlay */}
      {isPlaying && progress !== undefined && (
        <View className="pointer-events-none absolute inset-0">
          <View
            className="h-full bg-primary/20"
            style={{ width: `${progress}%` }}
          />
        </View>
      )}

      <View className="flex-row items-center gap-3">
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
            {isCloud ? 'Cloud' : isOptimistic ? 'Saving…' : 'Local'} • Position{' '}
            {index + 1}
          </Text>
        </View>

        {!isSelectionMode && isLocal && (
          <View className="flex-row gap-1">
            {/* Play button - wider in Bible mode */}
            <Button
              variant="outline"
              size={isBibleMode ? 'sm' : 'icon'}
              onPress={() => onPlay(asset.id)}
              disabled={isOptimistic}
              className={isBibleMode ? 'px-4' : ''}
            >
              <Icon
                as={isPlaying ? Pause : Play}
                size={16}
                className={isPlaying ? 'text-primary' : ''}
              />
              {isBibleMode && (
                <Text className="ml-1 text-xs">
                  {isPlaying ? 'Stop' : 'Play'}
                </Text>
              )}
            </Button>

            {/* Bible mode: Edit button instead of delete */}
            {isBibleMode && onEdit ? (
              <Button
                variant="outline"
                size="icon"
                onPress={() => onEdit(asset.id, asset.name)}
                disabled={isOptimistic}
              >
                <Icon as={Edit} size={16} />
              </Button>
            ) : (
              /* Unstructured mode: Delete button */
              <Button
                variant="destructive"
                size="icon"
                onPress={() => onDelete(asset.id)}
                disabled={isOptimistic}
              >
                <Icon as={Trash2} size={16} />
              </Button>
            )}

            {/* Merge down button */}
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

        {isSelectionMode && (
          <View className="pl-2">
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
});
