import { useAuth } from '@/contexts/AuthContext';
import { createQuestVersionFromQuest } from '@/database_services/questService';
import { useNavigationHelpers } from '@/hooks/useNavigation';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert } from 'react-native';

/**
 * Creates a new version of a quest with its assets imported, then opens it.
 * With a reviewId the review is the base of the new version.
 */
export function useCreateQuestVersion() {
  const { currentUser } = useAuth();
  const { goToQuest } = useNavigationHelpers();
  const queryClient = useQueryClient();
  const [isCreatingVersion, setIsCreatingVersion] = useState(false);

  const createVersion = async ({
    sourceQuestId,
    reviewId,
    errorMessage
  }: {
    sourceQuestId: string;
    reviewId?: string;
    errorMessage: string;
  }) => {
    if (!currentUser?.id || isCreatingVersion) return;
    setIsCreatingVersion(true);
    try {
      const created = await createQuestVersionFromQuest({
        sourceQuestId,
        userId: currentUser.id,
        reviewId
      });
      await queryClient.invalidateQueries({ queryKey: ['bible-chapters'] });
      await queryClient.invalidateQueries({
        queryKey: ['fia-pericope-quests']
      });
      await queryClient.invalidateQueries({ queryKey: ['quests'] });
      await queryClient.invalidateQueries({ queryKey: ['assets'] });
      goToQuest({
        id: created.questId,
        project_id: created.projectId,
        name: created.questName,
        promptVersionLabel: true
      });
    } catch (error) {
      console.error('Failed to create quest version:', error);
      Alert.alert(errorMessage);
    } finally {
      setIsCreatingVersion(false);
    }
  };

  return { createVersion, isCreatingVersion };
}
