/**
 * Thin navigation helpers for the nested route structure.
 * All navigation is via expo-router directly -- no custom state management.
 */

import type { RecordingData } from '@/store/localStore';
import { useLocalStore } from '@/store/localStore';
import { useGlobalSearchParams, usePathname, useRouter } from 'expo-router';
import { useCallback } from 'react';

export function useNavigationHelpers() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useGlobalSearchParams<{
    projectId?: string;
    questId?: string;
    assetId?: string;
  }>();

  const projectId = (params.projectId as string) || undefined;
  const questId = (params.questId as string) || undefined;
  const assetId = (params.assetId as string) || undefined;

  const goToProjects = useCallback(() => {
    router.dismissTo('/(app)');
  }, [router]);

  const goToQuest = useCallback(
    (quest: { id: string; project_id: string; name?: string }) => {
      const targetProjectId = quest.project_id || projectId;
      router.push(`/(app)/project/${targetProjectId}/quest/${quest.id}`);
    },
    [router, projectId]
  );

  const goToAsset = useCallback(
    (asset: {
      id: string;
      name?: string;
      projectId?: string;
      questId?: string;
    }) => {
      const targetProjectId = asset.projectId || projectId;
      const targetQuestId = asset.questId || questId;

      if (!targetProjectId || !targetQuestId) {
        console.warn('Cannot navigate to asset without projectId and questId');
        return;
      }

      router.push(
        `/(app)/project/${targetProjectId}/quest/${targetQuestId}/asset/${asset.id}`
      );
    },
    [router, projectId, questId]
  );

  const goToRecording = useCallback(
    (recordingData: RecordingData | null) => {
      const targetProjectId = projectId;
      const targetQuestId = questId;

      if (!targetProjectId || !targetQuestId) {
        console.warn(
          'Cannot navigate to recording without projectId and questId'
        );
        return;
      }

      useLocalStore.getState().setCurrentRecordingData(recordingData);
      router.push(
        `/(app)/project/${targetProjectId}/quest/${targetQuestId}/recording`
      );
    },
    [router, projectId, questId]
  );

  return {
    projectId,
    questId,
    assetId,
    pathname,
    router,
    goToProjects,
    goToQuest,
    goToAsset,
    goToRecording
  };
}
