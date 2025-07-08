import { colors, sharedStyles, spacing } from '@/styles/theme';
import React from 'react';
import { View } from 'react-native';

// Skeleton loader component for asset cards
export const AssetSkeleton = React.memo(() => (
  <View style={[sharedStyles.card, { opacity: 0.6 }]}>
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.small
      }}
    >
      {/* Asset title */}
      <View
        style={{
          backgroundColor: colors.inputBackground,
          height: 20,
          flex: 1,
          borderRadius: 4
        }}
      />
      {/* Download indicator */}
      <View
        style={{
          width: 32,
          height: 32,
          backgroundColor: colors.inputBackground,
          borderRadius: 16
        }}
      />
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
      <View
        style={{
          width: 20,
          height: 20,
          backgroundColor: colors.inputBackground,
          borderRadius: 10
        }}
      />
      <View
        style={{
          width: 20,
          height: 20,
          backgroundColor: colors.inputBackground,
          borderRadius: 10
        }}
      />
      <View
        style={{
          width: 20,
          height: 20,
          backgroundColor: colors.inputBackground,
          borderRadius: 10
        }}
      />
    </View>
  </View>
));
