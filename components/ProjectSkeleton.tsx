import { colors, sharedStyles, spacing } from '@/styles/theme';
import React from 'react';
import { View } from 'react-native';

// Skeleton loader component for project cards
export const ProjectSkeleton = React.memo(() => (
  <View style={[sharedStyles.card, { opacity: 0.6 }]}>
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
        <View
          style={{
            backgroundColor: colors.inputBackground,
            height: 20,
            flex: 1,
            borderRadius: 4
          }}
        />
        {/* Privacy/membership icon placeholders */}
        <View
          style={{
            width: 16,
            height: 16,
            backgroundColor: colors.inputBackground,
            borderRadius: 8
          }}
        />
        <View
          style={{
            width: 16,
            height: 16,
            backgroundColor: colors.inputBackground,
            borderRadius: 8
          }}
        />
      </View>
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

    {/* Language pair */}
    <View
      style={{
        backgroundColor: colors.inputBackground,
        height: 14,
        width: '70%',
        marginTop: spacing.small,
        borderRadius: 4
      }}
    />

    {/* Description */}
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
        width: '80%',
        marginTop: spacing.xsmall,
        borderRadius: 4
      }}
    />
  </View>
));
