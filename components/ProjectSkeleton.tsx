import { sharedStyles, spacing } from '@/styles/theme';
import React from 'react';
import { View } from 'react-native';
import { Shimmer } from './Shimmer';

// Skeleton loader component for project cards
export const ProjectSkeleton = React.memo(() => (
  <View style={[sharedStyles.card, { opacity: 0.8 }]}>
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.small
      }}
    >
      {/* Project title and icons area */}
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xsmall
        }}
      >
        <Shimmer
          width="100%"
          height={20}
          borderRadius={4}
          style={{ flex: 1 }}
        />
        {/* Privacy/membership icon placeholders */}
        <Shimmer width={16} height={16} borderRadius={8} />
        <Shimmer width={16} height={16} borderRadius={8} />
      </View>
      {/* Download indicator */}
      <Shimmer width={32} height={32} borderRadius={16} />
    </View>

    {/* Language pair */}
    <Shimmer
      width="70%"
      height={14}
      borderRadius={4}
      style={{ marginTop: spacing.small }}
    />

    {/* Description */}
    <Shimmer
      width="100%"
      height={16}
      borderRadius={4}
      style={{ marginTop: spacing.small }}
    />
    <Shimmer
      width="80%"
      height={16}
      borderRadius={4}
      style={{ marginTop: spacing.xsmall }}
    />
  </View>
));
