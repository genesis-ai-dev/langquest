import type { Asset } from '@/database_services/assetService';
import type { Project } from '@/database_services/projectService';
import type { Quest } from '@/database_services/questService';
import { useAssetById } from '@/hooks/db/useAssets';
import { useProjectById } from '@/hooks/db/useProjects';
import { useQuestById } from '@/hooks/db/useQuests';
import type { Href, Router } from 'expo-router';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState
} from 'react';

const DEBUG_MODE = __DEV__;
const debug = (...args: unknown[]) => {
  if (DEBUG_MODE) {
    const timestamp = new Date().toISOString().substring(11, 23);
    const perfNow = performance.now().toFixed(2);
    console.log(`[${timestamp}] [${perfNow}ms] ProjectContext:`, ...args);
  }
};

// Track navigation timing
let navigationStartTime: number | null = null;
let hookCallCount = 0;

// **SINGLETON NAVIGATION MANAGER** - No re-renders needed
class NavigationManager {
  private router: Router | null = null;
  private recentProjects: (Project & { path: Href })[] = [];
  private recentQuests: (Quest & { path: Href })[] = [];
  private recentAssets: (Asset & { path: Href })[] = [];
  private listeners = new Map<string, Set<() => void>>();

  setRouter(router: Router) {
    this.router = router;
  }

  private notifyListeners(type: 'projects' | 'quests' | 'assets') {
    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      typeListeners.forEach((listener) => listener());
    }
  }

  subscribe(type: 'projects' | 'quests' | 'assets', listener: () => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
    return () => {
      this.listeners.get(type)?.delete(listener);
    };
  }

  goToProject = (project: Project, navigate?: boolean) => {
    console.log('goToProject firing at', performance.now());
    if (!this.router) return;

    navigationStartTime = performance.now();

    debug('🚀 goToProject called:', {
      project: { id: project.id, name: project.name },
      navigate,
      method: navigate ? 'navigate' : 'push',
      startTime: navigationStartTime
    });

    const path: Href = {
      pathname: '/projects/[projectId]/quests',
      params: { projectId: project.id, projectName: project.name }
    };

    debug('🎯 Generated path:', path);

    this.router[navigate ? 'navigate' : 'push'](path);

    // Update recent projects without triggering re-renders
    const filtered = this.recentProjects.filter((p) => p.id !== project.id);
    this.recentProjects = [{ ...project, path }, ...filtered].slice(0, 3);

    // Only notify project listeners
    this.notifyListeners('projects');

    debug('📝 Updated recent projects:', {
      newCount: this.recentProjects.length,
      addedProject: { id: project.id, name: project.name }
    });
  };

  goToQuest = (quest: Quest, navigate?: boolean) => {
    if (!this.router) return;

    navigationStartTime = performance.now();

    debug('🚀 goToQuest called:', {
      quest: { id: quest.id, name: quest.name, project_id: quest.project_id },
      navigate,
      method: navigate ? 'navigate' : 'push',
      startTime: navigationStartTime
    });

    const path: Href = {
      pathname: '/projects/[projectId]/quests/[questId]/assets',
      params: {
        projectId: quest.project_id,
        questId: quest.id
      }
    };

    debug('🎯 Generated path:', path);

    this.router[navigate ? 'navigate' : 'push'](path);

    const filtered = this.recentQuests.filter((q) => q.id !== quest.id);
    this.recentQuests = [{ ...quest, path }, ...filtered].slice(0, 3);

    // Only notify quest listeners
    this.notifyListeners('quests');

    debug('📝 Updated recent quests:', {
      newCount: this.recentQuests.length,
      addedQuest: { id: quest.id, name: quest.name }
    });
  };

  goToAsset = (
    href: { asset: Asset; projectId: string; questId: string } | { path: Href },
    navigate?: boolean,
    currentParams?: { projectId: string; questId: string }
  ) => {
    if (!this.router || !currentParams) return;

    navigationStartTime = performance.now();

    debug('🚀 goToAsset called:', {
      href:
        'asset' in href
          ? {
              type: 'asset',
              asset: { id: href.asset.id, name: href.asset.name },
              projectId: href.projectId,
              questId: href.questId
            }
          : { type: 'path', path: href.path },
      navigate,
      method: navigate ? 'navigate' : 'push',
      currentParams,
      startTime: navigationStartTime
    });

    const path: Href =
      'path' in href
        ? href.path
        : {
            pathname: '/projects/[projectId]/quests/[questId]/assets/[assetId]',
            params: {
              projectId: currentParams.projectId,
              questId: currentParams.questId,
              assetId: href.asset.id,
              assetName: href.asset.name
            }
          };

    debug('🎯 Generated path:', path);

    this.router[navigate ? 'navigate' : 'push'](path);

    const filtered = this.recentAssets.filter((a) =>
      'asset' in href ? a.id !== href.asset.id : a.path !== href.path
    );
    const newAssetEntry =
      'asset' in href
        ? { ...href.asset, path }
        : this.recentAssets.find((a) => a.path === href.path)!;

    this.recentAssets = [newAssetEntry, ...filtered].slice(0, 3);

    // Only notify asset listeners
    this.notifyListeners('assets');

    debug('📝 Updated recent assets:', {
      newCount: this.recentAssets.length,
      addedAsset:
        'asset' in href
          ? { id: href.asset.id, name: href.asset.name }
          : { path: href.path }
    });
  };

  getRecentProjects = () => [...this.recentProjects];
  getRecentQuests = () => [...this.recentQuests];
  getRecentAssets = () => [...this.recentAssets];

  // Performance monitoring
  getPerformanceStats = () => ({
    recentProjectsCount: this.recentProjects.length,
    recentQuestsCount: this.recentQuests.length,
    recentAssetsCount: this.recentAssets.length,
    totalHookCalls: hookCallCount,
    lastNavigationTime: navigationStartTime
      ? `${(performance.now() - navigationStartTime).toFixed(2)}ms ago`
      : 'No recent navigation'
  });
}

// Global singleton instance
const navigationManager = new NavigationManager();

interface ProjectContextType {
  activeProject?: Project | null;
  activeQuest?: Quest | null;
  activeAsset?: Asset | null;
  goToProject: (project: Project, navigate?: boolean) => void;
  goToQuest: (quest: Quest, navigate?: boolean) => void;
  goToAsset: (
    href: { asset: Asset; projectId: string; questId: string } | { path: Href },
    navigate?: boolean
  ) => void;
}

interface ProjectRecentItemsContextType {
  recentProjects: (Project & { path: Href })[];
  recentQuests: (Quest & { path: Href })[];
  recentAssets: (Asset & { path: Href })[];
}

// Split contexts to prevent unnecessary re-renders
const ProjectContext = createContext<ProjectContextType | undefined>(undefined);
const ProjectRecentItemsContext = createContext<
  ProjectRecentItemsContextType | undefined
>(undefined);

// Custom hooks for granular subscriptions
function useRecentProjects() {
  const [recentProjects, setRecentProjects] = useState(() =>
    navigationManager.getRecentProjects()
  );

  React.useEffect(() => {
    const updateProjects = () => {
      setRecentProjects(navigationManager.getRecentProjects());
    };
    const unsubscribe = navigationManager.subscribe('projects', updateProjects);
    return unsubscribe;
  }, []);

  return recentProjects;
}

function useRecentQuests() {
  const [recentQuests, setRecentQuests] = useState(() =>
    navigationManager.getRecentQuests()
  );

  React.useEffect(() => {
    const updateQuests = () => {
      setRecentQuests(navigationManager.getRecentQuests());
    };
    const unsubscribe = navigationManager.subscribe('quests', updateQuests);
    return unsubscribe;
  }, []);

  return recentQuests;
}

function useRecentAssets() {
  const [recentAssets, setRecentAssets] = useState(() =>
    navigationManager.getRecentAssets()
  );

  React.useEffect(() => {
    const updateAssets = () => {
      setRecentAssets(navigationManager.getRecentAssets());
    };
    const unsubscribe = navigationManager.subscribe('assets', updateAssets);
    return unsubscribe;
  }, []);

  return recentAssets;
}

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const routerRef = useRef(router);

  const { projectId, questId, assetId } = useGlobalSearchParams<{
    projectId: string;
    questId: string;
    assetId: string;
  }>();

  // Memoize params to prevent unnecessary comparisons
  const memoizedParams = useMemo(
    () => ({ projectId, questId, assetId }),
    [projectId, questId, assetId]
  );

  debug('🔄 Route params:', memoizedParams);

  // Reset navigation timer when route changes
  React.useEffect(() => {
    if (navigationStartTime) {
      const duration = performance.now() - navigationStartTime;
      debug('🏁 Navigation completed in:', `${duration.toFixed(2)}ms`);
      navigationStartTime = null;
    }
  }, [memoizedParams]);

  // Initialize singleton with router
  React.useEffect(() => {
    routerRef.current = router;
    navigationManager.setRouter(router);
  }, [router]);

  // Only run database hooks when IDs are actually present
  // These hooks should have their own caching and won't re-fetch if data exists
  const { project: activeProject } = useProjectById(projectId);
  const { quest: activeQuest } = useQuestById(questId);
  const { asset: activeAsset } = useAssetById(assetId);

  // Get recent items using granular hooks
  const recentProjects = useRecentProjects();
  const recentQuests = useRecentQuests();
  const recentAssets = useRecentAssets();

  // Stable navigation methods that don't cause re-renders
  const goToAssetWithParams = useCallback(
    (
      href:
        | { asset: Asset; projectId: string; questId: string }
        | { path: Href },
      navigate?: boolean
    ) => {
      navigationManager.goToAsset(href, navigate, memoizedParams);
    },
    [memoizedParams]
  );

  // Main context value - only changes when active items change
  const contextValue = useMemo(
    () => ({
      activeProject,
      activeQuest,
      activeAsset,
      goToProject: navigationManager.goToProject,
      goToQuest: navigationManager.goToQuest,
      goToAsset: goToAssetWithParams
    }),
    [activeProject, activeQuest, activeAsset, goToAssetWithParams]
  );

  // Recent items context value - only changes when recent items change
  const recentItemsValue = useMemo(
    () => ({
      recentProjects,
      recentQuests,
      recentAssets
    }),
    [recentProjects, recentQuests, recentAssets]
  );

  return (
    <ProjectContext.Provider value={contextValue}>
      <ProjectRecentItemsContext.Provider value={recentItemsValue}>
        {children}
      </ProjectRecentItemsContext.Provider>
    </ProjectContext.Provider>
  );
}

// Main hook - only re-renders when active items or navigation methods change
export function useProjectContext() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProjectContext must be used within a ProjectProvider');
  }

  // Only log in development and reduce frequency
  if (__DEV__ && ++hookCallCount % 50 === 0) {
    debug(
      '🔗 useProjectContext hook called (total calls:',
      hookCallCount + ')'
    );
  }

  return context;
}

// Hook for recent items - only re-renders when recent items change
export function useProjectRecentItems() {
  const context = useContext(ProjectRecentItemsContext);
  if (context === undefined) {
    throw new Error(
      'useProjectRecentItems must be used within a ProjectProvider'
    );
  }
  return context;
}

// Granular hooks for specific recent items
export { useRecentAssets, useRecentProjects, useRecentQuests };
