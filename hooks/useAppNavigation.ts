/**
 * State-driven navigation system for single-route architecture
 * Replaces Expo Router with instant state transitions
 */

import type { AppView, NavigationStackItem } from '@/store/localStore';
import { useLocalStore } from '@/store/localStore';
import { profiler } from '@/utils/profiler';
import { useCallback, useMemo } from 'react';

export interface NavigationState {
  view: AppView;
  projectId?: string;
  projectName?: string;
  projectTemplate?: string | null;
  questId?: string;
  questName?: string;
  assetId?: string;
  assetName?: string;
}

export function useAppNavigation() {
  const {
    navigationStack,
    setNavigationStack,
    addRecentQuest,
    addRecentAsset
  } = useLocalStore();

  // Current navigation state
  const currentState = useMemo(() => {
    // Ensure navigationStack is always an array
    const stack =
      Array.isArray(navigationStack) && navigationStack.length > 0
        ? navigationStack
        : [{ view: 'projects' as AppView, timestamp: Date.now() }];

    return (
      stack[stack.length - 1] || {
        view: 'projects' as AppView,
        timestamp: Date.now()
      }
    );
  }, [navigationStack]);

  // Navigation functions with instant state transitions
  const navigate = useCallback(
    (newState: Partial<NavigationState>) => {
      profiler.startNavigation(
        `${newState.view}:${newState.projectId || newState.questId || newState.assetId || 'main'}`
      );

      const fullState: NavigationStackItem = {
        ...currentState,
        ...newState,
        timestamp: Date.now()
      };

      setNavigationStack([...navigationStack, fullState]);
      profiler.endNavigation(
        `${newState.view}:${newState.projectId || newState.questId || newState.assetId || 'main'}`
      );
    },
    [currentState, navigationStack, setNavigationStack]
  );

  const goBack = useCallback(() => {
    if (navigationStack.length > 1) {
      setNavigationStack(navigationStack.slice(0, -1));
    }
  }, [navigationStack, setNavigationStack]);

  const goToRoot = useCallback(() => {
    setNavigationStack([{ view: 'projects', timestamp: Date.now() }]);
  }, [setNavigationStack]);

  // Navigate back to a specific view by removing newer entries from the stack
  const goBackToView = useCallback(
    (targetView: AppView) => {
      // Find the last occurrence of the target view in the stack
      let targetIndex = -1;
      for (let i = navigationStack.length - 1; i >= 0; i--) {
        if (navigationStack[i]?.view === targetView) {
          targetIndex = i;
          break;
        }
      }

      if (targetIndex >= 0) {
        // Remove all items after the target
        setNavigationStack(navigationStack.slice(0, targetIndex + 1));
      } else {
        // If not found in stack, navigate fresh
        navigate({ view: targetView });
      }
    },
    [navigationStack, setNavigationStack, navigate]
  );

  // Specific navigation functions
  const goToProjects = useCallback(() => {
    // Check if we're already at a deeper level - if so, go back
    if (currentState.view !== 'projects') {
      goBackToView('projects');
    }
  }, [currentState.view, goBackToView]);

  const goToProject = useCallback(
    (projectData: { id: string; name?: string; template?: string | null }) => {
      // Check if we're already at this project or deeper
      if (
        currentState.projectId === projectData.id &&
        currentState.view === 'quests'
      ) {
        // Already here, do nothing
        return;
      }

      // If we're at a deeper level (assets or asset-detail) with the same project, go back
      if (
        currentState.projectId === projectData.id &&
        (currentState.view === 'assets' || currentState.view === 'asset-detail')
      ) {
        goBackToView('quests');
      } else {
        // Navigate fresh
        navigate({
          view: 'quests',
          projectId: projectData.id,
          projectName: projectData.name,
          projectTemplate: projectData.template
        });
      }
    },
    [currentState, navigate, goBackToView]
  );

  const goToQuest = useCallback(
    (questData: { id: string; project_id: string; name?: string }) => {
      // Track recently visited
      addRecentQuest({
        id: questData.id,
        name: questData.name || 'Quest',
        projectId: questData.project_id,
        visitedAt: new Date()
      });

      // Check if we're already at this quest
      if (
        currentState.questId === questData.id &&
        currentState.view === 'assets'
      ) {
        // Already here, do nothing
        return;
      }

      // If we're at asset-detail for this quest, go back
      if (
        currentState.questId === questData.id &&
        currentState.view === 'asset-detail'
      ) {
        goBackToView('assets');
      } else {
        // Navigate fresh
        navigate({
          view: 'assets',
          questId: questData.id,
          questName: questData.name,
          projectId: questData.project_id
        });
      }
    },
    [currentState, navigate, addRecentQuest, goBackToView]
  );

  const goToAsset = useCallback(
    (assetData: {
      id: string;
      name?: string;
      projectId?: string;
      questId?: string;
    }) => {
      // Use provided IDs or fall back to current state
      const targetProjectId = assetData.projectId || currentState.projectId;
      const targetQuestId = assetData.questId || currentState.questId;

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

      navigate({
        view: 'asset-detail',
        assetId: assetData.id,
        assetName: assetData.name,
        projectId: targetProjectId,
        questId: targetQuestId
      });
    },
    [navigate, currentState, addRecentAsset]
  );

  const goToProfile = useCallback(() => {
    navigate({ view: 'profile' });
  }, [navigate]);

  const goToNotifications = useCallback(() => {
    navigate({ view: 'notifications' });
  }, [navigate]);

  const goToSettings = useCallback(() => {
    navigate({ view: 'settings' });
  }, [navigate]);

  // Breadcrumb navigation
  const breadcrumbs = useMemo(() => {
    const crumbs = [];
    const state = currentState;

    if (state.view === 'projects') {
      crumbs.push({ label: 'Projects', onPress: goToProjects });
    } else if (state.view === 'quests' && state.projectName) {
      crumbs.push({ label: 'Projects', onPress: goToProjects });
      crumbs.push({ label: state.projectName, onPress: undefined });
    } else if (
      state.view === 'assets' &&
      state.projectName &&
      state.questName
    ) {
      crumbs.push({ label: 'Projects', onPress: goToProjects });
      crumbs.push({
        label: state.projectName,
        onPress: () =>
          goToProject({
            id: state.projectId!,
            name: state.projectName,
            template: state.projectTemplate
          })
      });
      crumbs.push({ label: state.questName, onPress: undefined });
    } else if (
      state.view === 'asset-detail' &&
      state.projectName &&
      state.questName &&
      state.assetName
    ) {
      crumbs.push({ label: 'Projects', onPress: goToProjects });
      crumbs.push({
        label: state.projectName,
        onPress: () =>
          goToProject({
            id: state.projectId!,
            name: state.projectName,
            template: state.projectTemplate
          })
      });
      crumbs.push({
        label: state.questName,
        onPress: () =>
          goToQuest({
            id: state.questId!,
            project_id: state.projectId!,
            name: state.questName
          })
      });
      crumbs.push({ label: state.assetName, onPress: undefined });
    }

    return crumbs;
  }, [currentState, goToProjects, goToProject, goToQuest]);

  return {
    // Current state
    currentView: currentState.view,
    currentProjectId: currentState.projectId,
    currentQuestId: currentState.questId,
    currentAssetId: currentState.assetId,
    currentProjectName: currentState.projectName,
    currentProjectTemplate: currentState.projectTemplate,
    currentQuestName: currentState.questName,
    currentAssetName: currentState.assetName,

    // Navigation functions
    navigate,
    goBack,
    goToRoot,
    goToProjects,
    goToProject,
    goToQuest,
    goToAsset,
    goToProfile,
    goToNotifications,
    goToSettings,

    // Utilities
    breadcrumbs,
    canGoBack: navigationStack.length > 1,
    navigationStack
  };
}

export function useCurrentNavigation() {
  const {
    currentView,
    currentProjectId,
    currentQuestId,
    currentAssetId,
    currentProjectName,
    currentProjectTemplate,
    currentQuestName,
    currentAssetName
  } = useAppNavigation();

  // Memoize objects to prevent infinite re-renders
  const currentProject = useMemo(() => {
    return currentProjectId
      ? {
          id: currentProjectId,
          name: currentProjectName || 'Project',
          template: currentProjectTemplate
        }
      : null;
  }, [currentProjectId, currentProjectName, currentProjectTemplate]);

  const currentQuest = useMemo(() => {
    return currentQuestId
      ? {
          id: currentQuestId,
          name: currentQuestName || 'Quest',
          project_id: currentProjectId || ''
        }
      : null;
  }, [currentQuestId, currentQuestName, currentProjectId]);

  const currentAsset = useMemo(() => {
    return currentAssetId
      ? {
          id: currentAssetId,
          name: currentAssetName || 'Asset',
          projectId: currentProjectId,
          questId: currentQuestId
        }
      : null;
  }, [currentAssetId, currentAssetName, currentProjectId, currentQuestId]);

  return {
    currentView,
    currentProjectId,
    currentQuestId,
    currentAssetId,
    currentProject,
    currentQuest,
    currentAsset,
    currentProjectTemplate,
    currentQuestName,
    currentAssetName,
    currentProjectName
  };
}
