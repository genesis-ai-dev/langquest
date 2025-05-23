import type { Asset } from '@/database_services/assetService';
import { assetService } from '@/database_services/assetService';
import { downloadService } from '@/database_services/downloadService';
import type { Project } from '@/database_services/projectService';
import { projectService } from '@/database_services/projectService';
import type { Quest } from '@/database_services/questService';
import { questService } from '@/database_services/questService';
import type {
  quest,
  quest_asset_link,
  quest_tag_link
} from '@/db/drizzleSchema';
import { quest_view, tag_view } from '@/db/drizzleSchema';
import { useMutation } from '@tanstack/react-query';
import type { Href } from 'expo-router';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { useSystem } from './SystemContext';

interface ProjectContextType {
  activeProject?: Project;
  recentProjects: (Project & { path: Href })[];
  activeQuest?: Quest;
  recentQuests: (Quest & { path: Href })[];
  activeAsset?: Asset;
  recentAssets: (Asset & { path: Href })[];
  goToProject: (project: Project, navigate?: boolean) => Promise<void>;
  goToQuest: (quest: Quest, navigate?: boolean) => Promise<void>;
  goToAsset: (
    href: { asset: Asset; projectId: string; questId: string } | { path: Href },
    navigate?: boolean
  ) => Promise<void>;
  isNavigatingToProject: boolean;
  isNavigatingToQuest: boolean;
  isNavigatingToAsset: boolean;
  deleteAllViews: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const system = useSystem();
  const db = system.db;
  const { currentUser } = useAuth();
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

  const [activeProject, setActiveProject] = useState<Project>();
  const [activeQuest, setActiveQuest] = useState<Quest>();
  const [activeAsset, setActiveAsset] = useState<Asset>();

  const deleteAllViews = async () => {
    if (!currentUser) return;
    console.log('deleting all views');

    const { error: projectViewError } = await system.supabaseConnector.client
      .from('project_view')
      .delete()
      .eq('profile_id', currentUser.id);
    if (projectViewError) throw projectViewError;

    const { error: projectQuestViewError } =
      await system.supabaseConnector.client
        .from('project_quest_view')
        .delete()
        .eq('profile_id', currentUser.id);
    if (projectQuestViewError) throw projectQuestViewError;

    const { error: questViewError } = await system.supabaseConnector.client
      .from('quest_view')
      .delete()
      .eq('profile_id', currentUser.id);
    if (questViewError) throw questViewError;

    const { error: questAssetViewError } = await system.supabaseConnector.client
      .from('quest_asset_view')
      .delete()
      .eq('profile_id', currentUser.id);
    if (questAssetViewError) throw questAssetViewError;

    const { error: assetViewError } = await system.supabaseConnector.client
      .from('asset_view')
      .delete()
      .eq('profile_id', currentUser.id);
    if (assetViewError) throw assetViewError;

    const { error: tagViewError } = await system.supabaseConnector.client
      .from('tag_view')
      .delete()
      .eq('profile_id', currentUser.id);
    if (tagViewError) throw tagViewError;
  };

  useEffect(() => {
    const loadProject = async () => {
      const project = await projectService.getProjectById(projectId);
      setActiveProject(project);
    };
    void loadProject();
  }, [projectId]);

  useEffect(() => {
    const loadQuest = async () => {
      const quest = await questService.getQuestById(questId);
      setActiveQuest(quest);
    };
    void loadQuest();
  }, [questId]);

  useEffect(() => {
    const loadAsset = async () => {
      const asset = await assetService.getAssetById(assetId);
      setActiveAsset(asset);
    };
    void loadAsset();
  }, [assetId]);

  // React Query mutation for navigating to a project
  const goToProjectMutation = useMutation<
    { project: Project; path: Href },
    Error,
    { project: Project; navigate?: boolean }
  >({
    mutationFn: async ({
      project,
      navigate = false
    }: {
      project: Project;
      navigate?: boolean;
    }) => {
      if (!currentUser) throw new Error('User not found');

      const projectDownloaded = await downloadService.getProjectDownloadStatus(
        currentUser.id,
        project.id
      );

      if (!projectDownloaded) {
        await Promise.all([
          deleteAllViews(),
          system.supabaseConnector.client.from('project_view').insert({
            id: `${currentUser.id}_${project.id}`,
            profile_id: currentUser.id,
            project_id: project.id
          })
        ]);

        const { data: quests } = await system.supabaseConnector.client
          .from('quest')
          .select('*')
          .eq('project_id', project.id)
          .overrideTypes<(typeof quest.$inferSelect)[]>();

        if (quests) {
          const questIds = quests.map((quest) => quest.id);

          if (questIds.length > 0) {
            await system.supabaseConnector.client
              .from('project_quest_view')
              .insert(
                questIds.map((questId) => ({
                  id: `${currentUser.id}_${questId}`,
                  profile_id: currentUser.id,
                  quest_id: questId
                }))
              );
          }

          const { data: tags } = await system.supabaseConnector.client
            .from('quest_tag_link')
            .select('*')
            .in('quest_id', questIds)
            .overrideTypes<(typeof quest_tag_link.$inferSelect)[]>();

          if (tags) {
            const tagIds = tags.map((tag) => tag.tag_id);

            const { data: existingTagViews } =
              await system.supabaseConnector.client
                .from('tag_view')
                .select('*')
                .overrideTypes<(typeof tag_view.$inferSelect)[]>();

            const newTagIds = tagIds.filter(
              (tagId) =>
                !existingTagViews?.map((view) => view.tag_id).includes(tagId)
            );

            await system.supabaseConnector.client.from('tag_view').insert(
              newTagIds.map((tagId) => ({
                id: `${currentUser.id}_${tagId}`,
                profile_id: currentUser.id,
                tag_id: tagId
              }))
            );
          }
        }

        await system.init();
      }
      const path: Href = {
        pathname: '/projects/[projectId]/quests',
        params: { projectId: project.id, projectName: project.name }
      };
      router[navigate ? 'navigate' : 'push'](path);
      return { project, path };
    },
    onSuccess: ({ project, path }) => {
      setRecentProjects((prev) => {
        const filtered = prev.filter((p) => p.id !== project.id);
        return [{ ...project, path }, ...filtered].slice(0, 3);
      });
    },
    onError: (error) => {
      console.error('Error navigating to project', error);
    }
  });
  const goToProject = async (project: Project, navigate?: boolean) => {
    await goToProjectMutation.mutateAsync({ project, navigate });
  };

  // React Query mutation for navigating to a quest
  const goToQuestMutation = useMutation<
    { quest: Quest; path: Href },
    Error,
    { quest: Quest; navigate?: boolean }
  >({
    mutationFn: async ({
      quest,
      navigate = false
    }: {
      quest: Quest;
      navigate?: boolean;
    }) => {
      if (!currentUser) throw new Error('User not found');
      const questDownloaded = await downloadService.getQuestDownloadStatus(
        currentUser.id,
        quest.id
      );
      if (!questDownloaded) {
        await db.insert(quest_view).values({
          id: `${currentUser.id}_${quest.id}`,
          profile_id: currentUser.id,
          quest_id: quest.id
        });

        const { data: questAssetLinks } = await system.supabaseConnector.client
          .from('quest_asset_link')
          .select('*')
          .eq('quest_id', quest.id)
          .overrideTypes<(typeof quest_asset_link.$inferSelect)[]>();

        if (questAssetLinks) {
          const assetIds = questAssetLinks.map((link) => link.asset_id);

          if (assetIds.length > 0) {
            await system.supabaseConnector.client
              .from('quest_asset_view')
              .insert(
                assetIds.map((assetId) => ({
                  id: `${currentUser.id}_${assetId}`,
                  profile_id: currentUser.id,
                  asset_id: assetId
                }))
              );
          }
        }

        const { data: questTagLinks } = await system.supabaseConnector.client
          .from('quest_tag_link')
          .select('*')
          .eq('quest_id', quest.id)
          .overrideTypes<(typeof quest_tag_link.$inferSelect)[]>();

        if (questTagLinks) {
          const tagIds = questTagLinks.map((link) => link.tag_id);

          const { data: existingTagViews } =
            await system.supabaseConnector.client
              .from('tag_view')
              .select('*')
              .in('tag_id', tagIds)
              .overrideTypes<(typeof tag_view.$inferSelect)[]>();

          const newTagIds = tagIds.filter(
            (tagId) =>
              !existingTagViews?.map((view) => view.tag_id).includes(tagId)
          );

          if (newTagIds.length > 0) {
            await db.insert(tag_view).values(
              newTagIds.map((tagId) => ({
                id: `${currentUser.id}_${tagId}`,
                profile_id: currentUser.id,
                tag_id: tagId
              }))
            );
          }
        }

        await system.init();
      }
      const path: Href = {
        pathname: '/projects/[projectId]/quests/[questId]/assets',
        params: { projectId: quest.project_id, questId: quest.id }
      };
      router[navigate ? 'navigate' : 'push'](path);
      return { quest, path };
    },
    onSuccess: ({ quest, path }) => {
      setRecentQuests((prev) => {
        const filtered = prev.filter((q) => q.id !== quest.id);
        return [{ ...quest, path }, ...filtered].slice(0, 3);
      });
    },
    onError: (error) => {
      console.error('Error navigating to quest', error);
    }
  });
  const goToQuest = async (quest: Quest, navigate?: boolean) => {
    await goToQuestMutation.mutateAsync({ quest, navigate });
  };

  // React Query mutation for navigating to an asset
  const goToAssetMutation = useMutation<
    Href,
    Error,
    {
      href:
        | { asset: Asset; projectId: string; questId: string }
        | { path: Href };
      navigate?: boolean;
    }
  >({
    mutationFn: async ({
      href,
      navigate = false
    }: {
      href:
        | { asset: Asset; projectId: string; questId: string }
        | { path: Href };
      navigate?: boolean;
    }) => {
      if (!currentUser) throw new Error('User not found');

      const assetId =
        'path' in href
          ? typeof href.path === 'string'
            ? href.path.split('/').pop()!
            : String(href.path.params?.assetId)
          : href.asset.id;

      const assetDownloaded = await downloadService.getAssetDownloadStatus(
        currentUser.id,
        assetId
      );

      if (!assetDownloaded) {
        await system.supabaseConnector.client.from('asset_view').insert({
          id: `${currentUser.id}_${assetId}`,
          profile_id: currentUser.id,
          asset_id: assetId
        });
        await system.init();
      }

      const path: Href =
        'path' in href
          ? href.path
          : {
              pathname:
                '/projects/[projectId]/quests/[questId]/assets/[assetId]',
              params: {
                projectId: href.projectId,
                questId: href.questId,
                assetId: href.asset.id,
                assetName: href.asset.name
              }
            };
      router[navigate ? 'navigate' : 'push'](path);
      return path;
    },
    onSuccess: (path, { href }) => {
      setRecentAssets((prev) => {
        const filtered = prev.filter((a) =>
          'asset' in href ? a.id !== href.asset.id : a.path !== href.path
        );
        return [
          'asset' in href
            ? { ...href.asset, path }
            : prev.find((a) => a.path === href.path)!,
          ...filtered
        ].slice(0, 3);
      });
    }
  });
  const goToAsset = async (
    href: { asset: Asset; projectId: string; questId: string } | { path: Href },
    navigate?: boolean
  ) => {
    await goToAssetMutation.mutateAsync({ href, navigate });
  };

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
        goToAsset,
        isNavigatingToProject: goToProjectMutation.isPending,
        isNavigatingToQuest: goToQuestMutation.isPending,
        isNavigatingToAsset: goToAssetMutation.isPending,
        deleteAllViews
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
