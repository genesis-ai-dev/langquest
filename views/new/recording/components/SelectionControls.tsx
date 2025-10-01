/**
 * SelectionControls - Batch operation controls when in selection mode
 *
 * Shows:
 * - Selected count
 * - Cancel button
 * - Merge button
 */

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { GitMerge } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';

interface SelectionControlsProps {
  selectedCount: number;
  onCancel: () => void;
  onMerge: () => void;
}

export const SelectionControls = React.memo(function SelectionControls({
  selectedCount,
  onCancel,
  onMerge
}: SelectionControlsProps) {
  return (
    <View className="mb-3 flex-row items-center justify-between rounded-lg border border-border bg-card p-3">
      <Text className="text-sm text-muted-foreground">
        {selectedCount} selected
      </Text>
      <View className="flex-row gap-2">
        <Button variant="outline" onPress={onCancel}>
          <Text>Cancel</Text>
        </Button>
        <Button
          variant="default"
          disabled={selectedCount < 2}
          onPress={onMerge}
        >
          <Icon as={GitMerge} size={16} />
          <Text className="ml-2">Merge</Text>
        </Button>
      </View>
    </View>
  );
});
