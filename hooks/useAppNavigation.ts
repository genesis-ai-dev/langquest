/**
 * Navigation hook powered by expo-router native stack.
 * All route state (IDs, names) comes from expo-router params.
 * Views use useCurrentNavigation() for read-only context and useAppNavigation() for navigation actions.
 */

import { getLocalizedBookName } from '@/constants/bibleBookNames';
import { useLocalization } from '@/hooks/useLocalization';
import type { SupportedLanguage } from '@/services/localizations';
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
  const { t, currentLanguage } = useLocalization();

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

  const currentBookName = useMemo(() => {
    if (!currentBookId) return undefined;
    if (
      currentProjectTemplate === 'bible' ||
      currentProjectTemplate === 'fia'
    ) {
      return getLocalizedBookName(
        currentBookId,
        currentLanguage as SupportedLanguage
      ).name;
    }
    return undefined;
  }, [currentBookId, currentProjectTemplate, currentLanguage]);

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

      if (
        currentProjectId === projectData.id &&
        (currentView === 'assets' ||
          currentView === 'asset-detail' ||
          currentView === 'bible-assets' ||
          currentView === 'recording')
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

  // Generic navigate function for backward compatibility (recording, book selection, etc.)
  const navigate = useCallback(
    (newState: Partial<NavigationState>) => {
      if (newState.view === 'recording') {
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
      } else if (newState.view === 'projects') {
        router.dismissTo(href('/(app)/'));
      } else if (newState.view === 'quests') {
        router.push(
          href('/(app)/project/[projectId]', {
            projectId: newState.projectId || currentProjectId || '',
            projectName: newState.projectName || currentProjectName || '',
            projectTemplate:
              newState.projectTemplate || currentProjectTemplate || '',
            bookId: newState.bookId || ''
          })
        );
      } else if (newState.view === 'assets') {
        router.push(
          href('/(app)/quest/[questId]', {
            questId: newState.questId || currentQuestId || '',
            projectId: newState.projectId || currentProjectId || '',
            projectName: newState.projectName || currentProjectName || '',
            projectTemplate:
              newState.projectTemplate || currentProjectTemplate || '',
            questName: newState.questName || currentQuestName || '',
            bookId: newState.bookId || currentBookId || ''
          })
        );
      } else if (newState.view === 'bible-assets') {
        router.push(
          href('/(app)/bible-quest/[questId]', {
            questId: newState.questId || currentQuestId || '',
            projectId: newState.projectId || currentProjectId || '',
            projectName: newState.projectName || currentProjectName || '',
            projectTemplate:
              newState.projectTemplate || currentProjectTemplate || '',
            questName: newState.questName || currentQuestName || '',
            bookId: newState.bookId || currentBookId || ''
          })
        );
      } else if (newState.view === 'asset-detail') {
        router.push(
          href('/(app)/asset/[assetId]', {
            assetId: newState.assetId || '',
            assetName: newState.assetName || '',
            projectId: newState.projectId || currentProjectId || '',
            questId: newState.questId || currentQuestId || '',
            projectName: newState.projectName || currentProjectName || '',
            projectTemplate:
              newState.projectTemplate || currentProjectTemplate || '',
            questName: newState.questName || currentQuestName || '',
            bookId: newState.bookId || currentBookId || ''
          })
        );
      } else if (newState.view) {
        const simpleRoutes: Record<string, string> = {
          profile: '/(app)/profile',
          notifications: '/(app)/notifications',
          settings: '/(app)/settings',
          'corrupted-attachments': '/(app)/corrupted-attachments',
          'account-deletion': '/(app)/account-deletion',
          'download-status': '/(app)/download-status'
        };
        const route = simpleRoutes[newState.view];
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

  // Breadcrumbs derived from current view + route params.
  // Uses goToProjects (dismissTo root) for the home crumb.
  // When a bible/fia book is in the path the stack has an extra
  // project/[id]+bookId entry, so dismiss counts shift accordingly.
  const breadcrumbs = useMemo(() => {
    const crumbs: { label: string; onPress?: () => void }[] = [];
    const projectsLabel = t('projects');
    const inProject =
      currentView === 'quests' ||
      currentView === 'assets' ||
      currentView === 'bible-assets' ||
      currentView === 'asset-detail' ||
      currentView === 'recording';
    const inQuest =
      currentView === 'assets' ||
      currentView === 'bible-assets' ||
      currentView === 'asset-detail' ||
      currentView === 'recording';
    const hasBook = !!currentBookId && !!currentBookName;
    const isOnChapterList = currentView === 'quests' && hasBook;

    // ── Projects crumb ──
    crumbs.push({
      label: projectsLabel,
      onPress: inProject ? goToProjects : undefined
    });

    // ── Project crumb ──
    if (inProject && currentProjectName) {
      let projectOnPress: (() => void) | undefined;

      if (isOnChapterList) {
        // Chapter list → book list is 1 screen back
        projectOnPress = goBack;
      } else if (hasBook && inQuest) {
        // Bible path: book list is deeper in the stack due to extra book entry
        // Stack: index, project(books), project+bookId(chapters), quest, [asset/recording]
        const screensToBookList: Record<string, number> = {
          assets: 2,
          'bible-assets': 2,
          'asset-detail': 3,
          recording: 3
        };
        const n = screensToBookList[currentView];
        projectOnPress = n ? () => router.dismiss(n) : undefined;
      } else if (inQuest && currentProjectId) {
        // Non-bible: dismissTo the project route
        projectOnPress = () =>
          goToProject({
            id: currentProjectId,
            name: currentProjectName,
            template: currentProjectTemplate
          });
      }

      crumbs.push({ label: currentProjectName, onPress: projectOnPress });
    }

    // ── Book crumb (bible/fia only) ──
    if (hasBook && (inQuest || isOnChapterList)) {
      let bookOnPress: (() => void) | undefined;

      if (currentView === 'assets' || currentView === 'bible-assets') {
        // Chapter list is 1 screen back
        bookOnPress = goBack;
      } else if (
        currentView === 'asset-detail' ||
        currentView === 'recording'
      ) {
        // Chapter list is 2 screens back
        bookOnPress = () => router.dismiss(2);
      }
      // On chapter list itself: not pressable (undefined)

      crumbs.push({ label: currentBookName, onPress: bookOnPress });
    }

    // ── Quest crumb ──
    if (inQuest && currentQuestName) {
      crumbs.push({
        label: currentQuestName,
        onPress:
          currentView === 'asset-detail' || currentView === 'recording'
            ? goBack
            : undefined
      });
    }

    // ── Asset crumb ──
    if (currentView === 'asset-detail' && currentAssetName) {
      crumbs.push({ label: currentAssetName });
    }

    return crumbs;
  }, [
    currentView,
    currentProjectId,
    currentProjectName,
    currentProjectTemplate,
    currentBookId,
    currentBookName,
    currentQuestName,
    currentAssetName,
    goToProjects,
    goToProject,
    goBack,
    router,
    t
  ]);

  // Make canGoBack reactive by recalculating when segments change
  const canGoBack = useMemo(() => router.canGoBack(), [segments, router]);

  return {
    // Current state (read from route params)
    currentView,
    currentProjectId,
    currentQuestId,
    currentAssetId,
    currentProjectName,
    currentProjectTemplate,
    currentBookId,
    currentBookName,
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
    canGoBack
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
    currentBookName,
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
    currentBookName,
    currentQuestName,
    currentAssetName,
    currentProjectName,
    currentProjectData,
    currentBookQuestData,
    currentQuestData,
    currentAssetData
  };
}
