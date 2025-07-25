import { QuestCard } from '@/components/QuestCard';
import { useSessionMemberships } from '@/contexts/SessionCacheContext';
import type { Project } from '@/database_services/projectService';
import type { Quest } from '@/database_services/questService';
import type { Tag } from '@/database_services/tagService';
import React, { useCallback } from 'react';
import { TouchableOpacity } from 'react-native';

// Memoized quest item component for better performance

export const QuestItem = React.memo(
  ({
    quest,
    project,
    onPress
  }: {
    quest: Quest & { tags: { tag: Tag }[] };
    project: Project | null;
    onPress: (quest: Quest) => void;
  }) => {
    const { isUserOwner } = useSessionMemberships();
    // const isOwner = project?.id ? isUserOwner(project.id) : false;

    const handlePress = useCallback(() => {
      onPress(quest);
    }, [quest, onPress]);

    if (!project) return null;

    return (
      <TouchableOpacity onPress={handlePress}>
        <QuestCard quest={quest} project={project} />
      </TouchableOpacity>
    );
  }
);
