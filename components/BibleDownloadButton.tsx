import type { AudioDownloadState } from '@/hooks/useBibleBrainContent';
import { cn, useThemeColor } from '@/utils/styleUtils';
import {
  AlertCircleIcon,
  ArrowDownToLineIcon,
  CheckIcon,
  DownloadIcon,
  WifiOffIcon,
  XIcon
} from 'lucide-react-native';
import React from 'react';
import {
  TouchableOpacity,
  View
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Icon } from './ui/icon';
import { Text } from './ui/text';

interface BibleDownloadButtonProps {
  state: AudioDownloadState;
  onDownload: () => void;
  onCancel?: () => void;
  hasAudio: boolean;
  isOffline?: boolean;
  compact?: boolean;
}

function CircularProgress({
  progress,
  size = 36,
  strokeWidth = 3
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
}) {
  const primaryColor = useThemeColor('primary');
  const mutedColor = useThemeColor('border');
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <Svg width={size} height={size}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={mutedColor}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={primaryColor}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

/**
 * Four-state download button following iOS App Store pattern:
 *   none      → download arrow icon
 *   downloading → circular progress with cancel
 *   cached    → green check
 *   error     → red alert with retry
 */
export function BibleDownloadButton({
  state,
  onDownload,
  onCancel,
  hasAudio,
  isOffline,
  compact
}: BibleDownloadButtonProps) {
  if (!hasAudio) return null;

  if (isOffline && state.status === 'none') {
    return (
      <View
        className={cn(
          'flex-row items-center gap-2 rounded-lg bg-muted/50 px-3 py-2',
          compact && 'px-2 py-1.5'
        )}
      >
        <Icon as={WifiOffIcon} size={14} className="text-muted-foreground" />
        <Text className="text-xs text-muted-foreground">
          Audio unavailable offline
        </Text>
      </View>
    );
  }

  if (state.status === 'cached') {
    return (
      <View
        className={cn(
          'flex-row items-center gap-2 rounded-lg bg-green-500/10 px-3 py-2',
          compact && 'px-2 py-1.5'
        )}
      >
        <View className="h-5 w-5 items-center justify-center rounded-full bg-green-500">
          <Icon as={CheckIcon} size={12} className="text-white" />
        </View>
        <Text className="text-xs font-medium text-green-700 dark:text-green-400">
          Audio saved
        </Text>
      </View>
    );
  }

  if (state.status === 'downloading') {
    const progress = state.total > 0 ? state.downloaded / state.total : 0;
    return (
      <View
        className={cn(
          'flex-row items-center gap-2.5 rounded-lg bg-primary/8 px-3 py-2',
          compact && 'px-2 py-1.5'
        )}
      >
        <View className="relative items-center justify-center">
          <CircularProgress progress={progress} size={28} strokeWidth={2.5} />
          {onCancel ? (
            <TouchableOpacity
              onPress={onCancel}
              className="absolute items-center justify-center"
              hitSlop={8}
            >
              <Icon as={XIcon} size={10} className="text-primary" />
            </TouchableOpacity>
          ) : null}
        </View>
        <View>
          <Text className="text-xs font-medium text-primary">
            Downloading audio...
          </Text>
          <Text className="text-[10px] text-muted-foreground">
            {state.downloaded} of {state.total} chapters
          </Text>
        </View>
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <TouchableOpacity
        onPress={onDownload}
        className={cn(
          'flex-row items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2',
          compact && 'px-2 py-1.5'
        )}
        activeOpacity={0.7}
      >
        <Icon as={AlertCircleIcon} size={16} className="text-destructive" />
        <View>
          <Text className="text-xs font-medium text-destructive">
            Download failed
          </Text>
          <Text className="text-[10px] text-muted-foreground">
            Tap to retry
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  // status === 'none'
  return (
    <TouchableOpacity
      onPress={onDownload}
      className={cn(
        'flex-row items-center gap-2 rounded-lg bg-primary/8 px-3 py-2',
        compact && 'px-2 py-1.5'
      )}
      activeOpacity={0.7}
    >
      <Icon as={ArrowDownToLineIcon} size={16} className="text-primary" />
      <Text className="text-xs font-medium text-primary">
        Save audio offline
      </Text>
    </TouchableOpacity>
  );
}

/**
 * Compact inline indicator for the translation picker.
 * Shows a small icon indicating offline availability.
 */
export function BibleOfflineIndicator({
  hasTextCached,
  hasAudioCached
}: {
  hasTextCached: boolean;
  hasAudioCached: boolean;
}) {
  if (!hasTextCached && !hasAudioCached) return null;

  return (
    <View className="flex-row items-center gap-0.5">
      {hasTextCached && (
        <View className="rounded-full bg-green-500/15 p-0.5">
          <Icon as={CheckIcon} size={8} className="text-green-600 dark:text-green-400" />
        </View>
      )}
      {hasAudioCached && (
        <View className="rounded-full bg-green-500/15 p-0.5">
          <Icon as={DownloadIcon} size={8} className="text-green-600 dark:text-green-400" />
        </View>
      )}
    </View>
  );
}
