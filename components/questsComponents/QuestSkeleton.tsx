import { sharedStyles, spacing } from '@/styles/theme';
import React from 'react';
import { View } from 'react-native';
import { Shimmer } from '../Shimmer';

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
      <Shimmer width="100%" height={20} borderRadius={4} style={{ flex: 1 }} />
      <Shimmer width={32} height={32} borderRadius={16} />
    </View>
    <Shimmer
      width="100%"
      height={16}
      borderRadius={4}
      style={{ marginTop: spacing.small }}
    />
    <Shimmer
      width="60%"
      height={16}
      borderRadius={4}
      style={{ marginTop: spacing.small }}
    />
  </View>
));
