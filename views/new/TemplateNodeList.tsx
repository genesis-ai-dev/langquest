import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import type { TemplateNode } from '@/constants/templateTypes';
import { resolveLabel } from '@/utils/templateUtils';
import { cn, useThemeColor } from '@/utils/styleUtils';
import { LegendList } from '@legendapp/list';
import { ChevronRightIcon, PlusCircleIcon } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';

interface TemplateNodeListProps {
  nodes: TemplateNode[];
  onNodeSelect: (nodeId: string) => void;
  existingNodeIds?: Set<string>;
  canCreateNew?: boolean;
  emptyMessage?: string;
}

/**
 * Generic list component for displaying template tree nodes at any level.
 * Replaces BibleBookList, FiaBookList, BibleChapterList, FiaPericopeList
 * with a single template-driven component.
 */
export function TemplateNodeList({
  nodes,
  onNodeSelect,
  existingNodeIds,
  canCreateNew = false,
  emptyMessage = 'No items'
}: TemplateNodeListProps) {
  const primaryColor = useThemeColor('primary');
  const secondaryColor = useThemeColor('chart-2');

  const visibleNodes = nodes.filter((n) => !n.deleted);

  if (visibleNodes.length === 0) {
    return (
      <View className="flex-1 items-center justify-center p-8">
        <Text className="text-muted-foreground">{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <LegendList
      data={visibleNodes}
      keyExtractor={(item) => item.id}
      estimatedItemSize={56}
      renderItem={({ item }) => {
        const exists = existingNodeIds?.has(item.id);
        const label = resolveLabel(item);
        const hasChildren = (item.children?.filter((c) => !c.deleted).length ?? 0) > 0;

        return (
          <Button
            variant="ghost"
            className={cn(
              'mx-2 my-0.5 flex-row items-center justify-between rounded-lg px-4 py-3',
              exists && 'bg-accent/50'
            )}
            onPress={() => onNodeSelect(item.id)}
          >
            <View className="flex-1 flex-row items-center gap-3">
              {exists ? (
                <View
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: primaryColor }}
                />
              ) : canCreateNew ? (
                <Icon
                  icon={PlusCircleIcon}
                  size={16}
                  color={secondaryColor}
                />
              ) : (
                <View className="h-2.5 w-2.5 rounded-full bg-muted" />
              )}
              <View className="flex-1">
                <Text
                  className={cn(
                    'text-sm font-medium',
                    !exists && 'text-muted-foreground'
                  )}
                  numberOfLines={1}
                >
                  {label}
                </Text>
                {item.node_type && (
                  <Text className="text-xs text-muted-foreground">
                    {item.node_type}
                  </Text>
                )}
              </View>
            </View>
            {hasChildren && (
              <Icon
                icon={ChevronRightIcon}
                size={16}
                className="text-muted-foreground"
              />
            )}
          </Button>
        );
      }}
    />
  );
}

export function TemplateNodeListSkeleton() {
  return (
    <View className="gap-2 px-4 pt-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-lg" />
      ))}
    </View>
  );
}
