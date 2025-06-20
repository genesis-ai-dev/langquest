import { getCurrentUser, useAuth } from '@/contexts/AuthContext';
import { download, profile } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Asset } from './db/useAssets';
import {
  convertToFetchConfig,
  createHybridQueryConfig,
  hybridFetch,
  useHybridQuery
} from './useHybridQuery';

// Define the download tree structure
interface DownloadNode {
  table: string;
  idField?: string; // The field name for the ID (defaults to 'id') - used for single key
  keyFields?: string[]; // Multiple fields for composite keys - takes precedence over idField
  parentField?: string; // The field that links to parent
  children?: DownloadNode[];
}

type DownloadOperation = 'insert' | 'delete';

// Helper function to find a node in the tree by table name
function findNodeByTable(
  node: DownloadNode,
  tableName: string
): DownloadNode | null {
  if (node.table === tableName) return node;

  if (node.children) {
    for (const child of node.children) {
      const found = findNodeByTable(child, tableName);
      if (found) return found;
    }
  }

  return null;
}

function getKeyField(node: DownloadNode) {
  return node.idField ?? node.keyFields?.[0] ?? 'id';
}

// Type for handling both single keys and composite key records
type RecordIdentifier = string | Record<string, string>;

// Helper function to process download tree recursively
async function processDownloadTree(
  node: DownloadNode,
  parentIds: string[],
  profileId: string,
  operation: DownloadOperation,
  tx?: Parameters<Parameters<typeof system.db.transaction>[0]>[0],
  startTable?: string
) {
  console.log('processing download tree', startTable ?? node.table, operation);
  if (parentIds.length === 0) return;

  // If we have a startTable, find that node and start from there
  if (startTable && node.table !== startTable) {
    const startNode = findNodeByTable(node, startTable);
    if (startNode) {
      await processDownloadTree(
        startNode,
        parentIds,
        profileId,
        operation,
        tx,
        startTable
      );
    }
    return;
  }

  // For the root node, we already have the IDs
  // If we have a startTable, treat the current node as root regardless of parentField
  const isRootNode =
    !node.parentField || (startTable && node.table === startTable);
  let recordIdentifiers: RecordIdentifier[] = [];

  if (isRootNode) {
    recordIdentifiers = parentIds;
  } else {
    // Fetch records based on parent relationship
    const keyFields = node.keyFields ?? [node.idField ?? 'id'];
    const query = system.supabaseConnector.client
      .from(node.table)
      .select(keyFields.join(','))
      .in(node.parentField!, parentIds);

    const { data } = await query;
    if (!data || data.length === 0) return;

    // For composite keys, store the full record objects
    if (node.keyFields && node.keyFields.length > 1) {
      recordIdentifiers = data.map((record) => {
        const typedRecord: Record<string, string> = {};
        for (const keyField of keyFields) {
          // @ts-expect-error - dynamic field access
          typedRecord[keyField] = record[keyField] as string;
        }
        return typedRecord;
      });
    } else {
      // Single key field
      const keyField = keyFields[0];
      // @ts-expect-error - keyField is not typed
      recordIdentifiers = data.map((record) => record[keyField] as string);
    }
  }

  // Perform the operation on download records
  if (operation === 'insert') {
    const downloadRecords = recordIdentifiers.map((identifier) => {
      const keyField = getKeyField(node);
      let recordKey: Record<string, string>;

      if (typeof identifier === 'object') {
        // For composite keys, identifier is already the record object
        recordKey = identifier;
      } else {
        // Single key field
        recordKey = { [keyField]: identifier };
      }

      return {
        profile_id: profileId,
        record_key: recordKey,
        record_table: node.table
      };
    });
    if (tx) {
      console.log('inserting download records', downloadRecords);
      await tx.insert(download).values(downloadRecords);
    }
  } else {
    const recordKeys = recordIdentifiers.map((identifier) =>
      JSON.stringify(
        typeof identifier === 'string'
          ? { [getKeyField(node)]: identifier }
          : identifier
      )
    );

    await Promise.all(
      recordKeys.map((recordKey) =>
        system.supabaseConnector.client
          .from('download')
          .delete()
          .eq('profile_id', profileId)
          .eq('record_table', node.table)
          .eq('record_key', recordKey)
      )
    );
  }

  // Process children if any
  if (node.children && recordIdentifiers.length > 0) {
    // For children, we need to extract the actual IDs from composite keys
    const childParentIds: string[] = [];

    // Extract parent IDs from identifiers
    for (const identifier of recordIdentifiers) {
      if (typeof identifier === 'object') {
        // For composite keys, extract the primary key field as parent ID
        const primaryKeyField = getKeyField(node);
        const parentId = identifier[primaryKeyField];
        if (typeof parentId === 'string') {
          childParentIds.push(parentId);
        }
      } else {
        // For single keys, identifier is already the parent ID
        childParentIds.push(identifier);
      }
    }

    for (const child of node.children) {
      await processDownloadTree(
        child,
        childParentIds,
        profileId,
        operation,
        tx
      );
    }
  }
}

function getAllDownloadedAssetsConfig(profileId: string) {
  return createHybridQueryConfig({
    queryKey: ['downloaded-assets', profileId],
    enabled: !!profileId,
    onlineFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('asset')
        .select('id')
        .in('download_profiles', [profileId])
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
  ).map((row) => Object.values(row.id));
}

function getDownloadStatusConfig(
  recordTable: keyof typeof system.db.query,
  recordId: string
) {
  const profile = getCurrentUser();

  if (!profile?.id) {
    throw new Error('Profile is required.');
  }

  return createHybridQueryConfig({
    queryKey: ['download-status', profile.id, recordTable, recordId],
    enabled: !!profile.id && !!recordId,
    onlineFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from(recordTable)
        .select('id')
        .contains('download_profiles', [profile.id])
        .overrideTypes<{ id: string }[]>();
      if (error) throw error;
      return data;
    },
    offlineQuery: toCompilableQuery(system.db)
  });
}

export async function getDownloadStatus(
  recordTable: keyof typeof system.db.query,
  recordId: string
) {
  const { data: downloadArray } = await system.supabaseConnector.client
    .from(recordTable)
    .select('id')
    .eq('id')
    .contains('download_profiles', [profile.id])
    .overrideTypes<{ id: string }[]>();

  return !!downloadArray?.[0]?.id;
}

/**
 * Hook to get project download status
 */
export function useDownloadStatus(
  recordTable: keyof typeof system.db.query,
  recordId: string | undefined
) {
  const {
    data: downloadArray,
    isLoading,
    ...rest
  } = useHybridQuery({
    ...getDownloadStatusConfig(recordTable, recordId!),
    enabled: !!recordId
  });

  return { isDownloaded: !!downloadArray?.[0]?.id, isLoading, ...rest };
}

/**
 * Hook for project download mutations
 */
export function useDownload(
  recordTable: keyof typeof system.db.query,
  recordId: string | undefined
) {
  const queryClient = useQueryClient();
  const { isDownloaded, isLoading } = useDownloadStatus(recordTable, recordId);
  const { currentUser } = useAuth();

  const mutation = useMutation({
    mutationFn: async (downloaded: boolean) => {
      if (!currentUser?.id || !recordId) {
        throw new Error('Profile ID and Record ID are required');
      }

      const { error } = await system.supabaseConnector.client.rpc(
        'download_record',
        {
          p_table_name: recordTable,
          p_record_id: recordId,
          p_operation: downloaded ? 'remove' : 'add'
        }
      );

      if (error) throw error;
    },
    onSuccess: async () => {
      // Invalidate related queries
      await queryClient.invalidateQueries({
        queryKey: ['download-status', currentUser?.id, recordTable, recordId]
      });

      console.log(
        'download status query invalidated',
        currentUser?.id,
        recordTable,
        recordId
      );

      console.log(
        'download status',
        queryClient.getQueryData([
          'download-status',
          currentUser?.id,
          recordTable,
          recordId
        ])
      );
    }
  });

  const toggleDownload = async () => {
    if (!recordId) return;

    const isDownloaded = await getDownloadStatus(recordTable, recordId);
    console.log('isDownloaded', isDownloaded, recordTable, recordId);
    await mutation.mutateAsync(isDownloaded);
  };

  return {
    isDownloaded,
    isLoading: isLoading || mutation.isPending,
    toggleDownload,
    mutation
  };
}
