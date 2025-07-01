import { colors, sharedStyles, spacing } from '@/styles/theme';
import React from 'react';
import { View } from 'react-native';

// Skeleton loader component for better perceived performance
export const QuestSkeleton = React.memo(() => (
  <View style={[sharedStyles.card, { opacity: 0.6 }]}>
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.small
      }}
    >
      <View
        style={{
          backgroundColor: colors.inputBackground,
          height: 20,
          flex: 1,
          borderRadius: 4
        }}
      />
      <View
        style={{
          width: 32,
          height: 32,
          backgroundColor: colors.inputBackground,
          borderRadius: 16
        }}
      />
    </View>
    <View
      style={{
        backgroundColor: colors.inputBackground,
        height: 16,
        marginTop: spacing.small,
        borderRadius: 4
      }}
    />
    <View
      style={{
        backgroundColor: colors.inputBackground,
        height: 16,
        width: '60%',
        marginTop: spacing.small,
        borderRadius: 4
      }}
    />
  </View>
));
