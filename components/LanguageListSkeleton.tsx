import { Skeleton } from '@/components/ui/skeleton';
import React from 'react';
import { View } from 'react-native';

// Loading skeleton for language list
export function LanguageListSkeleton() {
  return (
    <View className="flex-1 gap-3">
      {Array.from({ length: 6 }, (_, i) => (
        <View
          key={i}
          className="h-16 flex-row items-center gap-3 rounded-lg border border-border bg-card px-6"
        >
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-5 flex-1" />
        </View>
      ))}
    </View>
  );
}
