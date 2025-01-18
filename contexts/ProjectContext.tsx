import React, { createContext, useContext, useState } from 'react';
import {
  projectService,
  ProjectWithRelations,
} from '@/database_services/projectService';
import {
  questService,
  QuestWithRelations,
} from '@/database_services/questService';
import { AssetWithRelations } from '@/database_services/assetService';
import { useRouter } from 'expo-router';

interface ProjectContextType {
  activeProject: ProjectWithRelations | null;
  recentProjects: ProjectWithRelations[];
  activeQuest: QuestWithRelations | null;
  recentQuests: QuestWithRelations[];
  activeAsset: AssetWithRelations | null;
  recentAssets: AssetWithRelations[];
  goToProject: (project: ProjectWithRelations, navigate?: boolean) => void;
  goToQuest: (quest: QuestWithRelations, navigate?: boolean) => void;
  goToAsset: (asset: AssetWithRelations, navigate?: boolean) => void;
  setActiveProject: (project: ProjectWithRelations | null) => void;
  setActiveQuest: (quest: QuestWithRelations | null) => void;
  setActiveAsset: (asset: AssetWithRelations | null) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [activeProject, setActiveProject] =
    useState<ProjectWithRelations | null>(null);
  const [activeQuest, setActiveQuest] = useState<QuestWithRelations | null>(
    null,
  );
  const [activeAsset, setActiveAsset] = useState<AssetWithRelations | null>(
    null,
  );
  const [recentProjects, setRecentProjects] = useState<ProjectWithRelations[]>(
    [],
  );
  const [recentQuests, setRecentQuests] = useState<QuestWithRelations[]>([]);
  const [recentAssets, setRecentAssets] = useState<AssetWithRelations[]>([]);

  function goToProject(project: ProjectWithRelations, navigate?: boolean) {
    setActiveProject(project);
    setActiveQuest(null);
    setActiveAsset(null);

    router[navigate ? 'navigate' : 'push']({
      pathname: '/quests',
      params: { projectId: project.id, projectName: project.name },
    });

    setRecentProjects((prev) => {
      const filtered = prev.filter((p) => p.id !== project.id);
      return [project, ...filtered].slice(0, 3);
    });
  }

  function goToQuest(quest: QuestWithRelations, navigate?: boolean) {
    setActiveQuest(quest);
    setActiveAsset(null);
    router[navigate ? 'navigate' : 'push']({
      pathname: '/assets',
      params: { questId: quest.id, questName: quest.name },
    });

    setRecentQuests((prev) => {
      const filtered = prev.filter((q) => q.id !== quest.id);
      return [quest, ...filtered].slice(0, 3);
    });

    // change active project based on loaded quest
    projectService.getProjectById(quest.projectId).then(setActiveProject);
  }

  function goToAsset(asset: AssetWithRelations, navigate?: boolean) {
    setActiveAsset(asset);

    router[navigate ? 'navigate' : 'push']({
      pathname: '/assetView',
      params: {
        assetId: asset.id,
        assetName: asset.name,
      },
    });

    setRecentAssets((prev) => {
      const filtered = prev.filter((a) => a.id !== asset.id);
      return [asset, ...filtered].slice(0, 3);
    });

    // change active project and quest based on loaded asset
    projectService.getProjectById(asset.projectId).then(setActiveProject);
    questService.getQuestById(asset.questId).then(setActiveQuest);
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
        setActiveProject,
        setActiveQuest,
        setActiveAsset,
        goToProject,
        goToQuest,
        goToAsset,
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
