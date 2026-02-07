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

interface SelectionControlsProps {
  selectedCount: number;
  onCancel: () => void;
  onMerge: () => void;
  onDelete: () => void;
  onTrim?: () => void;
  onAssignVerse?: () => void;
  allowSelectAll?: boolean;
  allSelected?: boolean;
  onSelectAll?: () => void;
}

export const SelectionControls = React.memo(function SelectionControls({
  selectedCount,
  onCancel,
  onMerge,
  onDelete,
  onTrim,
  onAssignVerse,
  allowSelectAll = false,
  allSelected = false,
  onSelectAll
}: SelectionControlsProps) {
  const { t } = useLocalization();
  const shouldShowTrim = selectedCount === 1 && !!onTrim;
  const shouldShowMerge = selectedCount >= 2;
  return (
    <View className="mb-3 flex-row items-center justify-between rounded-lg border border-border bg-card p-3">
      <Text className="text-sm text-muted-foreground">({selectedCount})</Text>
      <View className="align-between flex-row">
        <View className="flex-row gap-2">
          {allowSelectAll && onSelectAll && (
            <Button variant="default" onPress={onSelectAll}>
              <Icon as={allSelected ? ListX : ListChecks} />
            </Button>
          )}
          {onAssignVerse && (
            <Button
              variant="default"
              disabled={selectedCount < 1}
              onPress={onAssignVerse}
            >
              <Icon as={Bookmark} />
            </Button>
          )}
          {shouldShowTrim ? (
            <Button variant="default" onPress={onTrim}>
              <View className="flex-row items-center">
                <Icon as={Scissors} />
                <Text className="ml-2 text-sm">{t('trim')}</Text>
              </View>
            </Button>
          ) : shouldShowMerge ? (
            <Button
              variant="default"
              onPress={onMerge}
            >
              <View className="flex-row items-center">
                <Icon as={Merge} />
                <Text className="ml-2 text-sm">{t('merge')}</Text>
              </View>
            </Button>
          ) : null}
          <Button
            variant="destructive"
            disabled={selectedCount < 1}
            onPress={onDelete}
          >
            <Icon as={Trash2} />
          </Button>
        </View>
        <Button variant="secondary" onPress={onCancel} className="ml-2">
          <Icon as={X} />
        </Button>
      </View>
    </View>
  );
});
