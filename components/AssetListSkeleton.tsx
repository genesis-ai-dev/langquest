import { Skeleton } from '@/components/ui/skeleton';
import React from 'react';
import { View } from 'react-native';

// Optimized loading state with asset skeletons
export function AssetListSkeleton() {
  return (
    <View className="flex-1 gap-3">
      {Array.from({ length: 6 }, (_, i) => (
        <View
          key={i}
          className="gap-2 rounded-lg border border-border bg-card p-4"
        >
          <View className="flex-row items-start gap-3">
            <Skeleton className="h-5 flex-1" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </View>
          <View className="flex-row gap-2">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-5 w-5 rounded-full" />
          </View>
        </View>
      ))}
    </View>
  );
}
