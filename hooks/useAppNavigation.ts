/**
 * State-driven navigation system for single-route architecture
 * Replaces Expo Router with instant state transitions
 */

import type { AppView, NavigationStackItem } from '@/store/localStore';
import { useLocalStore } from '@/store/localStore';
import { profiler } from '@/utils/profiler';
import { useCallback, useMemo } from 'react';
import { useLocalization } from './useLocalization';

export interface NavigationState {
  view: AppView;
  projectId?: string;
  projectName?: string;
  projectTemplate?: string | null;
  bookId?: string; // For Bible projects - which book is being viewed
  questId?: string;
  questName?: string;
  assetId?: string;
  assetName?: string;

  // Optional: Pass full data objects to avoid re-querying
  projectData?: Record<string, unknown>;
  bookQuestData?: Record<string, unknown>;
  questData?: Record<string, unknown>;
  assetData?: Record<string, unknown>;

  // Recording view specific data
  recordingData?: {
    recordingSession?: string;
    bookChapterLabel?: string;
    bookChapterLabelFull?: string;
    initialOrderIndex?: number;
    verse?: { from: number; to: number };
    nextVerse?: number | null;
    limitVerse?: number | null;
    label?: string;
  };
}

export function useAppNavigation() {
  const {
    navigationStack,
    setNavigationStack,
    addRecentQuest,
    addRecentAsset
  } = useLocalStore();
  const { t } = useLocalization();

  // Ensure navigationStack is always an array - safe access pattern
  const safeNavigationStack = useMemo(() => {
    if (Array.isArray(navigationStack) && navigationStack.length > 0) {
      return navigationStack;
    }
    // Use a constant timestamp for default state to avoid impure Date.now() in render
    return [{ view: 'projects' as AppView, timestamp: 0 }];
  }, [navigationStack]);

  // Current navigation state - always ensure we have a valid state object
  const currentState = useMemo(() => {
    const stack = safeNavigationStack;
    const lastItem = stack[stack.length - 1];

    // Ensure we always return a properly structured state object
    if (lastItem && typeof lastItem === 'object' && 'view' in lastItem) {
      return lastItem;
    }

    // Fallback to default state if lastItem is malformed
    return {
      view: 'projects' as AppView,
      timestamp: 0
    };
  }, [safeNavigationStack]);

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

      const stack = safeNavigationStack;
      setNavigationStack([...stack, fullState]);
      profiler.endNavigation(
        `${newState.view}:${newState.projectId || newState.questId || newState.assetId || 'main'}`
      );
    },
    [currentState, safeNavigationStack, setNavigationStack]
  );

  const goBack = useCallback(() => {
    const stack = safeNavigationStack;
    if (stack.length > 1) {
      setNavigationStack(stack.slice(0, -1));
    }
  }, [safeNavigationStack, setNavigationStack]);

  const goToRoot = useCallback(() => {
    setNavigationStack([{ view: 'projects', timestamp: Date.now() }]);
  }, [setNavigationStack]);

  // Navigate back to a specific view by removing newer entries from the stack
  const goBackToView = useCallback(
    (targetView: AppView) => {
      const stack = safeNavigationStack;
      // Find the last occurrence of the target view in the stack
      let targetIndex = -1;
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i]?.view === targetView) {
          targetIndex = i;
          break;
        }
      }

      if (targetIndex >= 0) {
        // Remove all items after the target
        setNavigationStack(stack.slice(0, targetIndex + 1));
      } else {
        // If not found in stack, navigate fresh
        navigate({ view: targetView });
      }
    },
    [safeNavigationStack, setNavigationStack, navigate]
  );

  // Specific navigation functions
  const goToProjects = useCallback(() => {
    // Check if we're already at a deeper level - if so, go back
    if (currentState.view !== 'projects') {
      goBackToView('projects');
    }
  }, [currentState.view, goBackToView]);

  const goToProject = useCallback(
    (projectData: {
      id: string;
      name?: string;
      template?: string | null;
      projectData?: Record<string, unknown>;
    }) => {
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
          projectTemplate: projectData.template,
          projectData: projectData.projectData // Pass project data forward!
        });
      }
    },
    [currentState, navigate, goBackToView]
  );

  const goToQuest = useCallback(
    (questData: {
      id: string;
      project_id: string;
      name?: string;
      questData?: Record<string, unknown>;
      projectData?: Record<string, unknown>;
    }) => {
      const usesVerseLabeling =
        questData.projectData?.template === 'bible' ||
        questData.projectData?.template === 'fia';
      const assetView = usesVerseLabeling ? 'bible-assets' : 'assets';
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
        currentState.view === assetView
      ) {
        // Already here, do nothing
        return;
      }

      // If we're at asset-detail for this quest, go back
      if (
        currentState.questId === questData.id &&
        currentState.view === 'asset-detail'
      ) {
        goBackToView(assetView);
      } else {
        // Navigate fresh, pass data forward and preserve bookId (for Bible navigation)
        navigate({
          view: assetView,
          questId: questData.id,
          questName: questData.name,
          projectId: questData.project_id,
          bookId: currentState.bookId, // Preserve bookId for back navigation
          projectData: questData.projectData || currentState.projectData,
          questData: questData.questData
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
      assetData?: Record<string, unknown>;
      questData?: Record<string, unknown>;
      projectData?: Record<string, unknown>;
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
        bookId: currentState.bookId, // Preserve bookId for back navigation
        projectData: assetData.projectData || currentState.projectData,
        questData: assetData.questData || currentState.questData,
        assetData: assetData.assetData
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

  const goToCorruptedAttachments = useCallback(() => {
    navigate({ view: 'corrupted-attachments' });
  }, [navigate]);

  const goToAccountDeletion = useCallback(() => {
    navigate({ view: 'account-deletion' });
  }, [navigate]);

  const goToDownloadStatus = useCallback(() => {
    navigate({ view: 'download-status' });
  }, [navigate]);

  // Breadcrumb navigation
  const breadcrumbs = useMemo(() => {
    const crumbs: { label: string; onPress?: () => void }[] = [];

    const projectsLabel = t('projects');

    // Guard against malformed currentState (should always have view based on useMemo logic)
    if (!('view' in currentState)) {
      return [{ label: projectsLabel, onPress: goToProjects }];
    }

    const state = currentState;

    if (state.view === 'projects') {
      crumbs.push({ label: projectsLabel, onPress: goToProjects });
    } else if (state.view === 'quests' && state.projectName) {
      crumbs.push({ label: projectsLabel, onPress: goToProjects });
      crumbs.push({ label: state.projectName, onPress: undefined });
    } else if (
      (state.view === 'assets' || state.view === 'bible-assets') &&
      state.projectName &&
      state.questName
    ) {
      crumbs.push({ label: projectsLabel, onPress: goToProjects });
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
      crumbs.push({ label: projectsLabel, onPress: goToProjects });
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
            name: state.questName,
            projectData: state.projectData
          })
      });
      crumbs.push({ label: state.assetName, onPress: undefined });
    } else if (
      state.view === 'recording' &&
      state.projectName &&
      state.questName
    ) {
      crumbs.push({ label: projectsLabel, onPress: goToProjects });
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
        onPress: goBack
      });
    }

    // Always return at least one crumb to prevent empty array errors
    return crumbs.length > 0
      ? crumbs
      : [{ label: projectsLabel, onPress: goToProjects }];
  }, [currentState, goToProjects, goToProject, goToQuest, goBack, t]);

  return {
    // Current state
    currentView: currentState.view,
    currentProjectId: currentState.projectId,
    currentQuestId: currentState.questId,
    currentAssetId: currentState.assetId,
    currentProjectName: currentState.projectName,
    currentProjectTemplate: currentState.projectTemplate,
    currentBookId: currentState.bookId,
    currentQuestName: currentState.questName,
    currentAssetName: currentState.assetName,

    // Data objects (for instant navigation)
    currentProjectData: currentState.projectData,
    currentBookQuestData: currentState.bookQuestData,
    currentQuestData: currentState.questData,
    currentAssetData: currentState.assetData,

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
    goToCorruptedAttachments,
    goToAccountDeletion,
    goToDownloadStatus,

    // Utilities
    breadcrumbs,
    canGoBack: safeNavigationStack.length > 1,
    navigationStack: safeNavigationStack
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
    currentBookId,
    currentQuestName,
    currentAssetName,
    currentProjectData,
    currentBookQuestData,
    currentQuestData,
    currentAssetData
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
    currentBookId,
    currentQuestName,
    currentAssetName,
    currentProjectName,
    // Data objects for instant rendering
    currentProjectData,
    currentBookQuestData,
    currentQuestData,
    currentAssetData
  };
}
