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
import type { Asset } from '@/hooks/db/useAssets';
import { useLocalization } from '@/hooks/useLocalization';
import { cn } from '@/utils/styleUtils';
import { CheckCircleIcon, CircleIcon } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming
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
  progress?: number; // 0-100 percentage
  duration?: number; // Duration in milliseconds
  segmentCount?: number; // Number of audio segments in this asset
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

/**
 * Calculate age of asset in milliseconds
 * Used by Reanimated worklet to compute highlight intensity
 */
function calculateAssetAge(createdAt?: string | Date): number {
  if (!createdAt) return Infinity; // Very old, no highlight

  const now = Date.now();
  const created =
    typeof createdAt === 'string'
      ? new Date(createdAt).getTime()
      : createdAt.getTime();
  const age = now - created;

  return age < 0 ? Infinity : age;
}

function AssetCardInternal({
  asset,
  index,
  isSelected,
  isSelectionMode,
  isPlaying,
  progress,
  duration,
  segmentCount,
  onPress,
  onLongPress,
  onPlay,
  onRename
}: AssetCardProps) {
  const isCloud = asset.source === 'cloud';
  // CRITICAL: Only local-only assets can be renamed/edited/deleted (synced assets are immutable)
  const isLocal = asset.source === 'local';
  // Renameable = local and not currently saving
  const isRenameable = isLocal;

  // ============================================================================
  // REANIMATED ANIMATIONS (Run on native thread for better performance)
  // ============================================================================

  // Progress animation (0-100)
  const animatedProgress = useSharedValue(0);

  // Update progress with smooth animation
  React.useEffect(() => {
    if (!isPlaying || progress === undefined) {
      // Reset when not playing
      animatedProgress.value = withTiming(0, {
        duration: 200,
        easing: Easing.out(Easing.ease)
      });
    } else {
      // Smooth animation to current progress
      // Multi-segment assets get slightly faster animations
      const baseSpeed = segmentCount && segmentCount > 1 ? 400 : 500;
      animatedProgress.value = withTiming(progress, {
        duration: baseSpeed,
        easing: Easing.linear
      });
    }
  }, [progress, isPlaying, animatedProgress, segmentCount]);

  // Progress bar style (interpolate to slightly lead at the end)
  const progressBarStyle = useAnimatedStyle(() => {
    'worklet';
    const width = interpolate(
      animatedProgress.value,
      [0, 95, 100],
      [0, 97, 100],
      Extrapolation.CLAMP
    );
    return {
      width: `${width}%`
    };
  });

  // Highlight animation for newly created assets
  // Calculate initial age once to avoid recalculation
  const initialAge = React.useMemo(
    () => calculateAssetAge(asset.created_at),
    [asset.created_at]
  );

  // Animate highlight intensity on native thread
  const highlightProgress = useSharedValue(0);
  const HIGHLIGHT_DURATION_MS = 12000; // Total highlight duration (12 seconds)

  React.useEffect(() => {
    if (initialAge > HIGHLIGHT_DURATION_MS) {
      // Too old, no animation needed
      highlightProgress.value = 1; // 1 = fully decayed
      return;
    }

    // Animate from current age to fully decayed
    const startProgress = initialAge / HIGHLIGHT_DURATION_MS;
    highlightProgress.value = startProgress;
    highlightProgress.value = withTiming(1, {
      duration: HIGHLIGHT_DURATION_MS - initialAge,
      easing: Easing.out(Easing.ease)
    });
  }, [initialAge, highlightProgress]);

  // Derive highlight intensity using worklet (runs on native thread)
  const highlightIntensity = useDerivedValue(() => {
    'worklet';
    // Power law decay: intensity = 1 / (1 + (progress * 4)^2)
    // At progress=0: intensity = 1.0 (full highlight)
    // At progress=0.25: intensity = 0.5 (half)
    // At progress=0.5: intensity = 0.2
    // At progress=1: intensity = 0.06 (barely visible)
    const normalized = highlightProgress.value * 4;
    return 1 / (1 + Math.pow(normalized, 2));
  });

  const highlightStyle = useAnimatedStyle(() => {
    'worklet';
    const intensity = highlightIntensity.value;
    return {
      opacity: intensity,
      backgroundColor: `hsl(var(--chart-5) / ${intensity * 0.3})`
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
      {/* New asset highlight - decaying gradient overlay (Reanimated on native thread) */}
      {initialAge < 12000 && (
        <Animated.View
          style={[StyleSheet.absoluteFillObject, { zIndex: 0 }, highlightStyle]}
          pointerEvents="none"
        />
      )}

      {/* Progress bar overlay - positioned absolutely behind content (Reanimated on native thread) */}
      {isPlaying && progress !== undefined && (
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
      <View className="flex-row items-center gap-3" style={{ zIndex: 1 }}>
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
                {asset.name || t('unnamedAsset')}ry
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
          <Text className="text-sm text-muted-foreground">
            {`${isCloud ? 'Cloud' : 'Local'} • Position ${index + 1}`}
          </Text>
        </View>
        {duration !== undefined && (
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
    prev.progress === next.progress &&
    prev.duration === next.duration &&
    prev.segmentCount === next.segmentCount &&
    prev.canMergeDown === next.canMergeDown &&
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
