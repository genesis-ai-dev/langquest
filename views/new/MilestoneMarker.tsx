import { Text } from '@/components/ui/text';
import { cn } from '@/utils/styleUtils';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable } from 'react-native';

export type MilestoneValue = number | [number, number] | null;

export interface MilestoneMarkerProps {
  /** Position index (0 = before first asset, 1 = after first, etc.) */
  positionIndex: number;
  /** Current milestone value - single verse, range [start, end], or null */
  value: MilestoneValue;
  /** Called when marker is tapped (cycle through available verses) */
  onTap: (positionIndex: number) => void;
  /** Called when marker is long pressed (open range dialog) */
  onLongPress: (positionIndex: number) => void;
  /** Whether milestone markers are enabled */
  enabled?: boolean;
}

/**
 * Formats a milestone value for display
 */
export function formatMilestoneValue(value: MilestoneValue): string {
  if (value === null) return '';
  if (typeof value === 'number') return String(value);
  // Range: [start, end]
  const [start, end] = value;
  if (start === end) return String(start);
  return `${start}-${end}`;
}

/**
 * Small tap target for marking verse milestones between assets.
 * - Empty state: subtle circle outline
 * - Set state: shows verse number or range
 * - Tap: cycles through verses or removes
 * - Long press: opens range selection dialog
 */
export const MilestoneMarker: React.FC<MilestoneMarkerProps> = ({
  positionIndex,
  value,
  onTap,
  onLongPress,
  enabled = true
}) => {
  const hasValue = value !== null;
  const displayText = formatMilestoneValue(value);

  const handlePress = () => {
    if (!enabled) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onTap(positionIndex);
  };

  const handleLongPress = () => {
    if (!enabled) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLongPress(positionIndex);
  };

  if (!enabled) {
    return null;
  }

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      delayLongPress={400}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      className={cn(
        'items-center justify-center self-stretch rounded-md border-r border-border',
        hasValue
          ? 'min-w-[36px] bg-primary px-2'
          : 'w-9 border border-dashed border-muted-foreground/40'
      )}
    >
      {hasValue && (
        <Text className="text-xs font-semibold text-primary-foreground">
          {displayText}
        </Text>
      )}
    </Pressable>
  );
};
