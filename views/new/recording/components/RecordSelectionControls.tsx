/**
 * SelectionControls - Batch operation controls when in selection mode
 *
 * Shows:
 * - Selected count
 * - Cancel button
 * - Merge button (requires 2+ selections)
 * - Delete button (requires 1+ selections)
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
  Trash2,
  X
} from 'lucide-react-native';
import React from 'react';
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
    onUnmerge
  }: RecordSelectionControlsProps) {
    const { t } = useLocalization();
    const shouldShowTrim = selectedCount === 1 && !!onTrim;
    const shouldShowMerge = selectedCount >= 2;
    return (
      <View className="mb-3 w-full flex-row items-center justify-between bg-card px-2 py-3">
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          className="flex-1 text-xs font-bold text-muted-foreground"
        >
          {selectedCount} {t('selected')}
        </Text>
        <View className="align-between flex-row">
          <View className="h-full flex-row items-center gap-2">
            {allowAssignVerse && onAssignVerse && (
              <Button variant="default" onPress={onAssignVerse} size="default">
                <Icon as={Bookmark} />
              </Button>
            )}
            {allowSelectAll && onSelectAll && (
              <Button variant="default" onPress={onSelectAll} size="default">
                <Icon as={allSelected ? ListX : ListChecks} />
              </Button>
            )}
            {shouldShowTrim ? (
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
            ) : showMerge && shouldShowMerge ? (
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
                  <Icon as={Scissors} />
                  <Text className="ml-2 text-xs">Unmerge</Text>
                </View>
              </Button>
            )}
            <Button
              variant="destructive"
              disabled={selectedCount < 1}
              onPress={onDelete}
              size="default"
            >
              <Icon as={Trash2} />
            </Button>
          </View>
          <Button
            variant="ghost"
            onPress={onCancel}
            className="ml-1 mt-1"
            size="icon"
          >
            <Icon as={X} />
          </Button>
        </View>
      </View>
    );
  }
);
