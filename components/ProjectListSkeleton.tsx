import React from 'react';
import { View } from 'react-native';
import { ProjectSkeleton } from './ProjectSkeleton';

// Optimized loading state with project skeletons
export const ProjectListSkeleton = React.memo(() => (
  <View style={{ flex: 1 }}>
    {Array.from({ length: 6 }, (_, i) => (
      <ProjectSkeleton key={i} />
    ))}
  </View>
));
