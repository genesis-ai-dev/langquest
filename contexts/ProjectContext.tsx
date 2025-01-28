import { Asset, assetService } from '@/database_services/assetService';
import { Project, projectService } from '@/database_services/projectService';
import { Quest, questService } from '@/database_services/questService';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import React, { createContext, useContext, useEffect, useState } from 'react';

interface ProjectContextType {
  activeProject: Project | null;
  recentProjects: Project[];
  activeQuest: Quest | null;
  recentQuests: Quest[];
  activeAsset: Asset | null;
  recentAssets: Asset[];
  goToProject: (project: Project, navigate?: boolean) => void;
  goToQuest: (quest: Quest, navigate?: boolean) => void;
  goToAsset: (
    asset: Asset,
    projectId: string,
    questId: string,
    navigate?: boolean
  ) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [recentQuests, setRecentQuests] = useState<Quest[]>([]);
  const [recentAssets, setRecentAssets] = useState<Asset[]>([]);

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
    router[navigate ? 'navigate' : 'push']({
      pathname: '/projects/[projectId]/quests',
      params: { projectId: project.id, projectName: project.name }
    });

    setRecentProjects((prev) => {
      const filtered = prev.filter((p) => p.id !== project.id);
      return [project, ...filtered].slice(0, 3);
    });
  }

  function goToQuest(quest: Quest, navigate?: boolean) {
    router[navigate ? 'navigate' : 'push']({
      pathname: '/projects/[projectId]/quests/[questId]/assets',
      params: {
        projectId: quest.project_id,
        questId: quest.id,
        questName: quest.name
      }
    });

    setRecentQuests((prev) => {
      const filtered = prev.filter((q) => q.id !== quest.id);
      return [quest, ...filtered].slice(0, 3);
    });
  }

  function goToAsset(
    asset: Asset,
    projectId: string,
    questId: string,
    navigate?: boolean
  ) {
    router[navigate ? 'navigate' : 'push']({
      pathname:
        '/(stack)/projects/[projectId]/quests/[questId]/assets/[assetId]',
      params: {
        projectId,
        questId,
        assetId: asset.id,
        assetName: asset.name
      }
    });

    setRecentAssets((prev) => {
      const filtered = prev.filter((a) => a.id !== asset.id);
      return [asset, ...filtered].slice(0, 3);
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
