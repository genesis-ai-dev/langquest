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

  setRouter(router: Router) {
    this.router = router;
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
  recentProjects: (Project & { path: Href })[];
  activeQuest?: Quest | null;
  recentQuests: (Quest & { path: Href })[];
  activeAsset?: Asset | null;
  recentAssets: (Asset & { path: Href })[];
  goToProject: (project: Project, navigate?: boolean) => void;
  goToQuest: (quest: Quest, navigate?: boolean) => void;
  goToAsset: (
    href: { asset: Asset; projectId: string; questId: string } | { path: Href },
    navigate?: boolean
  ) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const routerRef = useRef(router);

  // Only track recent items for UI display - methods are singleton
  const [recentUpdateTrigger, setRecentUpdateTrigger] = useState(0);

  const { projectId, questId, assetId } = useGlobalSearchParams<{
    projectId: string;
    questId: string;
    assetId: string;
  }>();

  debug('🔄 Route params changed:', {
    projectId,
    questId,
    assetId,
    navigationDuration: navigationStartTime
      ? `${(performance.now() - navigationStartTime).toFixed(2)}ms`
      : 'No active navigation'
  });

  // Reset navigation timer when route changes
  if (navigationStartTime) {
    const duration = performance.now() - navigationStartTime;
    debug('🏁 Navigation completed in:', `${duration.toFixed(2)}ms`);
    navigationStartTime = null;
  }

  // Initialize singleton with router
  React.useEffect(() => {
    routerRef.current = router;
    navigationManager.setRouter(router);
  }, [router]);

  // Only run database hooks when IDs are actually present
  const { project: activeProject } = useProjectById(projectId);
  const { quest: activeQuest } = useQuestById(questId);
  const { asset: activeAsset } = useAssetById(assetId);

  debug('📊 Active entities loaded:', {
    activeProject: activeProject
      ? { id: activeProject.id, name: activeProject.name }
      : null,
    activeQuest: activeQuest
      ? { id: activeQuest.id, name: activeQuest.name }
      : null,
    activeAsset: activeAsset
      ? { id: activeAsset.id, name: activeAsset.name }
      : null
  });

  // Stable navigation methods that don't cause re-renders
  const goToAssetWithParams = useCallback(
    (
      href:
        | { asset: Asset; projectId: string; questId: string }
        | { path: Href },
      navigate?: boolean
    ) => {
      navigationManager.goToAsset(href, navigate, { projectId, questId });
      setRecentUpdateTrigger((prev) => prev + 1); // Trigger UI update
    },
    [projectId, questId]
  );

  const contextValue = useMemo(() => {
    const value = {
      activeProject,
      recentProjects: navigationManager.getRecentProjects(),
      activeQuest,
      recentQuests: navigationManager.getRecentQuests(),
      activeAsset,
      recentAssets: navigationManager.getRecentAssets(),
      goToProject: navigationManager.goToProject,
      goToQuest: navigationManager.goToQuest,
      goToAsset: goToAssetWithParams
    };

    debug('🔄 Context value updated:', {
      activeProject: activeProject
        ? { id: activeProject.id, name: activeProject.name }
        : null,
      activeQuest: activeQuest
        ? { id: activeQuest.id, name: activeQuest.name }
        : null,
      activeAsset: activeAsset
        ? { id: activeAsset.id, name: activeAsset.name }
        : null,
      recentProjectsCount: navigationManager.getRecentProjects().length,
      recentQuestsCount: navigationManager.getRecentQuests().length,
      recentAssetsCount: navigationManager.getRecentAssets().length
    });

    return value;
  }, [
    activeProject,
    activeQuest,
    activeAsset,
    goToAssetWithParams,
    recentUpdateTrigger // Only re-render when recent items actually change
  ]);

  return (
    <ProjectContext.Provider value={contextValue}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjectContext() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProjectContext must be used within a ProjectProvider');
  }

  hookCallCount++;
  debug('🔗 useProjectContext hook called (total calls:', hookCallCount + ')');

  return context;
}
