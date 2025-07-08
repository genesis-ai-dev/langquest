import { getCurrentUser } from '@/contexts/AuthProvider';
import { system } from '@/db/powersync/system';
import type { UseQueryOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  convertToSupabaseFetchConfig,
  createHybridSupabaseQueryConfig,
  hybridSupabaseFetch,
  useHybridSupabaseQuery
} from './useHybridSupabaseQuery';

interface TreeNode {
  table: string;
  idField?: string;
  parentField?: string;
  childField?: string;
  keyFields?: string[];
  children?: TreeNode[];
}

// Type guard and interface for attachment state manager
interface AttachmentStateManager {
  markDownloadOperationStart(): void;
  markDownloadOperationComplete(): void;
  processPendingUpdates(onUpdate: (ids: string[]) => void): void;
}

interface AttachmentQueueWithStateManager {
  attachmentStateManager?: AttachmentStateManager;
  getDebugInfo?(): { stateManager?: AttachmentStateManager };
}

function getAttachmentStateManager(): AttachmentStateManager | null {
  const permQueue = system.permAttachmentQueue as
    | AttachmentQueueWithStateManager
    | undefined;
  if (!permQueue) return null;

  // Try to get state manager directly
  if (permQueue.attachmentStateManager) {
    return permQueue.attachmentStateManager;
  }

  return null;
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
  return useHybridSupabaseQuery({
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
  recordId: string
) {
  const data = await hybridSupabaseFetch(
    convertToSupabaseFetchConfig(getDownloadStatusConfig(recordTable, recordId))
  );
  return !!data[0]?.id;
}

function getDownloadStatusConfig(
  recordTable: keyof typeof system.db.query,
  recordId: string
) {
  const currentUser = getCurrentUser();
  return createHybridSupabaseQueryConfig({
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
  const { data, isLoading, ...rest } = useHybridSupabaseQuery(
    getDownloadStatusConfig(recordTable, recordId)
  );

  return { isDownloaded: !!data?.[0]?.id, isLoading, ...rest };
}

/**
 * Downloads a record and all its related data
 * - For quests: uses the efficient quest_closure system that marks all related records in one operation
 * - For other records: uses the legacy tree-based download system
 */
export async function downloadRecord(
  recordTable: keyof typeof system.db.query,
  recordId: string,
  downloaded?: boolean,
  downloadTreeStructure?: TreeNode | null
) {
  console.log(
    `📡 [DOWNLOAD RPC] Starting downloadRecord for ${recordTable}:${recordId}`
  );

  // 🚫 PREVENT ATTACHMENT COLLECTION DURING DOWNLOAD
  const stateManager = getAttachmentStateManager();
  if (stateManager) {
    console.log(
      '🚫 [DOWNLOAD RPC] Marking download operation start to prevent attachment collection'
    );
    stateManager.markDownloadOperationStart();
  }

  try {
    const currentUser = getCurrentUser();
    if (!currentUser?.id) {
      throw new Error('User not authenticated');
    }

    // Use the new quest closure system for quest downloads
    if (recordTable === 'quest') {
      console.log(
        `📡 [DOWNLOAD RPC] Using quest closure download for quest:${recordId}`
      );

      console.log('currentUser', { currentUser });

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
    } else {
      // Fall back to old system for non-quest records
      console.log(
        `📡 [DOWNLOAD RPC] Using legacy download for ${recordTable}:${recordId}`
      );

      const downloadTree =
        downloadTreeStructure ?? (await getDownloadTreeStructure());

      if (!downloadTree) throw new Error('No download tree found.');

      const isCurrentlyDownloaded =
        downloaded ?? (await getDownloadStatus(recordTable, recordId));

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
  } finally {
    // ✅ RESUME ATTACHMENT COLLECTION AFTER DOWNLOAD
    if (stateManager) {
      console.log(
        '✅ [DOWNLOAD RPC] Marking download operation complete - resuming attachment collection'
      );
      stateManager.markDownloadOperationComplete();

      // Process any pending updates
      console.log(
        '🔄 [DOWNLOAD RPC] Attachment updates will be processed when next triggered'
      );
    }
  }
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

    console.log(
      `🎯 [QUEST DOWNLOAD] Starting download for ${recordTable}:${recordId}`
    );

    const isCurrentlyDownloaded = await getDownloadStatus(
      recordTable,
      recordId
    );

    console.log(
      `🎯 [QUEST DOWNLOAD] Current download status: ${isCurrentlyDownloaded ? 'DOWNLOADED' : 'NOT_DOWNLOADED'}`
    );

    // TODO: re-enable undownloading when we have a way to remove the record from the download tree
    if (isCurrentlyDownloaded) {
      console.log(
        `🎯 [QUEST DOWNLOAD] Already downloaded, skipping: ${recordTable}:${recordId}`
      );
      return;
    }

    console.log(
      `🎯 [QUEST DOWNLOAD] Calling downloadRecord mutation for ${recordTable}:${recordId}`
    );
    await mutation.mutateAsync(false); // always download
    console.log(
      `🎯 [QUEST DOWNLOAD] ✅ Download mutation completed for ${recordTable}:${recordId}`
    );
  };

  return {
    isDownloaded: !!isDownloaded,
    isLoading: isLoading || mutation.isPending,
    toggleDownload,
    mutation
  };
}
