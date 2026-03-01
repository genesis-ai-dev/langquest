/**
 * RecordAssetCard - Individual asset display with actions
 *
 * Features:
 * - Play button to play/pause audio
 * - Visual progress bar during playback
 * - Duration display (monospace, muted) next to label
 * - Delete and merge actions
 * - Selection mode (WhatsApp-style long-press)
 *
 * Interaction:
 * - Tap play button → play/pause audio
 * - Tap card → toggle selection (only in selection mode)
 * - Tap label → rename asset (when renameable)
 * - Long press → enter selection mode
 *
 * Performance:
 * - Uses Reanimated for animations on native thread
 * - Memoized to prevent unnecessary re-renders
 */

import { ButtonNewAssetAction } from '@/components/ButtonNewAssetAction';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAudio } from '@/contexts/AudioContext';
import type { Asset } from '@/hooks/db/useAssets';
import { useIsFlashing } from '@/hooks/useFlashHighlight';
import { useLocalization } from '@/hooks/useLocalization';
import { cn } from '@/utils/styleUtils';
import {
  CheckCircleIcon,
  CircleIcon,
  PauseIcon,
  PlayIcon
} from 'lucide-react-native';
import React from 'react';
import type { GestureResponderEvent } from 'react-native';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
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
  isSelected: boolean; // Batch selection (for merge/delete operations)
  isHighlighted: boolean; // Visual highlight (recording insertion point)
  isSelectionMode: boolean;
  isPlaying: boolean;
  hideButtons?: boolean; // Hide action buttons
  // progress removed - now calculated from SharedValues for 0 re-renders!
  duration?: number; // Duration in milliseconds
  segmentCount?: number; // Number of audio segments in this asset
  fileType?: 'WAV' | 'M4A'; // Primary audio format label
  // Custom progress for play-all mode (0-100 percentage)
  // If provided, this overrides the default global progress calculation
  customProgress?: SharedValue<number>;
  onPress: () => void;
  onLongPress?: () => void;
  onPlay: (assetId: string) => void;
  onRename?: (assetId: string, currentName: string | null) => void;
  onActionTypeChange?: (isReplacing: boolean) => void; // Notifies when action type changes
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

// Component to manage mutually exclusive button selection
function AssetActionButtons({
  selectedType,
  onSelectionChange
}: {
  selectedType: 'new' | 'replace';
  onSelectionChange: (type: 'new' | 'replace') => void;
}) {
  const handleNewPress = React.useCallback(() => {
    onSelectionChange('new');
  }, [onSelectionChange]);

  const handleReplacePress = React.useCallback(() => {
    onSelectionChange('replace');
  }, [onSelectionChange]);

  return (
    <View
      className="flex-row items-center justify-center gap-1"
      style={{ zIndex: 1 }}
    >
      <ButtonNewAssetAction
        type="new"
        onPress={handleNewPress}
        selected={selectedType === 'new'}
      />
      <ButtonNewAssetAction
        type="replace"
        onPress={handleReplacePress}
        selected={selectedType === 'replace'}
      />
    </View>
  );
}

function RecordAssetCardInternal({
  asset,
  index,
  isSelected,
  isHighlighted,
  isSelectionMode,
  isPlaying,
  hideButtons,
  duration,
  segmentCount,
  fileType,
  customProgress,
  onPress,
  onLongPress,
  onPlay,
  onRename,
  onActionTypeChange
}: AssetCardProps) {
  const isFlashing = useIsFlashing(asset.id);
  const audioContext = useAudio();

  // State for action button selection (always one selected, default is 'new')
  const [actionType, setActionType] = React.useState<'new' | 'replace'>('new');

  // Reset action type to 'new' when card is no longer highlighted
  React.useEffect(() => {
    if (!isHighlighted) {
      setActionType('new');
    }
  }, [isHighlighted]);

  // Notify parent when action type changes
  React.useEffect(() => {
    onActionTypeChange?.(actionType === 'replace');
  }, [actionType, onActionTypeChange]);

  // Theme colors based on action type (memoized for performance)
  const themeColors = React.useMemo(() => {
    const isReplace = actionType === 'replace';
    return {
      playButtonBg: isReplace ? 'bg-destructive/20' : 'bg-primary/20',
      playButtonActive: isReplace
        ? 'active:bg-destructive/40'
        : 'active:bg-primary/40',
      progressBar: isReplace ? 'bg-destructive/20' : 'bg-primary/20',
      segmentBadge: isReplace ? 'bg-destructive/20' : 'bg-primary/20',
      textColor: isReplace ? 'text-red-500' : 'text-primary'
    };
  }, [actionType]);

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
    const widthPercent = interpolate(
      progress,
      [0, 95, 100],
      [0, 97, 100],
      Extrapolation.CLAMP
    );
    const scaleX = widthPercent / 100;
    return {
      width: '100%',
      transform: [{ scaleX }],
      transformOrigin: 'left center'
    };
  });

  // Handle play button press
  const handlePlayPress = React.useCallback(
    (e: GestureResponderEvent) => {
      // Stop event propagation to prevent list selection
      e.stopPropagation();
      onPlay(asset.id);
    },
    [onPlay, asset.id]
  );

  // Handle selection toggle in batch selection mode
  const handleSelectionToggle = React.useCallback(
    (e: GestureResponderEvent) => {
      e.stopPropagation();
      onPress(); // Toggle batch selection or highlight
    },
    [onPress]
  );

  // Handle card press
  const handleCardPress = React.useCallback(() => {
    onPress();
  }, [onPress]);

  // Handle card long press
  const handleCardLongPress = React.useCallback(() => {
    onLongPress?.();
  }, [onLongPress]);

  // Flash animation (5s fade after merge/unmerge)
  const flashOpacity = useSharedValue(0);
  React.useEffect(() => {
    if (isFlashing) {
      flashOpacity.value = 1;
      flashOpacity.value = withTiming(0, {
        duration: 5000,
        easing: Easing.out(Easing.quad)
      });
    }
  }, [isFlashing, flashOpacity]);

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value
  }));

  const { t } = useLocalization();
  return (
    <TouchableOpacity
      onPress={handleCardPress}
      onLongPress={onLongPress ? handleCardLongPress : undefined}
      delayLongPress={500}
      activeOpacity={0.7}
      disabled={isSelectionMode}
    >
      <View
        className={cn(
          'relative overflow-hidden rounded-lg border p-3',
          isHighlighted && !isSelectionMode
            ? actionType === 'replace'
              ? 'border-dashed border-destructive bg-destructive/10'
              : 'border-primary bg-card'
            : isSelected
              ? 'border-primary bg-primary/10'
              : 'border-border bg-card'
        )}
      >
        {/* Flash overlay — fading border+bg after merge/unmerge */}
        {isFlashing && (
          <Animated.View
            style={[StyleSheet.absoluteFillObject, { zIndex: 0 }, flashStyle]}
            className="rounded-lg border-2 border-primary bg-primary/10"
            pointerEvents="none"
          />
        )}

        {/* Progress bar overlay - positioned absolutely behind content (Reanimated on native thread) */}
        {isPlaying && (
          <View
            style={[StyleSheet.absoluteFillObject, { zIndex: 0 }]}
            pointerEvents="none"
          >
            <Animated.View
              className={cn('h-full', themeColors.progressBar)}
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
          {/* Play/Pause Button */}
          <TouchableOpacity
            onPress={handlePlayPress}
            className={cn(
              'ml-2 flex h-7 w-7 items-center justify-center rounded-full',
              themeColors.playButtonBg,
              themeColors.playButtonActive
            )}
            activeOpacity={0.7}
          >
            <Icon
              as={isPlaying ? PauseIcon : PlayIcon}
              size={16}
              className={
                isPlaying ? themeColors.textColor : `${themeColors.textColor}`
              }
            />
          </TouchableOpacity>

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
                  className={`text-sm font-medium ${isRenameable && !isSelectionMode && onRename ? 'text-foreground underline' : 'text-foreground'}`}
                >
                  {asset.name || t('unnamedAsset')}
                </Text>
              </TouchableOpacity>
              {segmentCount && segmentCount > 1 && (
                <View
                  className={cn(
                    'rounded px-1.5 py-0.5',
                    themeColors.segmentBadge
                  )}
                >
                  <Text className="text-xs font-medium text-primary">
                    {segmentCount}
                  </Text>
                </View>
              )}
            </View>
            <View className="flex-row items-center gap-2">
              {/* <Text className="text-xs text-muted-foreground">
              {asset.created_at && new Date(asset.created_at).toLocaleString()}
            </Text> */}
              <Text
                className="font-mono text-xs text-muted-foreground"
                style={{ letterSpacing: 0.5 }}
              >
                {duration !== undefined && duration > 0
                  ? formatDuration(duration)
                  : ' '}
              </Text>
            </View>
          </View>

          {fileType && (
            <View
              className={cn('rounded px-2 py-0.5', themeColors.segmentBadge)}
            >
              <Text className="text-xs font-semibold text-primary">
                {fileType}
              </Text>
            </View>
          )}

          {/* Selection checkbox - only show for local assets in selection mode */}
          {isLocal &&
            (isSelectionMode ? (
              <TouchableOpacity
                onPress={handleSelectionToggle}
                className="pl-2"
                style={{ zIndex: 1 }}
                activeOpacity={0.7}
              >
                <Icon
                  as={isSelected ? CheckCircleIcon : CircleIcon}
                  size={20}
                  className={
                    isSelected ? 'text-primary' : 'text-muted-foreground'
                  }
                />
              </TouchableOpacity>
            ) : isHighlighted && !hideButtons ? (
              <AssetActionButtons
                selectedType={actionType}
                onSelectionChange={setActionType}
              />
            ) : null)}
        </View>
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
export const RecordAssetCard = React.memo(
  RecordAssetCardInternal,
  (prev, next) => {
    // Custom equality check - only re-render if these props change
    return (
      prev.asset.id === next.asset.id &&
      prev.asset.name === next.asset.name &&
      prev.asset.source === next.asset.source &&
      prev.index === next.index &&
      prev.isSelected === next.isSelected &&
      prev.isHighlighted === next.isHighlighted &&
      prev.isSelectionMode === next.isSelectionMode &&
      prev.isPlaying === next.isPlaying &&
      prev.hideButtons === next.hideButtons &&
      // prev.progress removed - uses SharedValues now!
      prev.duration === next.duration &&
      prev.segmentCount === next.segmentCount &&
      prev.fileType === next.fileType &&
      prev.canMergeDown === next.canMergeDown &&
      // Compare customProgress SharedValue reference (needed when it changes from undefined to SharedValue)
      prev.customProgress === next.customProgress &&
      // Callbacks are stable (wrapped in useCallback in parent), so we can skip checking them
      prev.onPress === next.onPress &&
      prev.onLongPress === next.onLongPress &&
      prev.onPlay === next.onPlay &&
      prev.onRename === next.onRename &&
      prev.onActionTypeChange === next.onActionTypeChange &&
      prev.onDelete === next.onDelete &&
      prev.onMerge === next.onMerge &&
      prev.onEdit === next.onEdit
    );
  }
);
