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
  questId?: string;
  questName?: string;
  assetId?: string;
  assetName?: string;
  // Asset navigation context
  assetListContext?: {
    assetIds: string[];
    currentIndex: number;
    searchQuery?: string;
    activeFilters?: Record<string, string[]>;
  };
}

export function useAppNavigation() {
  const {
    navigationStack,
    setNavigationStack,
    addRecentProject,
    addRecentQuest,
    addRecentAsset
  } = useLocalStore();

  // Current navigation state
  const currentState = useMemo(
    () =>
      navigationStack[navigationStack.length - 1] || {
        view: 'projects' as AppView,
        timestamp: Date.now()
      },
    [navigationStack]
  );

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

  // Specific navigation functions
  const goToProjects = useCallback(() => {
    navigate({ view: 'projects' });
  }, [navigate]);

  const goToProject = useCallback(
    (projectData: { id: string; name?: string }) => {
      // Track recently visited
      addRecentProject({
        id: projectData.id,
        name: projectData.name || 'Project',
        visitedAt: new Date()
      });

      navigate({
        view: 'quests',
        projectId: projectData.id,
        projectName: projectData.name
      });
    },
    [navigate, addRecentProject]
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

      navigate({
        view: 'assets',
        questId: questData.id,
        questName: questData.name,
        projectId: questData.project_id
      });
    },
    [navigate, addRecentQuest]
  );

  const goToAsset = useCallback(
    (assetData: {
      id: string;
      name?: string;
      projectId?: string;
      questId?: string;
      assetListContext?: {
        assetIds: string[];
        currentIndex: number;
        searchQuery?: string;
        activeFilters?: Record<string, string[]>;
      };
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
        questId: targetQuestId,
        assetListContext: assetData.assetListContext
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
          goToProject({ id: state.projectId!, name: state.projectName })
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
          goToProject({ id: state.projectId!, name: state.projectName })
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

  // Asset navigation functions
  const goToNextAsset = useCallback(() => {
    const assetListContext = currentState.assetListContext;
    if (!assetListContext || !currentState.projectId || !currentState.questId) return;

    const { assetIds, currentIndex } = assetListContext;
    const nextIndex = currentIndex + 1;

    if (nextIndex < assetIds.length) {
      const nextAssetId = assetIds[nextIndex];
      goToAsset({
        id: nextAssetId,
        name: `Asset ${nextIndex + 1}`,
        projectId: currentState.projectId,
        questId: currentState.questId,
        assetListContext: {
          ...assetListContext,
          currentIndex: nextIndex
        }
      });
    }
  }, [currentState, goToAsset]);

  const goToPreviousAsset = useCallback(() => {
    const assetListContext = currentState.assetListContext;
    if (!assetListContext || !currentState.projectId || !currentState.questId) return;

    const { assetIds, currentIndex } = assetListContext;
    const prevIndex = currentIndex - 1;

    if (prevIndex >= 0) {
      const prevAssetId = assetIds[prevIndex];
      goToAsset({
        id: prevAssetId,
        name: `Asset ${prevIndex + 1}`,
        projectId: currentState.projectId,
        questId: currentState.questId,
        assetListContext: {
          ...assetListContext,
          currentIndex: prevIndex
        }
      });
    }
  }, [currentState, goToAsset]);

  return {
    // Current state
    currentView: currentState.view,
    currentProjectId: currentState.projectId,
    currentQuestId: currentState.questId,
    currentAssetId: currentState.assetId,
    currentProjectName: currentState.projectName,
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

    // Asset navigation
    goToNextAsset,
    goToPreviousAsset,

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
    currentQuestName,
    currentAssetName,
    goToNextAsset,
    goToPreviousAsset,
    navigationStack
  } = useAppNavigation();

  // Get current asset list context
  const currentAssetListContext = useMemo(() => {
    const currentState = navigationStack[navigationStack.length - 1];
    return currentState?.assetListContext || null;
  }, [navigationStack]);

  // Check if we can navigate to next/previous assets
  const canGoToNextAsset = useMemo(() => {
    if (!currentAssetListContext) return false;
    return currentAssetListContext.currentIndex < currentAssetListContext.assetIds.length - 1;
  }, [currentAssetListContext]);

  const canGoToPreviousAsset = useMemo(() => {
    if (!currentAssetListContext) return false;
    return currentAssetListContext.currentIndex > 0;
  }, [currentAssetListContext]);

  // Memoize objects to prevent infinite re-renders
  const currentProject = useMemo(() => {
    return currentProjectId
      ? {
        id: currentProjectId,
        name: currentProjectName || 'Project'
      }
      : null;
  }, [currentProjectId, currentProjectName]);

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
    // Asset navigation context
    currentAssetListContext,
    canGoToNextAsset,
    canGoToPreviousAsset,
    goToNextAsset,
    goToPreviousAsset
  };
}
