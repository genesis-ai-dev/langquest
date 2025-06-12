import { getCurrentUser } from '@/contexts/AuthContext';
import { useSystem } from '@/contexts/SystemContext';
import { downloadService } from '@/database_services/downloadService';
import {
  asset_download,
  project_download,
  quest_download
} from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { and, eq } from 'drizzle-orm';
import { useMemo } from 'react';
import {
  convertToFetchConfig,
  createHybridQueryConfig,
  hybridFetch,
  useHybridQuery
} from './useHybridQuery';

// Types for download status records
type ProjectDownload = typeof project_download.$inferSelect;
type QuestDownload = typeof quest_download.$inferSelect;
type AssetDownload = typeof asset_download.$inferSelect;

function getProjectDownloadStatusConfig(projectId: string) {
  const profile = getCurrentUser();

  if (!profile?.id) {
    throw new Error('Profile is required.');
  }

  return createHybridQueryConfig({
    queryKey: ['project-download-status', profile.id, projectId],
    enabled: !!profile.id && !!projectId,
    onlineFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('project_download')
        .select('*')
        .eq('profile_id', profile.id)
        .eq('project_id', projectId)
        .overrideTypes<ProjectDownload[]>();
      if (error) throw error;
      return data;
    },
    offlineQuery: toCompilableQuery(
      system.db.query.project_download.findMany({
        where: and(
          eq(project_download.profile_id, profile.id),
          eq(project_download.project_id, projectId)
        )
      })
    )
  });
}

export async function getProjectDownloadStatus(projectId: string) {
  const downloadArray = await hybridFetch(
    convertToFetchConfig(getProjectDownloadStatusConfig(projectId))
  );

  const isDownloaded = downloadArray?.[0]?.active ?? false;

  return isDownloaded;
}

/**
 * Hook to get project download status
 */
export function useProjectDownloadStatus(projectId: string | undefined) {
  const {
    data: downloadArray,
    isLoading,
    ...rest
  } = useHybridQuery({
    ...getProjectDownloadStatusConfig(projectId!),
    enabled: !!projectId
  });

  const isDownloaded = downloadArray?.[0]?.active ?? false;

  return { isDownloaded, isLoading, ...rest };
}

/**
 * Hook to get quest download status
 */
export function useQuestDownloadStatus(
  profileId: string | undefined,
  questId: string | undefined
) {
  const { db, supabaseConnector } = useSystem();

  const {
    data: downloadArray,
    isLoading,
    ...rest
  } = useHybridQuery({
    queryKey: ['quest-download-status', profileId, questId],
    enabled: !!profileId && !!questId,
    onlineFn: async () => {
      const { data, error } = await supabaseConnector.client
        .from('quest_download')
        .select('*')
        .eq('profile_id', profileId!)
        .eq('quest_id', questId!)
        .overrideTypes<QuestDownload[]>();
      if (error) throw error;
      return data;
    },
    offlineQuery: toCompilableQuery(
      db.query.quest_download.findMany({
        where: and(
          eq(quest_download.profile_id, profileId!),
          eq(quest_download.quest_id, questId!)
        )
      })
    )
  });

  const isDownloaded = downloadArray?.[0]?.active ?? false;
  console.log('isDownloaded', isDownloaded);

  return { isDownloaded, isLoading, ...rest };
}

/**
 * Hook to get asset download status
 */
export function useAssetDownloadStatus(
  profileId: string | undefined,
  assetId: string | undefined
) {
  const { db, supabaseConnector } = useSystem();

  const {
    data: downloadArray,
    isLoading,
    ...rest
  } = useHybridQuery({
    queryKey: ['asset-download-status', profileId, assetId],
    enabled: !!profileId && !!assetId,
    onlineFn: async () => {
      const { data, error } = await supabaseConnector.client
        .from('asset_download')
        .select('*')
        .eq('profile_id', profileId!)
        .eq('asset_id', assetId!)
        .overrideTypes<AssetDownload[]>();
      if (error) throw error;
      return data;
    },
    offlineQuery: toCompilableQuery(
      db.query.asset_download.findMany({
        where: and(
          eq(asset_download.profile_id, profileId!),
          eq(asset_download.asset_id, assetId!),
          eq(asset_download.active, true)
        )
      })
    )
  });

  const isDownloaded = !!downloadArray?.length;

  return { isDownloaded, isLoading, ...rest };
}

/**
 * Hook to get all active downloads for a user
 */
export function useAllActiveDownloads(profileId: string | undefined) {
  const { db, supabaseConnector } = useSystem();

  const {
    data: projects,
    isLoading: isProjectsLoading,
    ...projectsRest
  } = useHybridQuery({
    queryKey: ['active-project-downloads', profileId],
    enabled: !!profileId,
    onlineFn: async () => {
      const { data, error } = await supabaseConnector.client
        .from('project_download')
        .select('*')
        .eq('profile_id', profileId!)
        .eq('active', true)
        .overrideTypes<ProjectDownload[]>();
      if (error) throw error;
      return data;
    },
    offlineQuery: toCompilableQuery(
      db.query.project_download.findMany({
        where: and(
          eq(project_download.profile_id, profileId!),
          eq(project_download.active, true)
        )
      })
    )
  });

  const {
    data: quests,
    isLoading: isQuestsLoading,
    ...questsRest
  } = useHybridQuery({
    queryKey: ['active-quest-downloads', profileId],
    enabled: !!profileId,
    onlineFn: async () => {
      const { data, error } = await supabaseConnector.client
        .from('quest_download')
        .select('*')
        .eq('profile_id', profileId!)
        .eq('active', true)
        .overrideTypes<QuestDownload[]>();
      if (error) throw error;
      return data;
    },
    offlineQuery: toCompilableQuery(
      db.query.quest_download.findMany({
        where: and(
          eq(quest_download.profile_id, profileId!),
          eq(quest_download.active, true)
        )
      })
    )
  });

  const {
    data: assets,
    isLoading: isAssetsLoading,
    ...assetsRest
  } = useHybridQuery({
    queryKey: ['active-asset-downloads', profileId],
    enabled: !!profileId,
    onlineFn: async () => {
      const { data, error } = await supabaseConnector.client
        .from('asset_download')
        .select('*')
        .eq('profile_id', profileId!)
        .eq('active', true)
        .overrideTypes<AssetDownload[]>();
      if (error) throw error;
      return data;
    },
    offlineQuery: toCompilableQuery(
      db.query.asset_download.findMany({
        where: and(
          eq(asset_download.profile_id, profileId!),
          eq(asset_download.active, true)
        )
      })
    )
  });

  const isLoading = isProjectsLoading || isQuestsLoading || isAssetsLoading;

  return {
    projects: projects ?? [],
    quests: quests ?? [],
    assets: assets ?? [],
    isLoading,
    ...projectsRest,
    ...questsRest,
    ...assetsRest
  };
}

/**
 * Hook to get all downloaded asset IDs for a user
 */
export function useDownloadedAssetIds(profileId: string | undefined) {
  const { assets, isLoading, ...rest } = useAllActiveDownloads(profileId);

  const assetIds = useMemo(() => {
    return assets.map((download) => download.asset_id);
  }, [assets]);

  return { assetIds, isLoading, ...rest };
}

/**
 * Hook for project download mutations
 */
export function useProjectDownload(
  profileId: string | undefined,
  projectId: string | undefined
) {
  const queryClient = useQueryClient();
  const { isDownloaded, isLoading } = useProjectDownloadStatus(projectId);

  const mutation = useMutation({
    mutationFn: async (active: boolean) => {
      if (!profileId || !projectId) {
        throw new Error('Profile ID and Project ID are required');
      }
      await downloadService.setProjectDownload(profileId, projectId, active);
    },
    onSuccess: () => {
      // Invalidate related queries
      void queryClient.invalidateQueries({
        queryKey: ['project-download-status', profileId, projectId]
      });
      void queryClient.invalidateQueries({
        queryKey: ['active-project-downloads', profileId]
      });
      void queryClient.invalidateQueries({
        queryKey: ['quest-download-status', profileId]
      });
      void queryClient.invalidateQueries({
        queryKey: ['asset-download-status', profileId]
      });
    }
  });

  const toggleDownload = async () => {
    if (!projectId) return;

    const isDownloaded = await getProjectDownloadStatus(projectId);
    await mutation.mutateAsync(!isDownloaded);
  };

  return {
    isDownloaded,
    isLoading: isLoading || mutation.isPending,
    toggleDownload,
    mutation
  };
}

/**
 * Hook for quest download mutations
 */
export function useQuestDownload(
  profileId: string | undefined,
  questId: string | undefined
) {
  const queryClient = useQueryClient();
  const { isDownloaded, isLoading } = useQuestDownloadStatus(
    profileId,
    questId
  );

  const mutation = useMutation({
    mutationFn: async (active: boolean) => {
      if (!profileId || !questId) {
        throw new Error('Profile ID and Quest ID are required');
      }
      await downloadService.setQuestDownload(profileId, questId, active);
    },
    onSuccess: () => {
      // Invalidate related queries
      void queryClient.invalidateQueries({
        queryKey: ['quest-download-status', profileId, questId]
      });
      void queryClient.invalidateQueries({
        queryKey: ['active-quest-downloads', profileId]
      });
      void queryClient.invalidateQueries({
        queryKey: ['asset-download-status', profileId]
      });
    }
  });

  const toggleDownload = () => {
    mutation.mutate(!isDownloaded);
  };

  return {
    isDownloaded,
    isLoading: isLoading || mutation.isPending,
    toggleDownload,
    mutation
  };
}

/**
 * Hook for asset download mutations
 */
export function useAssetDownload(
  profileId: string | undefined,
  assetId: string | undefined
) {
  const queryClient = useQueryClient();
  const { isDownloaded, isLoading } = useAssetDownloadStatus(
    profileId,
    assetId
  );

  const mutation = useMutation({
    mutationFn: async (active: boolean) => {
      if (!profileId || !assetId) {
        throw new Error('Profile ID and Asset ID are required');
      }
      await downloadService.setAssetDownload(profileId, assetId, active);
    },
    onSuccess: () => {
      // Invalidate related queries
      void queryClient.invalidateQueries({
        queryKey: ['asset-download-status', profileId, assetId]
      });
      void queryClient.invalidateQueries({
        queryKey: ['active-asset-downloads', profileId]
      });
    }
  });

  const toggleDownload = () => {
    mutation.mutate(!isDownloaded);
  };

  return {
    isDownloaded,
    isLoading: isLoading || mutation.isPending,
    toggleDownload,
    mutation
  };
}
