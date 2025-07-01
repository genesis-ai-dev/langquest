import React from 'react';
import { View } from 'react-native';
import { QuestSkeleton } from './QuestSkeleton';

// Optimized loading state with skeletons
export const QuestListSkeleton = React.memo(() => (
  <View style={{ flex: 1 }}>
    {Array.from({ length: 6 }, (_, i) => (
      <QuestSkeleton key={i} />
    ))}
  </View>
));
