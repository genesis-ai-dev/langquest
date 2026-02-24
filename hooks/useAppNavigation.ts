/**
 * Navigation hook powered by expo-router native stack.
 * All route state (IDs, names) comes from expo-router params.
 * Views use useCurrentNavigation() for read-only context and useAppNavigation() for navigation actions.
 */

import { useLocalization } from '@/hooks/useLocalization';
import type { RecordingData } from '@/store/localStore';
import { useLocalStore } from '@/store/localStore';
import type { Href } from 'expo-router';
import { useGlobalSearchParams, useRouter, useSegments } from 'expo-router';
import { useCallback, useMemo } from 'react';

/** Type helper to cast route strings for typed routes (regenerated at build time) */
function href(path: string, params?: Record<string, string>): Href {
  if (params) {
    return { pathname: path, params } as unknown as Href;
  }
  return path as unknown as Href;
}

export interface NavigationState {
  view: string;
  projectId?: string;
  projectName?: string;
  projectTemplate?: string | null;
  bookId?: string;
  questId?: string;
  questName?: string;
  assetId?: string;
  assetName?: string;
  recordingData?: RecordingData;
}

/**
 * Determine the current "view" name from expo-router segments.
 * Maps route segments to view names used by components (e.g. 'projects', 'quests', 'assets').
 */
function segmentsToView(segments: string[]): string {
  // Remove the (app) group segment
  const filtered = segments.filter((s) => s !== '(app)');

  if (filtered.length === 0) return 'projects';

  const first = filtered[0];

  switch (first) {
    case 'project':
      return 'quests';
    case 'quest':
      return 'assets';
    case 'bible-quest':
      return 'bible-assets';
    case 'asset':
      return 'asset-detail';
    case 'recording':
      return 'recording';
    case 'profile':
      return 'profile';
    case 'notifications':
      return 'notifications';
    case 'settings':
      return 'settings';
    case 'corrupted-attachments':
      return 'corrupted-attachments';
    case 'account-deletion':
      return 'account-deletion';
    case 'download-status':
      return 'download-status';
    default:
      return 'projects';
  }
}

export function useAppNavigation() {
  const router = useRouter();
  const segments = useSegments();
  const params = useGlobalSearchParams<{
    projectId?: string;
    questId?: string;
    assetId?: string;
    projectName?: string;
    projectTemplate?: string;
    questName?: string;
    assetName?: string;
    bookId?: string;
  }>();
  const { addRecentQuest, addRecentAsset } = useLocalStore();
  const { t } = useLocalization();

  const currentView = useMemo(() => segmentsToView(segments), [segments]);

  // Read context from route params (undefined for compatibility with existing views)
  const currentProjectId = (params.projectId as string) || undefined;
  const currentQuestId = (params.questId as string) || undefined;
  const currentAssetId = (params.assetId as string) || undefined;
  const currentProjectName = (params.projectName as string) || undefined;
  const currentProjectTemplate =
    (params.projectTemplate as string) || undefined;
  const currentQuestName = (params.questName as string) || undefined;
  const currentAssetName = (params.assetName as string) || undefined;
  const currentBookId = (params.bookId as string) || undefined;

  // Navigation functions using expo-router
  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    }
  }, [router]);

  const goToRoot = useCallback(() => {
    router.dismissAll();
  }, [router]);

  const goToProjects = useCallback(() => {
    if (currentView !== 'projects') {
      router.dismissTo(href('/(app)/'));
    }
  }, [currentView, router]);

  const goToProject = useCallback(
    (projectData: {
      id: string;
      name?: string;
      template?: string | null;
      projectData?: Record<string, unknown>;
    }) => {
      if (currentProjectId === projectData.id && currentView === 'quests') {
        return; // Already here
      }

      const routeHref = href('/(app)/project/[projectId]', {
        projectId: projectData.id,
        projectName: projectData.name || '',
        projectTemplate: projectData.template || ''
      });

      // If deeper, dismiss back to projects then push
      if (
        currentProjectId === projectData.id &&
        (currentView === 'assets' ||
          currentView === 'asset-detail' ||
          currentView === 'bible-assets')
      ) {
        router.dismissTo(routeHref);
      } else {
        router.push(routeHref);
      }
    },
    [currentProjectId, currentView, router]
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

      addRecentQuest({
        id: questData.id,
        name: questData.name || 'Quest',
        projectId: questData.project_id,
        visitedAt: new Date()
      });

      if (currentQuestId === questData.id && currentView === assetView) {
        return; // Already here
      }

      const routeParams = {
        questId: questData.id,
        projectId: questData.project_id,
        projectName: currentProjectName || '',
        projectTemplate: currentProjectTemplate || '',
        questName: questData.name || '',
        bookId: currentBookId || ''
      };

      if (usesVerseLabeling) {
        router.push(href('/(app)/bible-quest/[questId]', routeParams));
      } else {
        router.push(href('/(app)/quest/[questId]', routeParams));
      }
    },
    [
      currentQuestId,
      currentView,
      currentProjectName,
      currentProjectTemplate,
      currentBookId,
      router,
      addRecentQuest
    ]
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
      const targetProjectId = assetData.projectId || currentProjectId;
      const targetQuestId = assetData.questId || currentQuestId;

      if (!targetProjectId || !targetQuestId) {
        console.warn('Cannot navigate to asset without projectId and questId');
        return;
      }

      addRecentAsset({
        id: assetData.id,
        name: assetData.name || 'Asset',
        projectId: targetProjectId,
        questId: targetQuestId,
        visitedAt: new Date()
      });

      router.push(
        href('/(app)/asset/[assetId]', {
          assetId: assetData.id,
          assetName: assetData.name || '',
          projectId: targetProjectId,
          questId: targetQuestId,
          projectName: currentProjectName || '',
          projectTemplate: currentProjectTemplate || '',
          questName: currentQuestName || '',
          bookId: currentBookId || ''
        })
      );
    },
    [
      currentProjectId,
      currentQuestId,
      currentProjectName,
      currentProjectTemplate,
      currentQuestName,
      currentBookId,
      router,
      addRecentAsset
    ]
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

  // Generic navigate function for backward compatibility (recording, etc.)
  const navigate = useCallback(
    (newState: Partial<NavigationState>) => {
      if (newState.view === 'recording') {
        // Store recording data in Zustand before navigating
        useLocalStore
          .getState()
          .setCurrentRecordingData(newState.recordingData || null);
        router.push(
          href('/(app)/recording', {
            questId: newState.questId || currentQuestId || '',
            projectId: newState.projectId || currentProjectId || '',
            projectName: currentProjectName || '',
            projectTemplate: currentProjectTemplate || '',
            questName: currentQuestName || '',
            bookId: newState.bookId || currentBookId || ''
          })
        );
      } else if (newState.view) {
        // Fallback for any other view navigation
        const viewToRoute: Record<string, string> = {
          projects: '/(app)/',
          quests: '/(app)/project/',
          assets: '/(app)/quest/',
          'bible-assets': '/(app)/bible-quest/',
          'asset-detail': '/(app)/asset/',
          recording: '/(app)/recording',
          profile: '/(app)/profile',
          notifications: '/(app)/notifications',
          settings: '/(app)/settings',
          'corrupted-attachments': '/(app)/corrupted-attachments',
          'account-deletion': '/(app)/account-deletion',
          'download-status': '/(app)/download-status'
        };
        const route = viewToRoute[newState.view];
        if (route) {
          router.push(href(route));
        }
      }
    },
    [
      router,
      currentProjectId,
      currentQuestId,
      currentProjectName,
      currentProjectTemplate,
      currentQuestName,
      currentBookId
    ]
  );

  // Breadcrumb navigation
  const breadcrumbs = useMemo(() => {
    const crumbs: { label: string; onPress?: () => void }[] = [];
    const projectsLabel = t('projects');

    if (currentView === 'projects') {
      crumbs.push({ label: projectsLabel, onPress: goToProjects });
    } else if (currentView === 'quests' && currentProjectName) {
      crumbs.push({ label: projectsLabel, onPress: goToProjects });
      crumbs.push({ label: currentProjectName, onPress: undefined });
    } else if (
      (currentView === 'assets' || currentView === 'bible-assets') &&
      currentProjectName &&
      currentQuestName
    ) {
      crumbs.push({ label: projectsLabel, onPress: goToProjects });
      crumbs.push({
        label: currentProjectName,
        onPress: () =>
          goToProject({
            id: currentProjectId!,
            name: currentProjectName,
            template: currentProjectTemplate
          })
      });
      crumbs.push({ label: currentQuestName, onPress: undefined });
    } else if (
      currentView === 'asset-detail' &&
      currentProjectName &&
      currentQuestName &&
      currentAssetName
    ) {
      crumbs.push({ label: projectsLabel, onPress: goToProjects });
      crumbs.push({
        label: currentProjectName,
        onPress: () =>
          goToProject({
            id: currentProjectId!,
            name: currentProjectName,
            template: currentProjectTemplate
          })
      });
      crumbs.push({
        label: currentQuestName,
        onPress: () =>
          goToQuest({
            id: currentQuestId!,
            project_id: currentProjectId!,
            name: currentQuestName
          })
      });
      crumbs.push({ label: currentAssetName, onPress: undefined });
    } else if (
      currentView === 'recording' &&
      currentProjectName &&
      currentQuestName
    ) {
      crumbs.push({ label: projectsLabel, onPress: goToProjects });
      crumbs.push({
        label: currentProjectName,
        onPress: () =>
          goToProject({
            id: currentProjectId!,
            name: currentProjectName,
            template: currentProjectTemplate
          })
      });
      crumbs.push({
        label: currentQuestName,
        onPress: goBack
      });
    }

    return crumbs.length > 0
      ? crumbs
      : [{ label: projectsLabel, onPress: goToProjects }];
  }, [
    currentView,
    currentProjectId,
    currentProjectName,
    currentProjectTemplate,
    currentQuestId,
    currentQuestName,
    currentAssetName,
    goToProjects,
    goToProject,
    goToQuest,
    goBack,
    t
  ]);

  return {
    // Current state (read from route params)
    currentView,
    currentProjectId,
    currentQuestId,
    currentAssetId,
    currentProjectName,
    currentProjectTemplate,
    currentBookId,
    currentQuestName,
    currentAssetName,

    // Data objects from Zustand cache (for instant navigation)
    currentProjectData: undefined as Record<string, unknown> | undefined,
    currentBookQuestData: undefined as Record<string, unknown> | undefined,
    currentQuestData: undefined as Record<string, unknown> | undefined,
    currentAssetData: undefined as Record<string, unknown> | undefined,

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
    canGoBack: router.canGoBack()
  };
}

/**
 * Read-only hook for accessing current navigation context.
 * Uses route params from expo-router for IDs and names.
 */
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
    currentProjectData,
    currentBookQuestData,
    currentQuestData,
    currentAssetData
  };
}
