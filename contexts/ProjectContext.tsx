import { Asset, assetService } from '@/database_services/assetService';
import { Project, projectService } from '@/database_services/projectService';
import { Quest, questService } from '@/database_services/questService';
import { Href, useGlobalSearchParams, useRouter } from 'expo-router';
import React, { createContext, useContext, useEffect, useState } from 'react';

interface ProjectContextType {
  activeProject: Project | null;
  recentProjects: (Project & { path: Href<string> })[];
  activeQuest: Quest | null;
  recentQuests: (Quest & { path: Href<string> })[];
  activeAsset: Asset | null;
  recentAssets: (Asset & { path: Href<string> })[];
  goToProject: (project: Project, navigate?: boolean) => void;
  goToQuest: (quest: Quest, navigate?: boolean) => void;
  goToAsset: (
    href:
      | { asset: Asset; projectId: string; questId: string }
      | { path: Href<string> },
    navigate?: boolean
  ) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [recentProjects, setRecentProjects] = useState<
    (Project & { path: Href<string> })[]
  >([]);
  const [recentQuests, setRecentQuests] = useState<
    (Quest & { path: Href<string> })[]
  >([]);
  const [recentAssets, setRecentAssets] = useState<
    (Asset & { path: Href<string> })[]
  >([]);

  const { projectId, questId, assetId } = useGlobalSearchParams<{
    projectId: string;
    questId: string;
    assetId: string;
  }>();

  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [activeQuest, setActiveQuest] = useState<Quest | null>(null);
  const [activeAsset, setActiveAsset] = useState<Asset | null>(null);

  useEffect(() => {
    projectService.getProjectById(projectId).then(setActiveProject);
  }, [projectId]);

  useEffect(() => {
    questService.getQuestById(questId).then(setActiveQuest);
  }, [questId]);

  useEffect(() => {
    assetService.getAssetById(assetId).then(setActiveAsset);
  }, [assetId]);

  function goToProject(project: Project, navigate?: boolean) {
    const path: Href<string> = {
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
  }

  function goToQuest(quest: Quest, navigate?: boolean) {
    const path: Href<string> = {
      pathname: '/projects/[projectId]/quests/[questId]/assets',
      params: {
        projectId: quest.project_id,
        questId: quest.id,
        questName: quest.name
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
  }

  function goToAsset(
    href:
      | { asset: Asset; projectId: string; questId: string }
      | { path: Href<string> },
    navigate?: boolean
  ) {
    const path: Href<string> =
      'path' in href
        ? href.path
        : {
            pathname: '/projects/[projectId]/quests/[questId]/assets/[assetId]',
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
  }

  return (
    <ProjectContext.Provider
      value={{
        activeProject,
        recentProjects,
        activeQuest,
        recentQuests,
        activeAsset,
        recentAssets,
        goToProject,
        goToQuest,
        goToAsset
      }}
    >
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
