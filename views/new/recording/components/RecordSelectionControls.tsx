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
import { ListChecks, ListX, Merge, Trash2, X } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';

interface RecordSelectionControlsProps {
  selectedCount: number;
  onCancel: () => void;
  onMerge: () => void;
  onDelete: () => void;
  allowSelectAll?: boolean;
  allSelected?: boolean;
  onSelectAll?: () => void;
}

export const RecordSelectionControls = React.memo(function RecordSelectionControls({
  selectedCount,
  onCancel,
  onMerge,
  onDelete,
  allowSelectAll = false,
  allSelected = false,
  onSelectAll
}: RecordSelectionControlsProps) {
  const { t } = useLocalization();
  return (
    <View className="mb-3 w-full flex-row items-center justify-between bg-card p-3 px-4">
      <Text className="text-xs text-muted-foreground font-bold flex-1">{selectedCount} {t('selected')}</Text>
      <View className="align-between flex-row">
        <View className="flex-row gap-2 h-full items-center">
          {allowSelectAll && onSelectAll && (
            <Button variant="default" onPress={onSelectAll} size="sm">
              <Icon as={allSelected ? ListX : ListChecks} />
            </Button>
          )}
          <Button
            variant="default"
            size="sm"
            disabled={selectedCount < 2}
            onPress={onMerge}
            className='p-1'
          >
            <View className="flex-row items-center px-2">
              <Icon as={Merge} />
              <Text className="ml-2 text-xs">{t('merge')}</Text>
            </View>
          </Button>
          <Button
            variant="destructive"
            disabled={selectedCount < 1}
            onPress={onDelete}
            size="sm"
          >
            <Icon as={Trash2} />
          </Button>
        </View>
          <Button variant="ghost" onPress={onCancel} className='ml-3' size="sm">
            <Icon as={X} />
          </Button>
      </View>
    </View>
  );
});
