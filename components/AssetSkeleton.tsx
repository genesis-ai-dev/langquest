import { sharedStyles, spacing } from '@/styles/theme';
import React from 'react';
import { View } from 'react-native';
import { Shimmer } from './Shimmer';

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
      <Shimmer width="100%" height={20} borderRadius={4} style={{ flex: 1 }} />
      {/* Download indicator */}
      <Shimmer width={32} height={32} borderRadius={16} />
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
      <Shimmer width={20} height={20} borderRadius={10} />
      <Shimmer width={20} height={20} borderRadius={10} />
      <Shimmer width={20} height={20} borderRadius={10} />
    </View>
  </View>
));
