import { QuestCard } from '@/components/QuestCard';
import { Button } from '@/components/ui/button';
import type { Project } from '@/database_services/projectService';
import type { Quest } from '@/database_services/questService';
import type { Tag } from '@/database_services/tagService';
import React, { useCallback } from 'react';

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
    const handlePress = useCallback(() => {
      onPress(quest);
    }, [quest, onPress]);

    if (!project) return null;

    return (
      <Button variant="plain" onPress={handlePress}>
        <QuestCard quest={quest} project={project} />
      </Button>
    );
  }
);
