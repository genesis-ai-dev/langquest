/**
 * Lightweight navigation hook to replace heavy ProjectContext
 * Uses route params + local store instead of context + automatic queries
 */

import { useLocalStore } from '@/store/localStore';
import { profiler } from '@/utils/profiler';
import type { Href } from 'expo-router';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';

export function useNavigation() {
  const router = useRouter();
  const {
    setCurrentContext,
    addRecentProject,
    addRecentQuest,
    addRecentAsset
  } = useLocalStore();

  // Get current route params (but don't trigger queries)
  const { projectId, questId, assetId } = useGlobalSearchParams<{
    projectId: string;
    questId: string;
    assetId: string;
  }>();

  // Update local store when route params change
  useEffect(() => {
    setCurrentContext(projectId, questId, assetId);
  }, [projectId, questId, assetId]);

  // Navigation functions that don't trigger automatic queries
  const goToProject = useCallback(
    (projectData: { id: string; name?: string }, navigate = false) => {
      profiler.startNavigation(`project:${projectData.id}`);

      // Track recently visited
      addRecentProject({
        id: projectData.id,
        name: projectData.name || 'Project',
        visitedAt: new Date()
      });

      const path: Href = {
        // @ts-expect-error - Old paths from routes
        pathname: '/projects/[projectId]/quests',
        params: {
          projectId: projectData.id,
          ...(projectData.name && { projectName: projectData.name })
        }
      };

      router[navigate ? 'navigate' : 'push'](path);
      profiler.endNavigation(`project:${projectData.id}`);
    },
    [router, addRecentProject]
  );

  const goToQuest = useCallback(
    (
      questData: { id: string; project_id: string; name?: string },
      navigate = false
    ) => {
      profiler.startNavigation(`quest:${questData.id}`);

      // Track recently visited
      addRecentQuest({
        id: questData.id,
        name: questData.name || 'Quest',
        projectId: questData.project_id,
        visitedAt: new Date()
      });

      const path: Href = {
        // @ts-expect-error - Old paths from routes
        pathname: '/projects/[projectId]/quests/[questId]/assets',
        params: {
          projectId: questData.project_id,
          questId: questData.id,
          ...(questData.name && { questName: questData.name })
        }
      };

      router[navigate ? 'navigate' : 'push'](path);
      profiler.endNavigation(`quest:${questData.id}`);
    },
    [router, addRecentQuest]
  );

  const goToAsset = useCallback(
    (
      assetData: {
        id: string;
        name?: string;
        projectId?: string;
        questId?: string;
      },
      navigate = false
    ) => {
      profiler.startNavigation(`asset:${assetData.id}`);

      // Use provided IDs or fall back to current route params
      const targetProjectId = assetData.projectId || projectId;
      const targetQuestId = assetData.questId || questId;

      if (!targetProjectId || !targetQuestId) {
        console.warn('Cannot navigate to asset without projectId and questId');
        return;
      }

      // Track recently visited
      addRecentAsset({
        id: assetData.id,
        name: assetData.name || 'Asset',
        projectId: targetProjectId,
        questId: targetQuestId,
        visitedAt: new Date()
      });

      const path: Href = {
        // @ts-expect-error - Old paths from routes
        pathname: '/projects/[projectId]/quests/[questId]/assets/[assetId]',
        params: {
          projectId: targetProjectId,
          questId: targetQuestId,
          assetId: assetData.id,
          ...(assetData.name && { assetName: assetData.name })
        }
      };

      router[navigate ? 'navigate' : 'push'](path);
      profiler.endNavigation(`asset:${assetData.id}`);
    },
    [router, projectId, questId, addRecentAsset]
  );

  return {
    // Current route params (components can use these directly)
    currentProjectId: projectId,
    currentQuestId: questId,
    currentAssetId: assetId,

    // Navigation functions
    goToProject,
    goToQuest,
    goToAsset
  };
}

// Hook for components that only need current navigation context
export function useCurrentNavigation() {
  // Use individual selectors to prevent creating new objects
  const currentProjectId = useLocalStore((state) => state.currentProjectId);
  const currentQuestId = useLocalStore((state) => state.currentQuestId);
  const currentAssetId = useLocalStore((state) => state.currentAssetId);

  // Also get route params for names
  const { projectName, questName, assetName } = useGlobalSearchParams<{
    projectName: string;
    questName: string;
    assetName: string;
  }>();

  // Memoize objects to prevent infinite re-renders
  const currentProject = useMemo(() => {
    return currentProjectId
      ? {
          id: currentProjectId,
          name: projectName || 'Project'
        }
      : null;
  }, [currentProjectId, projectName]);

  const currentQuest = useMemo(() => {
    return currentQuestId
      ? {
          id: currentQuestId,
          name: questName || 'Quest',
          project_id: currentProjectId || ''
        }
      : null;
  }, [currentQuestId, questName, currentProjectId]);

  const currentAsset = useMemo(() => {
    return currentAssetId
      ? {
          id: currentAssetId,
          name: assetName || 'Asset',
          projectId: currentProjectId,
          questId: currentQuestId
        }
      : null;
  }, [currentAssetId, assetName, currentProjectId, currentQuestId]);

  return {
    currentProjectId,
    currentQuestId,
    currentAssetId,
    currentProject,
    currentQuest,
    currentAsset
  };
}
