import React, { createContext, useContext, useState } from 'react';
import { ProjectWithRelations } from '@/database_services/projectService';
import { QuestWithRelations } from '@/database_services/questService';
import { AssetWithRelations } from '@/database_services/assetService';
import { useRouter } from 'expo-router';

interface ProjectContextType {
  activeProject: ProjectWithRelations | null;
  recentProjects: ProjectWithRelations[];
  activeQuest: QuestWithRelations | null;
  recentQuests: QuestWithRelations[];
  activeAsset: AssetWithRelations | null;
  recentAssets: AssetWithRelations[];
  goToProject: (project: ProjectWithRelations) => void;
  goToQuest: (quest: QuestWithRelations) => void;
  goToAsset: (quest: AssetWithRelations) => void;
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

  function goToProject(project: ProjectWithRelations) {
    router.push({
      pathname: '/quests',
      params: { projectId: project.id, projectName: project.name },
    });
    const filteredProjects = recentProjects.filter((p) => p.id !== project.id);
    filteredProjects.push(project);
    filteredProjects.reverse();

    setRecentProjects(filteredProjects.slice(0, 3)); // Keep only last 3 projects
  }

  function goToQuest(quest: QuestWithRelations) {
    router.push({
      pathname: '/assets',
      params: { questId: quest.id, questName: quest.name },
    });
    const filteredQuests = recentQuests.filter((q) => q.id !== quest.id);
    filteredQuests.push(quest);
    filteredQuests.reverse();
    setRecentQuests(filteredQuests.slice(0, 3)); // Keep only last 3 quests
  }

  function goToAsset(asset: AssetWithRelations) {
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
