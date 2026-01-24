/**
 * AssetCard - Individual asset display with actions
 *
 * Features:
 * - Tap card to play/pause audio (except when tapping label to rename)
 * - Visual progress bar during playback
 * - Duration display (monospace, muted) next to label
 * - Delete and merge actions
 * - Selection mode (WhatsApp-style long-press)
 *
 * Interaction:
 * - Tap card → play/pause audio (or toggle selection if in selection mode)
 * - Tap label → rename asset (when renameable)
 * - Long press → enter selection mode
 *
 * Performance:
 * - Uses Reanimated for animations on native thread
 * - Memoized to prevent unnecessary re-renders
 */

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAudio } from '@/contexts/AudioContext';
import type { Asset } from '@/hooks/db/useAssets';
import { useLocalization } from '@/hooks/useLocalization';
import { cn } from '@/utils/styleUtils';
import { CheckCircleIcon, CircleIcon } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue
} from 'react-native-reanimated';
import type { HybridDataSource } from '../../useHybridData';

interface AssetCardProps {
  asset: Pick<Asset, 'id' | 'name'> & {
    source: HybridDataSource | 'optimistic';
    created_at?: string;
    order_index?: number | null;
  };
  index: number;
  isSelected: boolean;
  isSelectionMode: boolean;
  isPlaying: boolean;
  // progress removed - now calculated from SharedValues for 0 re-renders!
  duration?: number; // Duration in milliseconds
  segmentCount?: number; // Number of audio segments in this asset
  // Custom progress for play-all mode (0-100 percentage)
  // If provided, this overrides the default global progress calculation
  customProgress?: SharedValue<number>;
  onPress: () => void;
  onLongPress: () => void;
  onPlay: (assetId: string) => void;
  onRename?: (assetId: string, currentName: string | null) => void;
  // Note: These callbacks are still passed but no longer used (batch operations only)
  onDelete?: (assetId: string) => void;
  onMerge?: (index: number) => void;
  onEdit?: (assetId: string, assetName: string) => void;
  canMergeDown?: boolean;
}

// Format duration in milliseconds to MM:SS
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function AssetCardInternal({
  asset,
  index,
  isSelected,
  isSelectionMode,
  isPlaying,
  duration,
  segmentCount,
  customProgress,
  onPress,
  onLongPress,
  onPlay,
  onRename
}: AssetCardProps) {
  const audioContext = useAudio();

  // CRITICAL: Only local-only assets can be renamed/edited/deleted (synced assets are immutable)
  const isLocal = asset.source === 'local';
  // Renameable = local and not currently saving
  const isRenameable = isLocal;

  // ============================================================================
  // REANIMATED ANIMATIONS (Run on native thread for better performance)
  // ============================================================================

  // NEW: Calculate progress from SharedValues (no re-renders!)
  // This runs entirely on the UI thread at 60fps
  // If customProgress is provided (for play-all mode), use that instead
  const animatedProgress = useDerivedValue(() => {
    'worklet';
    if (!isPlaying) return 0;

    // Use custom progress if provided (for play-all mode with asset-specific progress)
    if (customProgress) {
      return customProgress.value;
    }

    // Otherwise, use global progress calculation
    const pos = audioContext.positionShared.value;
    const dur = audioContext.durationShared.value;

    if (dur <= 0) return 0;

    // Calculate progress percentage (0-100)
    const progressPercent = (pos / dur) * 100;
    return Math.min(100, Math.max(0, progressPercent));
  }, [isPlaying, customProgress]);

  // Progress bar style (interpolate to slightly lead at the end)
  const progressBarStyle = useAnimatedStyle(() => {
    'worklet';
    const progress = animatedProgress.value;
    const width = interpolate(
      progress,
      [0, 95, 100],
      [0, 97, 100],
      Extrapolation.CLAMP
    );
    return {
      width: `${width}%`
    };
  });

  // Handle card press: play/pause in normal mode, toggle selection in selection mode
  const handleCardPress = React.useCallback(() => {
    if (isSelectionMode) {
      onPress(); // Toggle selection
    } else {
      onPlay(asset.id); // Play/pause audio
    }
  }, [isSelectionMode, onPress, onPlay, asset.id]);

  const { t } = useLocalization();
  return (
    <TouchableOpacity
      className={cn(
        'relative overflow-hidden rounded-lg border p-3',
        isSelected ? 'border-primary bg-primary/10' : 'border-border bg-card'
      )}
      onPress={handleCardPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      {/* Progress bar overlay - positioned absolutely behind content (Reanimated on native thread) */}
      {isPlaying && (
        <View
          style={[StyleSheet.absoluteFillObject, { zIndex: 0 }]}
          pointerEvents="none"
        >
          <Animated.View
            className="h-full bg-primary/20"
            style={progressBarStyle}
          />
        </View>
      )}

      {/* Content - z-index ensures it appears above progress bar */}
      <View
        className="flex-row items-center justify-center gap-3"
        style={{ zIndex: 1 }}
      >
        <View className="min-w-[28px] items-center justify-center self-center rounded border border-border bg-muted px-2 py-0.5">
          <Text className="text-xs font-semibold text-muted-foreground">
            {index + 1}
          </Text>
        </View>
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            {/* Label with rename functionality - prevents card play when tapped */}
            <TouchableOpacity
              onPress={() => {
                if (!isSelectionMode && isRenameable && onRename) {
                  onRename(asset.id, asset.name);
                }
              }}
              disabled={isSelectionMode || !isRenameable || !onRename}
              activeOpacity={0.7}
            >
              <Text
                className={`text-base font-medium ${isRenameable && !isSelectionMode && onRename ? 'text-foreground underline' : 'text-foreground'}`}
              >
                {asset.name || t('unnamedAsset')}
              </Text>
            </TouchableOpacity>
            {segmentCount && segmentCount > 1 && (
              <View className="rounded bg-primary/20 px-1.5 py-0.5">
                <Text className="text-xs font-medium text-primary">
                  {segmentCount}
                </Text>
              </View>
            )}
          </View>
          <View className="flex-row items-center gap-2">
            <Text className="text-sm text-muted-foreground">
              {asset.created_at && new Date(asset.created_at).toLocaleString()}
            </Text>
          </View>
        </View>
        {duration !== undefined && duration > 0 && (
          <Text
            className="font-mono text-sm text-muted-foreground"
            style={{ letterSpacing: 0.5 }}
          >
            {formatDuration(duration)}
          </Text>
        )}

        {/* Selection checkbox - only show for local assets in selection mode */}
        {isSelectionMode && isLocal && (
          <View className="pl-2" style={{ zIndex: 1 }}>
            <Icon
              as={isSelected ? CheckCircleIcon : CircleIcon}
              size={20}
              className={isSelected ? 'text-primary' : 'text-muted-foreground'}
            />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

/**
 * Memoized AssetCard to prevent unnecessary re-renders
 * Only re-renders when props actually change
 *
 * OPTIMIZATION: progress removed from comparison - now uses SharedValues
 * This eliminates 10 re-renders/second during audio playback!
 */
export const AssetCard = React.memo(AssetCardInternal, (prev, next) => {
  // Custom equality check - only re-render if these props change
  return (
    prev.asset.id === next.asset.id &&
    prev.asset.name === next.asset.name &&
    prev.asset.source === next.asset.source &&
    prev.index === next.index &&
    prev.isSelected === next.isSelected &&
    prev.isSelectionMode === next.isSelectionMode &&
    prev.isPlaying === next.isPlaying &&
    // prev.progress removed - uses SharedValues now!
    prev.duration === next.duration &&
    prev.segmentCount === next.segmentCount &&
    prev.canMergeDown === next.canMergeDown &&
    // Compare customProgress SharedValue reference (needed when it changes from undefined to SharedValue)
    prev.customProgress === next.customProgress &&
    // Callbacks are stable (wrapped in useCallback in parent), so we can skip checking them
    prev.onPress === next.onPress &&
    prev.onLongPress === next.onLongPress &&
    prev.onPlay === next.onPlay &&
    prev.onRename === next.onRename &&
    prev.onDelete === next.onDelete &&
    prev.onMerge === next.onMerge &&
    prev.onEdit === next.onEdit
  );
});
