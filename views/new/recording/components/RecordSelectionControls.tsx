/**
 * SelectionControls - Batch operation controls when in selection mode
 *
 * Two-row layout:
 * - Top row: select all toggle, "N selected" label, cancel button
 * - Bottom row: assign verse, trim, merge, unmerge, delete
 *
 * Receives `controlsProps` from the useSelectionActions hook (spread by the
 * parent) so views share one source of truth for derived state and handlers.
 */

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useLocalization } from '@/hooks/useLocalization';
import type { SelectionControlsProps } from '@/views/new/recording/hooks/useSelectionActions';
import {
  Bookmark,
  ListChecks,
  ListX,
  Merge,
  Scissors,
  Split,
  Trash2,
  X
} from 'lucide-react-native';
import React from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { View } from 'react-native';

interface RecordSelectionControlsProps extends Partial<SelectionControlsProps> {
  enableAssignVerse?: boolean;
  onAssignVerse?: () => void;
  onLayout?: (height: number) => void;
}

export const RecordSelectionControls = React.memo(
  function RecordSelectionControls({
    selectedCount = 0,
    allSelected = false,
    enableMerge = false,
    showUnmerge = false,
    canTrim = false,
    onCancel,
    onMerge,
    onDelete,
    onUnmerge,
    onTrim,
    onSelectAll,
    enableAssignVerse = false,
    onAssignVerse,
    onLayout
  }: RecordSelectionControlsProps) {
    const { t } = useLocalization();
    const shouldShowTrim = canTrim;
    const shouldShowMerge = enableMerge && selectedCount >= 2;

    const handleLayout = React.useCallback(
      (e: LayoutChangeEvent) => onLayout?.(e.nativeEvent.layout.height),
      [onLayout]
    );

    return (
      <View
        className="w-full border-t border-border bg-card px-2 py-3"
        onLayout={handleLayout}
      >
        {/* Top row: select all, count, cancel */}
        <View className="flex-row items-center">
          <Button
            variant="default"
            onPress={onSelectAll ?? (() => undefined)}
            size="default"
          >
            <Icon as={allSelected ? ListX : ListChecks} />
          </Button>
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            className="ml-3 flex-1 text-xs font-bold text-muted-foreground"
          >
            {selectedCount} {t('selected')}
          </Text>
          <Button
            variant="ghost"
            onPress={onCancel ?? (() => undefined)}
            size="icon"
            className="mr-1"
          >
            <Icon as={X} />
          </Button>
        </View>

        {/* Bottom row: action buttons */}
        <View className="mt-2 flex-row items-center gap-2">
          {enableAssignVerse && onAssignVerse && (
            <Button variant="default" onPress={onAssignVerse} size="default">
              <Icon as={Bookmark} />
            </Button>
          )}
          {shouldShowTrim && (
            <Button
              variant="default"
              size="default"
              onPress={onTrim ?? (() => undefined)}
              className="p-1"
            >
              <View className="flex-row items-center px-0">
                <Icon as={Scissors} />
                <Text className="ml-2 text-xs">{t('trim')}</Text>
              </View>
            </Button>
          )}
          {shouldShowMerge && (
            <Button
              variant="default"
              size="default"
              onPress={onMerge ?? (() => undefined)}
              className="p-1"
            >
              <View className="flex-row items-center px-0">
                <Icon as={Merge} />
                <Text className="ml-2 text-xs">{t('merge')}</Text>
              </View>
            </Button>
          )}
          {showUnmerge && (
            <Button
              variant="default"
              size="default"
              onPress={onUnmerge ?? (() => undefined)}
              className="p-1"
            >
              <View className="flex-row items-center px-0">
                <Icon as={Split} />
                <Text className="ml-2 text-xs">{t('unmerge')}</Text>
              </View>
            </Button>
          )}
          <View className="flex-1" />
          <Button
            variant="destructive"
            disabled={selectedCount < 1}
            onPress={onDelete ?? (() => undefined)}
            size="default"
          >
            <Icon as={Trash2} />
          </Button>
        </View>
      </View>
    );
  }
);
