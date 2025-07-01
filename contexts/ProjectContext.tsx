import type { Asset } from '@/database_services/assetService';
import type { Project } from '@/database_services/projectService';
import type { Quest } from '@/database_services/questService';
import { useAssetById } from '@/hooks/db/useAssets';
import { useProjectById } from '@/hooks/db/useProjects';
import { useQuestById } from '@/hooks/db/useQuests';
import type { Href } from 'expo-router';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState
} from 'react';

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
  const [recentProjects, setRecentProjects] = useState<
    (Project & { path: Href })[]
  >([]);
  const [recentQuests, setRecentQuests] = useState<(Quest & { path: Href })[]>(
    []
  );
  const [recentAssets, setRecentAssets] = useState<(Asset & { path: Href })[]>(
    []
  );

  const { projectId, questId, assetId } = useGlobalSearchParams<{
    projectId: string;
    questId: string;
    assetId: string;
  }>();

  // Only run database hooks when IDs are actually present
  const { project: activeProject } = useProjectById(projectId);
  const { quest: activeQuest } = useQuestById(questId);
  const { asset: activeAsset } = useAssetById(assetId);

  const goToProject = useCallback(
    (project: Project, navigate?: boolean) => {
      const path: Href = {
        pathname: '/projects/[projectId]/quests',
        params: { projectId: project.id, projectName: project.name }
      };
      router[navigate ? 'navigate' : 'push'](path);

      setRecentProjects((prev) => {
        const filtered = prev.filter((p) => p.id !== project.id);
        return [
          {
            ...project,
            path
          },
          ...filtered
        ].slice(0, 3);
      });
    },
    [router]
  );

  const goToQuest = useCallback(
    (quest: Quest, navigate?: boolean) => {
      const path: Href = {
        pathname: '/projects/[projectId]/quests/[questId]/assets',
        params: {
          projectId: quest.project_id,
          questId: quest.id
        }
      };
      router[navigate ? 'navigate' : 'push'](path);

      setRecentQuests((prev) => {
        const filtered = prev.filter((q) => q.id !== quest.id);
        return [
          {
            ...quest,
            path
          },
          ...filtered
        ].slice(0, 3);
      });
    },
    [router]
  );

  const goToAsset = useCallback(
    (
      href:
        | { asset: Asset; projectId: string; questId: string }
        | { path: Href },
      navigate?: boolean
    ) => {
      const path: Href =
        'path' in href
          ? href.path
          : {
              pathname:
                '/projects/[projectId]/quests/[questId]/assets/[assetId]',
              params: {
                projectId,
                questId,
                assetId: href.asset.id,
                assetName: href.asset.name
              }
            };

      router[navigate ? 'navigate' : 'push'](path);

      setRecentAssets((prev) => {
        const filtered = prev.filter((a) =>
          'asset' in href ? a.id !== href.asset.id : a.path !== href.path
        );
        return [
          'asset' in href
            ? {
                ...href.asset,
                path
              }
            : prev.find((a) => a.path === href.path)!,
          ...filtered
        ].slice(0, 3);
      });
    },
    [router, projectId, questId]
  );

  const contextValue = useMemo(
    () => ({
      activeProject,
      recentProjects,
      activeQuest,
      recentQuests,
      activeAsset,
      recentAssets,
      goToProject,
      goToQuest,
      goToAsset
    }),
    [
      activeProject,
      recentProjects,
      activeQuest,
      recentQuests,
      activeAsset,
      recentAssets,
      goToProject,
      goToQuest,
      goToAsset
    ]
  );

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
  return context;
}
