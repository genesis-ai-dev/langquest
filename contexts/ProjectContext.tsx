import { Asset } from '@/database_services/assetService';
import { Project, projectService } from '@/database_services/projectService';
import { Quest } from '@/database_services/questService';
import { useRouter } from 'expo-router';
import React, { createContext, useContext, useState } from 'react';

interface ProjectContextType {
  activeProject: Project | null;
  recentProjects: Project[];
  activeQuest: Quest | null;
  recentQuests: Quest[];
  activeAsset: Asset | null;
  recentAssets: Asset[];
  goToProject: (project: Project, navigate?: boolean) => void;
  goToQuest: (quest: Quest, navigate?: boolean) => void;
  goToAsset: (asset: Asset, navigate?: boolean) => void;
  setActiveProject: (project: Project | null) => void;
  setActiveQuest: (quest: Quest | null) => void;
  setActiveAsset: (asset: Asset | null) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [activeQuest, setActiveQuest] = useState<Quest | null>(null);
  const [activeAsset, setActiveAsset] = useState<Asset | null>(null);
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [recentQuests, setRecentQuests] = useState<Quest[]>([]);
  const [recentAssets, setRecentAssets] = useState<Asset[]>([]);

  function goToProject(project: Project, navigate?: boolean) {
    setActiveProject(project);
    setActiveQuest(null);
    setActiveAsset(null);

    router[navigate ? 'navigate' : 'push']({
      pathname: '/quests',
      params: { project_id: project.id, projectName: project.name },
    });

    setRecentProjects((prev) => {
      const filtered = prev.filter((p) => p.id !== project.id);
      return [project, ...filtered].slice(0, 3);
    });
  }

  function goToQuest(quest: Quest, navigate?: boolean) {
    setActiveQuest(quest);
    setActiveAsset(null);
    router[navigate ? 'navigate' : 'push']({
      pathname: '/assets',
      params: { quest_id: quest.id, questName: quest.name },
    });

    setRecentQuests((prev) => {
      const filtered = prev.filter((q) => q.id !== quest.id);
      return [quest, ...filtered].slice(0, 3);
    });

    // change active project based on loaded quest
    projectService.getProjectById(quest.project_id).then(setActiveProject);
  }

  function goToAsset(asset: Asset, navigate?: boolean) {
    setActiveAsset(asset);

    router[navigate ? 'navigate' : 'push']({
      pathname: '/assetView',
      params: {
        asset_id: asset.id,
        assetName: asset.name,
      },
    });

    setRecentAssets((prev) => {
      const filtered = prev.filter((a) => a.id !== asset.id);
      return [asset, ...filtered].slice(0, 3);
    });

    // change active project and quest based on loaded asset
    // will add this back when we restructure stack navigation structure (so we can get the quest and project ids from previous navigation url state)
    // projectService.getProjectById(asset.project_id).then(setActiveProject);
    // questService.getQuestById(asset.quest_id).then(setActiveQuest);
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
