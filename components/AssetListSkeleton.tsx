import React from 'react';
import { View } from 'react-native';
import { AssetSkeleton } from './AssetSkeleton';

// Optimized loading state with asset skeletons
export const AssetListSkeleton = React.memo(() => (
  <View style={{ flex: 1 }}>
    {Array.from({ length: 6 }, (_, i) => (
      <AssetSkeleton key={i} />
    ))}
  </View>
));
