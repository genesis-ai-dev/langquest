/**
 * SelectionControls - Batch operation controls when in selection mode
 *
 * Two-row layout:
 * - Top row: select all toggle, "N selected" label, cancel button
 * - Bottom row: assign verse, trim, merge, unmerge, delete
 */

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useLocalization } from '@/hooks/useLocalization';
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

interface RecordSelectionControlsProps {
  selectedCount: number;
  onCancel: () => void;
  onMerge: () => void;
  onDelete: () => void;
  onTrim?: () => void;
  allowSelectAll?: boolean;
  allSelected?: boolean;
  onSelectAll?: () => void;
  allowAssignVerse?: boolean;
  onAssignVerse?: () => void;
  showMerge?: boolean;
  showUnmerge?: boolean;
  onUnmerge?: () => void;
  onLayout?: (height: number) => void;
}

export const RecordSelectionControls = React.memo(
  function RecordSelectionControls({
    selectedCount,
    onCancel,
    onMerge,
    onDelete,
    onTrim,
    allowSelectAll = false,
    allSelected = false,
    onSelectAll,
    allowAssignVerse = false,
    onAssignVerse,
    showMerge = true,
    showUnmerge = false,
    onUnmerge,
    onLayout
  }: RecordSelectionControlsProps) {
    const { t } = useLocalization();
    const shouldShowTrim = selectedCount === 1 && !!onTrim;
    const shouldShowMerge = showMerge && selectedCount >= 2;

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
          {allowSelectAll && onSelectAll && (
            <Button variant="default" onPress={onSelectAll} size="default">
              <Icon as={allSelected ? ListX : ListChecks} />
            </Button>
          )}
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            className="ml-3 flex-1 text-xs font-bold text-muted-foreground"
          >
            {selectedCount} {t('selected')}
          </Text>
          <Button
            variant="ghost"
            onPress={onCancel}
            size="icon"
            className="mr-1"
          >
            <Icon as={X} />
          </Button>
        </View>

        {/* Bottom row: action buttons */}
        <View className="mt-2 flex-row items-center gap-2">
          {allowAssignVerse && onAssignVerse && (
            <Button variant="default" onPress={onAssignVerse} size="default">
              <Icon as={Bookmark} />
            </Button>
          )}
          {shouldShowTrim && (
            <Button
              variant="default"
              size="default"
              onPress={onTrim}
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
              onPress={onMerge}
              className="p-1"
            >
              <View className="flex-row items-center px-0">
                <Icon as={Merge} />
                <Text className="ml-2 text-xs">{t('merge')}</Text>
              </View>
            </Button>
          )}
          {showUnmerge && onUnmerge && (
            <Button
              variant="default"
              size="default"
              onPress={onUnmerge}
              className="p-1"
            >
              <View className="flex-row items-center px-0">
                <Icon as={Split} />
                <Text className="ml-2 text-xs">Unmerge</Text>
              </View>
            </Button>
          )}
          <View className="flex-1" />
          <Button
            variant="destructive"
            disabled={selectedCount < 1}
            onPress={onDelete}
            size="default"
          >
            <Icon as={Trash2} />
          </Button>
        </View>
      </View>
    );
  }
);
