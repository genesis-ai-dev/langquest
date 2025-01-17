import React, { createContext, useContext, useState } from 'react';
import { Project } from '@/database_services/projectService';
import { Quest } from '@/database_services/questService';
import { Asset } from '@/database_services/assetService';
import { useRouter } from 'expo-router';

interface ProjectContextType {
  activeProject: Project | null;
  recentProjects: Project[];
  activeQuest: Quest | null;
  recentQuests: Quest[];
  activeAsset: Asset | null;
  recentAssets: Asset[];
  goToProject: (project: Project) => void;
  goToQuest: (quest: Quest) => void;
  goToAsset: (quest: Asset) => void;
  setActiveProject: (project: Project | null) => void;
  setActiveQuest: (quest: Quest | null) => void;
  setActiveAsset: (asset: Asset | null) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [activeProject, setActiveProject] =
    useState<Project | null>(null);
  const [activeQuest, setActiveQuest] = useState<Quest | null>(
    null,
  );
  const [activeAsset, setActiveAsset] = useState<Asset | null>(
    null,
  );
  const [recentProjects, setRecentProjects] = useState<Project[]>(
    [],
  );
  const [recentQuests, setRecentQuests] = useState<Quest[]>([]);
  const [recentAssets, setRecentAssets] = useState<Asset[]>([]);

  function goToProject(project: Project) {
    router.push({
      pathname: '/quests',
      params: { projectId: project.id, projectName: project.name },
    });
    const filteredProjects = recentProjects.filter((p) => p.id !== project.id);
    filteredProjects.push(project);
    filteredProjects.reverse();

    setRecentProjects(filteredProjects.slice(0, 3)); // Keep only last 3 projects
  }

  function goToQuest(quest: Quest) {
    router.push({
      pathname: '/assets',
      params: { questId: quest.id, questName: quest.name },
    });
    const filteredQuests = recentQuests.filter((q) => q.id !== quest.id);
    filteredQuests.push(quest);
    filteredQuests.reverse();
    setRecentQuests(filteredQuests.slice(0, 3)); // Keep only last 3 quests
  }

  function goToAsset(asset: Asset) {
    router.push({
      pathname: '/assetView',
      params: {
        assetId: asset.id,
        assetName: asset.name,
      },
    });
    const filteredAssets = recentAssets.filter((a) => a.id !== asset.id);
    filteredAssets.reverse();
    filteredAssets.push(asset);
    setRecentAssets(filteredAssets.slice(0, 3)); // Keep only last 3 assets
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
