import { Skeleton } from '@/components/ui/skeleton';
import { sharedStyles, spacing } from '@/styles/theme';
import React from 'react';
import { View } from 'react-native';

// Skeleton loader component for asset cards
export const AssetSkeleton = React.memo(() => (
  <View style={[sharedStyles.card, { opacity: 0.8 }]}>
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.small
      }}
    >
      {/* Asset title */}
      <Skeleton style={{ flex: 1, height: 20 }} />
      {/* Download indicator */}
      <Skeleton className="rounded-full" style={{ width: 32, height: 32 }} />
    </View>

    {/* Translation count/gems area */}
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'nowrap',
        marginTop: spacing.small,
        gap: spacing.xsmall
      }}
    >
      <Skeleton className="rounded-full" style={{ width: 20, height: 20 }} />
      <Skeleton className="rounded-full" style={{ width: 20, height: 20 }} />
      <Skeleton className="rounded-full" style={{ width: 20, height: 20 }} />
    </View>
  </View>
));
