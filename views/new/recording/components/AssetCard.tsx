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
 */

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { Asset } from '@/hooks/db/useAssets';
import { useLocalization } from '@/hooks/useLocalization';
import { cn } from '@/utils/styleUtils';
import { CheckCircleIcon, CircleIcon } from 'lucide-react-native';
import React from 'react';
import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native';
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

const PROGRESS_STEPS = 500; // Number of steps for smooth animation
const HIGHLIGHT_PEAK_MS = 3000; // Peak highlight period (3 seconds)

// Format duration in milliseconds to MM:SS
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Calculate highlight intensity for a newly created asset
 * Uses power law decay: intensity = 1 / (1 + (age/peak)^2)
 *
 * @param createdAt - When the asset was created
 * @returns Opacity value 0-1 (0 = no highlight, 1 = full highlight)
 */
function calculateHighlightIntensity(createdAt?: string | Date): number {
  if (!createdAt) return 0;

  const now = Date.now();
  const created =
    typeof createdAt === 'string'
      ? new Date(createdAt).getTime()
      : createdAt.getTime();
  const age = now - created;

  if (age < 0) return 0; // Future date, shouldn't happen

  // Power law decay with exponent 2 for smooth falloff
  // At t=0: intensity = 1.0 (full)
  // At t=3s: intensity = 0.5 (half)
  // At t=6s: intensity = 0.2
  // At t=12s: intensity = 0.05 (barely visible)
  const normalized = age / HIGHLIGHT_PEAK_MS;
  const intensity = 1 / (1 + Math.pow(normalized, 2));

  return Math.max(0, Math.min(1, intensity));
}

export function AssetCard({
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

  // Animated value for smooth progress transitions
  const animatedProgress = React.useRef(new Animated.Value(0)).current;

  // Highlight intensity for newly created assets (decays over time)
  const [highlightIntensity, setHighlightIntensity] = React.useState(() =>
    calculateHighlightIntensity(asset.created_at)
  );

  // Update highlight intensity every 100ms for smooth decay animation
  React.useEffect(() => {
    if (highlightIntensity <= 0.01) return; // Stop updating when basically invisible

    const interval = setInterval(() => {
      const newIntensity = calculateHighlightIntensity(asset.created_at);
      setHighlightIntensity(newIntensity);

      // Stop interval when highlight is gone
      if (newIntensity <= 0.01) {
        clearInterval(interval);
      }
    }, 100); // Update 10 times per second for smooth animation

    return () => clearInterval(interval);
  }, [asset.created_at, highlightIntensity]);
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
      {/* New asset highlight - decaying gradient overlay */}
      {highlightIntensity > 0.01 && (
        <View
          style={[StyleSheet.absoluteFillObject, { zIndex: 0 }]}
          pointerEvents="none"
        >
          <View
            className="h-full"
            style={{
              backgroundColor: `hsl(var(--chart-5) / ${highlightIntensity * 0.3})`,
              opacity: highlightIntensity
            }}
          />
        </View>
      )}

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
