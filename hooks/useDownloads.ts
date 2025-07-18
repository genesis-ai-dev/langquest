import { useAuth } from '@/contexts/AuthContext';
import { system } from '@/db/powersync/system';
import { useHybridQuery } from '@/hooks/useHybridQuery';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import type { UseMutationResult, UseQueryOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  convertToFetchConfig,
  createHybridQueryConfig,
  hybridFetch
} from './useHybridQuery';

interface TreeNode {
  table: string;
  idField?: string;
  parentField?: string;
  childField?: string;
  keyFields?: string[];
  children?: TreeNode[];
}

async function getDownloadTreeStructure() {
  const { data, error } = await system.supabaseConnector.client
    .rpc('get_download_tree_structure')
    .single()
    .overrideTypes<TreeNode>();

  if (error) throw error;
  return data;
}

/**
 * Hook for getting download tree structure (legacy system)
 * Used for non-quest downloads (projects, assets, etc.)
 * Quest downloads now use the efficient quest_closure system
 */
export function useDownloadTreeStructure(
  options?: Omit<
    UseQueryOptions<Record<string, unknown>[]>,
    'queryKey' | 'queryFn'
  >
) {
  return useHybridQuery({
    queryKey: ['download-tree-structure'],
    onlineFn: async (): Promise<Record<string, unknown>[]> => {
      const data = await getDownloadTreeStructure();
      return [data as Record<string, unknown>]; // Return as array for consistency
    },
    offlineFn: (): Record<string, unknown>[] => [
      {
        children: undefined,
        table: '',
        idField: undefined,
        parentField: undefined,
        childField: undefined,
        keyFields: undefined
      }
    ], // No offline equivalent for this RPC call
    ...options
  });
}

/**
 * Recursively checks if a record and all its children are downloaded
 * by comparing server records with locally synced records
 */
export async function getDownloadStatus(
  recordTable: keyof typeof system.db.query,
  recordId: string,
  currentUserId?: string
) {
  const config = createHybridQueryConfig({
    queryKey: ['download-status', recordTable, recordId, currentUserId],
    onlineFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from(recordTable)
        .select('id')
        .eq('id', recordId)
        .contains('download_profiles', [currentUserId!])
        .limit(1)
        .overrideTypes<{ id: string }[]>();
      if (error) throw error;
      return data;
    },
    offlineQuery: `SELECT id FROM ${recordTable} WHERE id = '${recordId}' AND json_array_length(download_profiles) > 0 AND EXISTS (SELECT 1 FROM json_each(download_profiles) WHERE value = '${currentUserId}') LIMIT 1`,
    enabled: !!recordId && !!currentUserId
  });

  const data = await hybridFetch(convertToFetchConfig(config));
  return !!data[0]?.id;
}

/**
 * Hook to get project download status
 */
export function useDownloadStatus(
  recordTable: keyof typeof system.db.query,
  recordId: string
): {
  isFlaggedForDownload: boolean;
  isLoading: boolean;
} {
  const { currentUser } = useAuth();

  // Memoize the configuration to prevent re-creation on every render
  const queryConfig = useMemo(() => {
    return createHybridQueryConfig({
      queryKey: ['download-status', recordTable, recordId, currentUser?.id],
      onlineFn: async () => {
        const { data, error } = await system.supabaseConnector.client
          .from(recordTable)
          .select('id')
          .eq('id', recordId)
          .contains('download_profiles', [currentUser!.id])
          .limit(1)
          .overrideTypes<{ id: string }[]>();
        if (error) throw error;
        return data;
      },
      offlineQuery: `SELECT id FROM ${recordTable} WHERE id = '${recordId}' AND json_array_length(download_profiles) > 0 AND EXISTS (SELECT 1 FROM json_each(download_profiles) WHERE value = '${currentUser?.id}') LIMIT 1`,
      enabled: !!recordId && !!currentUser?.id
    });
  }, [recordTable, recordId, currentUser?.id]);

  const { data, isLoading, ...rest } = useHybridQuery(queryConfig);

  return { isFlaggedForDownload: !!data[0]?.id, isLoading, ...rest };
}

/**
 * Downloads a record and its related data.
 * - For quests: uses the efficient quest_closure system that marks all related records in one operation
 * - For other records: uses the legacy tree-based download system
 */
export async function downloadRecord(
  recordTable: keyof typeof system.db.query,
  recordId: string,
  downloaded?: boolean,
  downloadTreeStructure?: TreeNode | null,
  currentUser?: { id: string } | null
) {
  console.log(
    `📡 [DOWNLOAD RPC] Starting downloadRecord for ${recordTable}:${recordId}`
  );

  try {
    if (!currentUser?.id) {
      throw new Error('User not authenticated');
    }

    // Use the new quest closure system for quest downloads
    if (recordTable === 'quest') {
      console.log(
        `📡 [DOWNLOAD RPC] Using quest closure download for quest:${recordId}`
      );

      const { data, error } = await system.supabaseConnector.client
        .rpc('download_quest_closure', {
          quest_id_param: recordId,
          profile_id_param: currentUser.id
        })
        .overrideTypes<{ table_name: string; records_updated: number }[]>();

      if (error) {
        console.error(
          `📡 [DOWNLOAD RPC] ❌ Error in download_quest_closure RPC:`,
          error
        );
        throw error;
      }

      console.log(
        `📡 [DOWNLOAD RPC] ✅ Successfully completed quest closure download for quest:${recordId}`,
        data
      );
    } else if (recordTable === 'project') {
      console.log(
        `📡 [DOWNLOAD RPC] Using project closure download for project:${recordId}`
      );

      const { data, error } = await system.supabaseConnector.client
        .rpc('download_project_closure', {
          project_id_param: recordId,
          profile_id_param: currentUser.id
        })
        .overrideTypes<{ table_name: string; records_updated: number }[]>();

      if (error) {
        console.error(
          `📡 [DOWNLOAD RPC] ❌ Error in download_project_closure RPC:`,
          error
        );
        throw error;
      }

      console.log(
        `📡 [DOWNLOAD RPC] ✅ Successfully completed project closure download for project:${recordId}`,
        data
      );
    } else {
      // Fall back to old system for non-quest records
      console.log(
        `📡 [DOWNLOAD RPC] Using legacy download for ${recordTable}:${recordId}`
      );

      const downloadTree =
        downloadTreeStructure ?? (await getDownloadTreeStructure());

      if (!downloadTree) throw new Error('No download tree found.');

      console.log("RYDER5", { downloaded });
      const isCurrentlyDownloaded =
        downloaded ?? (await getDownloadStatus(recordTable, recordId, currentUser.id));

      const operation = isCurrentlyDownloaded ? 'remove' : 'add';
      console.log(
        `📡 [DOWNLOAD RPC] Calling 'download_record' RPC with operation: ${operation} for ${recordTable}:${recordId}`
      );

      const { error } = await system.supabaseConnector.client.rpc(
        'download_record',
        {
          p_table_name: recordTable,
          p_record_id: recordId,
          p_operation: operation
        }
      );

      if (error) {
        console.error(
          `📡 [DOWNLOAD RPC] ❌ Error in download_record RPC:`,
          error
        );
        throw error;
      }

      console.log(
        `📡 [DOWNLOAD RPC] ✅ Successfully completed download_record RPC for ${recordTable}:${recordId}`
      );
    }
  } catch (error) {
    console.error('Error during downloadRecord:', error);
  }
}

/**
 * Hook for project download mutations
 */
export function useDownload(
  recordTable: keyof typeof system.db.query,
  recordId: string
): {
  isFlaggedForDownload: boolean;
  isLoading: boolean;
  toggleDownload: () => Promise<void>;
  mutation: UseMutationResult<void, Error, boolean | undefined>;
} {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { isFlaggedForDownload, isLoading } = useDownloadStatus(
    recordTable,
    recordId
  );

  const mutation = useMutation({
    mutationFn: async (downloaded?: boolean) =>
      await downloadRecord(recordTable, recordId, downloaded, null, currentUser),
    onSuccess: async () => {
      // Invalidate related queries
      await queryClient.invalidateQueries({
        queryKey: ['download-status', recordTable, recordId]
      });
    }
  });

  const toggleDownload = async () => {
    if (!recordId || !currentUser?.id) return;

    const isCurrentlyDownloaded = await getDownloadStatus(
      recordTable,
      recordId,
      currentUser.id
    );

    // TODO: re-enable undownloading when we have a way to remove the record from the download tree
    if (isCurrentlyDownloaded) {
      return;
    }

    await mutation.mutateAsync(false); // always download
  };

  return {
    isFlaggedForDownload,
    isLoading: isLoading || mutation.isPending,
    toggleDownload,
    mutation
  };
}

/**
 * Enhanced hook for quest download status using quest closure table
 * Provides progress information and efficient status checking
 */
export function useQuestDownloadStatus(questId: string) {
  const { currentUser } = useAuth();

  const { data: questClosure, isLoading } = useHybridQuery({
    queryKey: ['quest-closure', questId],
    enabled: !!questId && !!currentUser?.id,
    onlineFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('quest_closure')
        .select('*')
        .eq('quest_id', questId)
        .limit(1)
        .overrideTypes<
          {
            quest_id: string;
            project_id: string;
            total_assets: number;
            total_translations: number;
            approved_translations: number;
            last_updated: string;
          }[]
        >();
      if (error) throw error;
      return data;
    },
    offlineQuery: toCompilableQuery(
      system.db.query.quest_closure.findMany({
        where: (fields, { eq }) => eq(fields.quest_id, questId),
        limit: 1
      })
    )
  });

  // Check if quest is downloaded by looking at quest's download_profiles
  const { data: questDownloadStatus } = useHybridQuery({
    queryKey: ['quest-download-status', questId],
    enabled: !!questId && !!currentUser?.id,
    onlineFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('quest')
        .select('id, download_profiles')
        .eq('id', questId)
        .contains('download_profiles', [currentUser!.id])
        .limit(1)
        .overrideTypes<{ id: string; download_profiles: string[] }[]>();
      if (error) throw error;
      return data;
    },
    offlineQuery: `SELECT id, download_profiles FROM quest WHERE id = '${questId}' AND json_array_length(download_profiles) > 0 LIMIT 1`
  });

  const closureData = questClosure[0];
  const isDownloaded = !!questDownloadStatus[0]?.id;

  // Calculate progress percentage
  const progressPercentage = closureData
    ? Math.round(
      (closureData.approved_translations /
        Math.max(closureData.total_assets, 1)) *
      100
    )
    : 0;

  return {
    isDownloaded,
    isLoading,
    questClosure: closureData,
    progressPercentage,
    totalAssets: closureData?.total_assets || 0,
    totalTranslations: closureData?.total_translations || 0,
    approvedTranslations: closureData?.approved_translations || 0
  };
}

/**
 * Enhanced hook for project download status using project closure table
 * Provides progress information and efficient status checking for entire projects
 */
export function useProjectDownloadStatus(projectId: string) {
  const { currentUser } = useAuth();

  const { data: projectClosure, isLoading } = useHybridQuery({
    queryKey: ['project-closure', projectId],
    enabled: !!projectId && !!currentUser?.id,
    onlineFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('project_closure')
        .select('*')
        .eq('project_id', projectId)
        .limit(1)
        .overrideTypes<
          {
            project_id: string;
            total_quests: number;
            total_assets: number;
            total_translations: number;
            approved_translations: number;
            last_updated: string;
          }[]
        >();
      if (error) throw error;
      return data;
    },
    offlineQuery: `SELECT * FROM project_closure WHERE project_id = '${projectId}' LIMIT 1`
  });

  // Check if project is downloaded by looking at project's download_profiles
  const { data: projectDownloadStatus } = useHybridQuery({
    queryKey: ['project-download-status', projectId],
    enabled: !!projectId && !!currentUser?.id,
    onlineFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('project')
        .select('id, download_profiles')
        .eq('id', projectId)
        .contains('download_profiles', [currentUser!.id])
        .limit(1)
        .overrideTypes<{ id: string; download_profiles: string[] }[]>();
      if (error) throw error;
      return data;
    },
    offlineQuery: `SELECT id, download_profiles FROM project WHERE id = '${projectId}' AND json_array_length(download_profiles) > 0 LIMIT 1`
  });

  const closureData = projectClosure[0] as
    | {
      project_id: string;
      total_quests: number;
      total_assets: number;
      total_translations: number;
      approved_translations: number;
      last_updated: string;
    }
    | undefined;
  const isDownloaded = !!projectDownloadStatus[0]?.id;

  // Calculate progress percentage based on approved translations vs total assets
  const progressPercentage = closureData
    ? Math.round(
      (closureData.approved_translations /
        Math.max(closureData.total_assets, 1)) *
      100
    )
    : 0;

  return {
    isDownloaded,
    isLoading,
    projectClosure: closureData,
    progressPercentage,
    totalQuests: closureData?.total_quests || 0,
    totalAssets: closureData?.total_assets || 0,
    totalTranslations: closureData?.total_translations || 0,
    approvedTranslations: closureData?.approved_translations || 0
  };
}
