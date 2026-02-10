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
import React from 'react';
import { View } from 'react-native';

interface SelectionControlsProps {
  selectedCount: number;
  onCancel: () => void;
  onMerge: () => void;
  onDelete: () => void;
  allowSelectAll?: boolean;
  allSelected?: boolean;
  onSelectAll?: () => void;
}

export const SelectionControls = React.memo(function SelectionControls({
  selectedCount,
  onCancel,
  onMerge,
  onDelete,
  allowSelectAll = false,
  allSelected = false,
  onSelectAll
}: SelectionControlsProps) {
  const { t } = useLocalization();
  return (
    <View className="mb-3 flex-row items-center justify-between rounded-lg border border-border bg-card p-3">
      <Text className="text-sm text-muted-foreground">({selectedCount})</Text>
      <View className="align-between flex-row">
        <View className="flex-row gap-2">
          {allowSelectAll && onSelectAll && (
            <Button variant="default" onPress={onSelectAll}>
              <Icon name={allSelected ? 'list-x' : 'list-checks'} />
            </Button>
          )}
          <Button
            variant="default"
            disabled={selectedCount < 2}
            onPress={onMerge}
          >
            <View className="flex-row items-center">
              <Icon name="merge" />
              <Text className="ml-2 text-sm">{t('merge')}</Text>
            </View>
          </Button>
          <Button
            variant="destructive"
            disabled={selectedCount < 1}
            onPress={onDelete}
          >
            <Icon name="trash-2" />
          </Button>
        </View>
        <Button variant="secondary" onPress={onCancel} className="ml-2">
          <Icon name="x" />
        </Button>
      </View>
    </View>
  );
});
