import { Skeleton } from '@/components/ui/skeleton';
import { sharedStyles, spacing } from '@/styles/theme';
import React from 'react';
import { View } from 'react-native';

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
        <Skeleton style={{ flex: 1, height: 20 }} />
        {/* Privacy/membership icon placeholders */}
        <Skeleton className="rounded-lg" style={{ width: 16, height: 16 }} />
        <Skeleton className="rounded-lg" style={{ width: 16, height: 16 }} />
      </View>
      {/* Download indicator */}
      <Skeleton className="rounded-full" style={{ width: 32, height: 32 }} />
    </View>

    {/* Language pair */}
    <Skeleton style={{ width: '70%', height: 14, marginTop: spacing.small }} />

    {/* Description */}
    <Skeleton style={{ width: '100%', height: 16, marginTop: spacing.small }} />
    <Skeleton style={{ width: '80%', height: 16, marginTop: spacing.xsmall }} />
  </View>
));
