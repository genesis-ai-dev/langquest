/**
 * Thin navigation helpers for the nested route structure.
 * All navigation is via expo-router directly -- no custom state management.
 */

import type { RecordingData } from '@/store/localStore';
import { useLocalStore } from '@/store/localStore';
import type { Href } from 'expo-router';
import { useGlobalSearchParams, usePathname, useRouter } from 'expo-router';
import { useCallback } from 'react';

function href(path: string): Href {
  return path as unknown as Href;
}

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

  const { addRecentQuest, addRecentAsset } = useLocalStore();

  const goToProjects = useCallback(() => {
    router.dismissTo(href('/(app)/'));
  }, [router]);

  const goToProject = useCallback(
    (project: { id: string }) => {
      router.push(href(`/(app)/project/${project.id}`));
    },
    [router]
  );

  const goToQuest = useCallback(
    (quest: {
      id: string;
      project_id: string;
      name?: string;
    }) => {
      addRecentQuest({
        id: quest.id,
        name: quest.name || 'Quest',
        projectId: quest.project_id,
        visitedAt: new Date()
      });

      const targetProjectId = quest.project_id || projectId;
      router.push(
        href(`/(app)/project/${targetProjectId}/quest/${quest.id}`)
      );
    },
    [router, projectId, addRecentQuest]
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

      addRecentAsset({
        id: asset.id,
        name: asset.name || 'Asset',
        projectId: targetProjectId,
        questId: targetQuestId,
        visitedAt: new Date()
      });

      router.push(
        href(
          `/(app)/project/${targetProjectId}/quest/${targetQuestId}/asset/${asset.id}`
        )
      );
    },
    [router, projectId, questId, addRecentAsset]
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
        href(
          `/(app)/project/${targetProjectId}/quest/${targetQuestId}/recording`
        )
      );
    },
    [router, projectId, questId]
  );

  const goToProfile = useCallback(() => {
    router.push(href('/(app)/profile'));
  }, [router]);

  const goToNotifications = useCallback(() => {
    router.push(href('/(app)/notifications'));
  }, [router]);

  const goToSettings = useCallback(() => {
    router.push(href('/(app)/settings'));
  }, [router]);

  const goToCorruptedAttachments = useCallback(() => {
    router.push(href('/(app)/corrupted-attachments'));
  }, [router]);

  const goToAccountDeletion = useCallback(() => {
    router.push(href('/(app)/account-deletion'));
  }, [router]);

  const goToDownloadStatus = useCallback(() => {
    router.push(href('/(app)/download-status'));
  }, [router]);

  return {
    projectId,
    questId,
    assetId,
    pathname,
    router,
    goToProjects,
    goToProject,
    goToQuest,
    goToAsset,
    goToRecording,
    goToProfile,
    goToNotifications,
    goToSettings,
    goToCorruptedAttachments,
    goToAccountDeletion,
    goToDownloadStatus
  };
}
