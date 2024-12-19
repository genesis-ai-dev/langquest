import React, { createContext, useContext, useState } from 'react';
import { Project } from '@/database_services/projectService';
import { Quest } from '@/database_services/questService';
import { AssetWithRelations } from '@/database_services/assetService';

interface ProjectContextType {
  activeProject: Project | null;
  activeQuest: Quest | null;
  activeAsset: AssetWithRelations | null;
  setActiveProject: (project: Project | null) => void;
  setActiveQuest: (quest: Quest | null) => void;
  setActiveAsset: (asset: AssetWithRelations | null) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [activeQuest, setActiveQuest] = useState<Quest | null>(null);
  const [activeAsset, setActiveAsset] = useState<AssetWithRelations | null>(null);

  return (
    <ProjectContext.Provider value={{
        activeProject,
        activeQuest,
        activeAsset,
        setActiveProject,
        setActiveQuest,
        setActiveAsset,
    }}>
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