import type { Project } from '@/hooks/db/useProjects';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { styles } from './NextGenProjectsView';

// Define props locally to avoid require cycle
export interface ProjectListItemProps {
  project: Project & { source?: string };
}

function renderSourceTag(source: string | undefined) {
  if (source === 'cloudSupabase') {
    return <Text style={{ color: 'red' }}>Cloud</Text>;
  }
  return <Text style={{ color: 'blue' }}>Offline</Text>;
}

export const ProjectListItem: React.FC<ProjectListItemProps> = ({
  project
}) => {
  const { goToProject } = useAppNavigation();

  const handlePress = () => {
    goToProject({
      id: project.id,
      name: project.name
    });
  };

  return (
    <TouchableOpacity onPress={handlePress}>
      <View style={styles.listItem}>
        {renderSourceTag(project.source)}
        <Text style={styles.projectName}>{project.name}</Text>
        <Text style={styles.languagePair}>
          Languages: {project.source_language_id.substring(0, 8)}... →{' '}
          {project.target_language_id.substring(0, 8)}...
        </Text>
        {project.description && (
          <Text style={styles.description} numberOfLines={2}>
            {project.description}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};
