import { getCurrentUser } from '@/contexts/AuthContext';
import { system } from '@/db/powersync/system';
import { useHybridQuery } from '@/hooks/useHybridQuery';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import type { UseQueryOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Asset } from './db/useAssets';
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

function getAllDownloadedAssetsConfig(profileId: string) {
  return createHybridQueryConfig({
    queryKey: ['downloaded-assets', profileId],
    enabled: !!profileId,
    onlineFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('asset')
        .select('id')
        .contains('download_profiles', [profileId])
        .overrideTypes<Asset[]>();
      if (error) throw error;
      return data;
    },
    offlineQuery: toCompilableQuery(
      system.db.query.asset.findMany({
        columns: { id: true }
      })
    )
  });
}

/**
 * Returns all downloaded asset IDs for a given profileId using hybridFetch (online/offline).
 */
export async function getAllDownloadedAssets(profileId: string) {
  return (
    (await hybridFetch(
      convertToFetchConfig(getAllDownloadedAssetsConfig(profileId))
    )) ?? []
  ).flatMap((row) => Object.values(row.id));
}

async function getDownloadTreeStructure() {
  const { data, error } = await system.supabaseConnector.client
    .rpc('get_download_tree_structure')
    .single()
    .overrideTypes<TreeNode>();

  if (error) throw error;
  return data;
}

export function useDownloadTreeStructure(
  options?: Omit<UseQueryOptions<TreeNode | null>, 'queryKey' | 'queryFn'>
) {
  return useHybridQuery({
    queryKey: ['download-tree-structure'],
    onlineFn: async () => {
      const data = await getDownloadTreeStructure();
      return [data]; // Return as array for consistency
    },
    offlineFn: () => [{ children: undefined, table: '', idField: undefined, parentField: undefined, childField: undefined, keyFields: undefined }], // No offline equivalent for this RPC call
    ...options
  });
}

/**
 * Recursively checks if a record and all its children are downloaded
 * by comparing server records with locally synced records
 */
export async function getDownloadStatus(
  recordTable: keyof typeof system.db.query,
  recordId: string
) {
  const data = await hybridFetch(
    convertToFetchConfig(getDownloadStatusConfig(recordTable, recordId))
  );
  return !!data?.[0]?.id;
}

function getDownloadStatusConfig(
  recordTable: keyof typeof system.db.query,
  recordId: string
) {
  const currentUser = getCurrentUser();
  return createHybridQueryConfig({
    queryKey: ['download-status', recordTable, recordId],
    onlineFn: async () => {
      console.log('recordId', recordId);
      console.log('recordTable', recordTable);
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
    offlineQuery: `SELECT id FROM ${recordTable} WHERE id = '${recordId}' LIMIT 1`,
    enabled: !!recordId && !!currentUser?.id
  });
}
/**
 * Hook to get project download status
 */
export function useDownloadStatus(
  recordTable: keyof typeof system.db.query,
  recordId: string
) {
  const { data, isLoading, ...rest } = useHybridQuery(
    getDownloadStatusConfig(recordTable, recordId)
  );

  return { isDownloaded: !!data?.[0]?.id, isLoading, ...rest };
}

/**
 * Hook to get download status for multiple projects
 */
export function useProjectsDownloadStatus(projectIds: string[]) {
  const { data: downloadTreeStructure } = useDownloadTreeStructure();

  const {
    data: projectStatuses,
    isLoading,
    ...rest
  } = useHybridQuery({
    queryKey: ['projects-download-status', projectIds.sort()],
    onlineFn: async () => {
      if (!downloadTreeStructure || !projectIds.length) {
        return [{}];
      }

      // Check all projects in parallel
      const statusPromises = projectIds.map(async (projectId) => {
        try {
          const isDownloaded = await getDownloadStatus('project', projectId);
          return { projectId, isDownloaded };
        } catch (error) {
          console.error(
            `Error checking download status for project ${projectId}:`,
            error
          );
          return { projectId, isDownloaded: false };
        }
      });

      const results = await Promise.all(statusPromises);

      // Convert to object for easy lookup
      const statusObject = results.reduce(
        (acc, { projectId, isDownloaded }) => {
          acc[projectId] = isDownloaded;
          return acc;
        },
        {} as Record<string, boolean>
      );

      return [statusObject];
    },
    offlineFn: () => [{}],
    enabled: !!downloadTreeStructure && projectIds.length > 0
  });

  return {
    projectStatuses: projectStatuses || {},
    isLoading,
    ...rest
  };
}

export async function downloadRecord(
  recordTable: keyof typeof system.db.query,
  recordId: string,
  downloaded?: boolean,
  downloadTreeStructure?: TreeNode | null
) {
  const downloadTree =
    downloadTreeStructure ?? (await getDownloadTreeStructure());

  if (!downloadTree) throw new Error('No download tree found.');

  const isCurrentlyDownloaded =
    downloaded ?? (await getDownloadStatus(recordTable, recordId));
  const { error } = await system.supabaseConnector.client.rpc(
    'download_record',
    {
      p_table_name: recordTable,
      p_record_id: recordId,
      p_operation: isCurrentlyDownloaded ? 'remove' : 'add'
    }
  );

  if (error) throw error;
}

/**
 * Hook for project download mutations
 */
export function useDownload(
  recordTable: keyof typeof system.db.query,
  recordId: string
) {
  const queryClient = useQueryClient();
  const { isDownloaded, isLoading } = useDownloadStatus(recordTable, recordId);

  const mutation = useMutation({
    mutationFn: async (downloaded?: boolean) =>
      await downloadRecord(recordTable, recordId, downloaded),
    onSuccess: async () => {
      // Invalidate related queries
      await queryClient.invalidateQueries({
        queryKey: ['download-status', recordTable, recordId]
      });
    }
  });

  const toggleDownload = async () => {
    if (!recordId) return;

    const isCurrentlyDownloaded = await getDownloadStatus(
      recordTable,
      recordId
    );

    // TODO: re-enable undownloading when we have a way to remove the record from the download tree
    if (isCurrentlyDownloaded) return;

    await mutation.mutateAsync(false); // always download
  };

  return {
    isDownloaded: !!isDownloaded,
    isLoading: isLoading || mutation.isPending,
    toggleDownload,
    mutation
  };
}
