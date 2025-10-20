import { Skeleton } from '@/components/ui/skeleton';
import { sharedStyles, spacing } from '@/styles/theme';
import React from 'react';
import { View } from 'react-native';

// Skeleton loader component for better perceived performance
export const QuestSkeleton = React.memo(() => (
  <View style={[sharedStyles.card, { opacity: 0.8 }]}>
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.small
      }}
    >
      <Skeleton style={{ flex: 1, height: 20 }} />
      <Skeleton className="rounded-full" style={{ width: 32, height: 32 }} />
    </View>
    <Skeleton style={{ width: '100%', height: 16, marginTop: spacing.small }} />
    <Skeleton style={{ width: '60%', height: 16, marginTop: spacing.small }} />
  </View>
));
