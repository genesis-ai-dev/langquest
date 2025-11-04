import { Skeleton } from '@/components/ui/skeleton';
import React from 'react';
import { View } from 'react-native';

// Optimized loading state with project skeletons
export function ProjectListSkeleton() {
  return (
    <View className="flex flex-1 flex-col gap-3">
      {Array.from({ length: 6 }, (_, i) => (
        <View
          key={i}
          className="gap-2 rounded-lg border border-border bg-card p-4"
        >
          <View className="flex-row items-start gap-3">
            <View className="flex-1 flex-row items-center gap-2">
              <Skeleton className="h-5 flex-1" />
              <Skeleton className="h-4 w-4 rounded-lg" />
              <Skeleton className="h-4 w-4 rounded-lg" />
            </View>
            <Skeleton className="h-8 w-8 rounded-full" />
          </View>
          <Skeleton className="h-3.5 w-[70%]" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[80%]" />
        </View>
      ))}
    </View>
  );
}
