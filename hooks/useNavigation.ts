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
    name?: string;
    promptVersionLabel?: string;
  }>();

  const projectId = (params.projectId as string) || undefined;
  const questId = (params.questId as string) || undefined;
  const assetId = (params.assetId as string) || undefined;
  const rawName = params.name;
  const assetNameParam = Array.isArray(rawName)
    ? rawName[0]
    : typeof rawName === 'string' && rawName.length > 0
      ? rawName
      : undefined;
  const rawPromptVersionLabel = params.promptVersionLabel;
  const promptVersionLabel = Array.isArray(rawPromptVersionLabel)
    ? rawPromptVersionLabel[0]
    : typeof rawPromptVersionLabel === 'string' &&
        rawPromptVersionLabel.length > 0
      ? rawPromptVersionLabel
      : undefined;

  const goToProjects = useCallback(() => {
    router.dismissTo('/(app)');
  }, [router]);

  const goToQuest = useCallback(
    (quest: {
      id: string;
      project_id: string;
      name?: string;
      promptVersionLabel?: boolean;
    }) => {
      const targetProjectId = quest.project_id || projectId;
      if (!targetProjectId) {
        console.warn('Cannot navigate to quest without projectId');
        return;
      }

      router.push({
        pathname: '/(app)/project/[projectId]/quest/[questId]',
        params: {
          projectId: targetProjectId,
          questId: quest.id,
          ...(quest.promptVersionLabel ? { promptVersionLabel: '1' } : {})
        }
      });
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

      router.push({
        pathname: '/(app)/project/[projectId]/quest/[questId]/asset/[assetId]',
        params: {
          projectId: targetProjectId,
          questId: targetQuestId,
          assetId: asset.id,
          ...(asset.name ? { name: asset.name } : {})
        }
      });
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

  const goToReviews = useCallback(
    (options: {
      projectId?: string;
      questId?: string;
      subjectName?: string;
      /** Set when opened from a book; the list then filters by metadata. */
      parentQuestId?: string;
      metadata?: Record<string, unknown>;
    }) => {
      const targetProjectId = options.projectId || projectId;
      const targetQuestId = options.questId || questId;

      if (!targetProjectId || !targetQuestId) {
        console.warn('Cannot navigate to reviews without projectId and questId');
        return;
      }

      router.push({
        pathname: '/(app)/project/[projectId]/quest/[questId]/reviews',
        params: {
          projectId: targetProjectId,
          questId: targetQuestId,
          ...(options.subjectName ? { subjectName: options.subjectName } : {}),
          ...(options.parentQuestId
            ? { parentQuestId: options.parentQuestId }
            : {}),
          ...(options.metadata
            ? { metadata: JSON.stringify(options.metadata) }
            : {})
        }
      });
    },
    [router, projectId, questId]
  );

  const goToReviewEdit = useCallback(
    (options: {
      projectId?: string;
      questId?: string;
      reviewId?: string;
      subjectName?: string;
    }) => {
      const targetProjectId = options.projectId || projectId;
      const targetQuestId = options.questId || questId;

      if (!targetProjectId || !targetQuestId) {
        console.warn(
          'Cannot navigate to review edit without projectId and questId'
        );
        return;
      }

      router.push({
        pathname: '/(app)/project/[projectId]/quest/[questId]/review-edit',
        params: {
          projectId: targetProjectId,
          questId: targetQuestId,
          ...(options.reviewId ? { reviewId: options.reviewId } : {}),
          ...(options.subjectName ? { subjectName: options.subjectName } : {})
        }
      });
    },
    [router, projectId, questId]
  );

  const goToReviewResult = useCallback(
    (options: {
      reviewId: string;
      projectId?: string;
      questId?: string;
      subjectName?: string;
    }) => {
      const targetProjectId = options.projectId || projectId;
      const targetQuestId = options.questId || questId;

      if (!targetProjectId || !targetQuestId) {
        console.warn(
          'Cannot navigate to review result without projectId and questId'
        );
        return;
      }

      router.push({
        pathname: '/(app)/project/[projectId]/quest/[questId]/review-result',
        params: {
          projectId: targetProjectId,
          questId: targetQuestId,
          reviewId: options.reviewId,
          ...(options.subjectName ? { subjectName: options.subjectName } : {})
        }
      });
    },
    [router, projectId, questId]
  );

  return {
    projectId,
    questId,
    assetId,
    assetNameParam,
    promptVersionLabel,
    pathname,
    router,
    goToProjects,
    goToQuest,
    goToAsset,
    goToRecording,
    goToReviews,
    goToReviewEdit,
    goToReviewResult
  };
}
