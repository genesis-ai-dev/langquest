import { useAuth } from '@/contexts/AuthContext';
import { system } from '@/db/powersync/system';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useQuery } from '@powersync/tanstack-react-query';
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

interface ServerRecordData {
  table: string;
  records: {
    ids: (string | Record<string, string>)[];
    children: Record<string, ServerRecordData['records']>;
  };
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

export function useDownloadTreeStructure() {
  return useQuery({
    queryKey: ['download-tree-structure'],
    queryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .rpc('get_download_tree_structure')
        .single()
        .overrideTypes<TreeNode>();

      if (error) throw error;
      return data;
    }
  });
}

/**
 * Recursively checks if a record and all its children are downloaded
 * by comparing server records with locally synced records
 */
export async function getDownloadStatus(
  downloadTreeStructure: TreeNode,
  recordTable: keyof typeof system.db.query,
  recordId: string
): Promise<boolean> {
  try {
    // Get the current user's profile ID
    const userResponse = await system.supabaseConnector.client.auth.getUser();
    const profileId = userResponse.data.user?.id;

    if (!profileId) {
      throw new Error('User not authenticated');
    }

    // Get all related records from the server
    const { data: serverData, error } = await system.supabaseConnector.client
      .rpc('get_all_related_records', {
        p_table_name: recordTable,
        p_record_id: recordId
      })
      .single<ServerRecordData>();

    // Debug: Log for quest-level checks
    if (recordTable === 'quest') {
      console.log(
        `Quest ${recordId} serverData:`,
        JSON.stringify(serverData, null, 2)
      );
    }

    if (error) {
      console.error('Error fetching related records:', error);
      return false;
    }

    // Find the correct node for the table we're checking
    const tableNode = findNodeInTree(downloadTreeStructure, recordTable);
    if (!tableNode) {
      console.error(
        `Could not find node for table ${recordTable} in tree structure`
      );
      return false;
    }

    // Check if all records exist locally
    console.log(
      `Starting checkRecordsExistLocally for ${recordTable} ${recordId}`
    );
    const result = await checkRecordsExistLocally(serverData, tableNode);
    console.log(
      `Finished checkRecordsExistLocally for ${recordTable} ${recordId}, result:`,
      result
    );

    // Debug: Log result for quest-level checks
    if (recordTable === 'quest') {
      console.log(`Quest ${recordId} download status:`, result);
    }

    return result;
  } catch (error) {
    console.error('Error checking download status:', error);
    return false;
  }
}

/**
 * Recursively checks if records exist in the local PowerSync database
 */
async function checkRecordsExistLocally(
  serverRecords: ServerRecordData | null,
  treeNode: TreeNode
): Promise<boolean> {
  console.log(
    `checkRecordsExistLocally called for table: ${serverRecords?.table}`
  );

  if (!serverRecords?.records) {
    console.log(`No records to check for ${serverRecords?.table}`);
    return true; // No records to check
  }

  const { ids, children } = serverRecords.records;
  const tableName = serverRecords.table;

  console.log(
    `Checking table ${tableName} with ${ids.length} records and ${Object.keys(children).length} child tables`
  );

  // Debug for quest and quest-related tables
  const isQuestRelated =
    tableName === 'quest' ||
    tableName === 'quest_tag_link' ||
    tableName === 'quest_asset_link' ||
    tableName === 'asset_tag_link' ||
    tableName === 'asset' ||
    tableName === 'language' ||
    tableName === 'tag' ||
    tableName === 'translation' ||
    tableName === 'vote' ||
    tableName === 'asset_content_link' ||
    Object.keys(children).some((child) =>
      ['quest_tag_link', 'quest_asset_link'].includes(child)
    );

  // Check if the current records exist locally
  if (ids.length > 0) {
    if (isQuestRelated) {
      console.log(`Checking ${ids.length} records in ${tableName}`);
      console.log(
        `Tree node for ${tableName}:`,
        JSON.stringify(treeNode, null, 2)
      );
    }

    try {
      // Debug: Check total count in PowerSync for this table (for all quest-related tables)
      if (isQuestRelated) {
        const countSql = `SELECT COUNT(*) as total FROM ${tableName}`;
        const countResult = await system.powersync.execute(countSql, []);
        if (countResult.rows && countResult.rows.length > 0) {
          const countRow = countResult.rows.item(0) as {
            total?: number;
          } | null;
          console.log(
            `Total ${tableName} records in PowerSync:`,
            countRow?.total || 0
          );
        }
      }

      // Check if this is a composite key table
      if (treeNode.keyFields && treeNode.keyFields.length > 0) {
        if (isQuestRelated) {
          console.log(
            `${tableName} is composite key table with fields:`,
            treeNode.keyFields
          );
        }

        // Handle composite key tables
        let localCount = 0;

        for (const record of ids) {
          if (typeof record === 'object') {
            // Build WHERE clause for composite keys
            const whereClauses: string[] = [];
            const values: string[] = [];

            for (const keyField of treeNode.keyFields) {
              const value = record[keyField];
              if (value !== undefined) {
                whereClauses.push(`${keyField} = ?`);
                values.push(String(value));
              }
            }

            if (whereClauses.length > 0) {
              const sql = `SELECT COUNT(*) as count FROM ${tableName} WHERE ${whereClauses.join(' AND ')}`;

              if (isQuestRelated) {
                console.log(`Checking composite key record:`, record);
                console.log(`SQL: ${sql}`, values);
              }

              const result = await system.powersync.execute(sql, values);

              if (result.rows && result.rows.length > 0) {
                const row = result.rows.item(0) as { count?: number } | null;
                if (row?.count && row.count > 0) {
                  localCount++;
                  if (isQuestRelated) {
                    console.log(
                      `✅ Found composite key record in ${tableName}`
                    );
                  }
                } else if (isQuestRelated) {
                  console.log(
                    `❌ Missing composite key record in ${tableName}:`,
                    record
                  );
                }
              }
            }
          }
        }

        if (localCount < ids.length) {
          if (isQuestRelated) {
            console.log(
              `Missing ${ids.length - localCount} composite key records in ${tableName}`
            );
          }
          return false;
        } else if (isQuestRelated) {
          console.log(
            `All ${localCount} composite key records found in ${tableName}`
          );
        }
      } else {
        // Handle regular single ID tables
        const idField = treeNode.idField || 'id';
        const recordIds = ids
          .map((record) =>
            typeof record === 'string' ? record : record[idField]
          )
          .filter((id): id is string => Boolean(id));

        if (recordIds.length > 0) {
          // Use PowerSync's execute method
          const placeholders = recordIds.map(() => '?').join(', ');
          const sql = `SELECT COUNT(*) as count FROM ${tableName} WHERE ${idField} IN (${placeholders})`;

          if (isQuestRelated) {
            console.log(`Checking single ID records in ${tableName}:`);
            console.log(`SQL: ${sql}`, recordIds);
            console.log(`Using idField: ${idField}`);
          }

          const result = await system.powersync.execute(sql, recordIds);
          let localCount = 0;

          // Handle SQLite result format
          if (result.rows && result.rows.length > 0) {
            const row = result.rows.item(0) as { count?: number } | null;
            localCount = row?.count ?? 0;
          }

          if (isQuestRelated) {
            console.log(
              `Found ${localCount} out of ${recordIds.length} records in ${tableName}`
            );
          }

          if (localCount < recordIds.length) {
            if (isQuestRelated) {
              console.log(
                `❌ Missing ${recordIds.length - localCount} records in ${tableName} (checked ${recordIds.length} IDs)`
              );
            }
            return false; // Not all records exist locally
          } else if (isQuestRelated) {
            console.log(
              `✅ All ${recordIds.length} records found in ${tableName}`
            );
          }
        }
      }
    } catch (error) {
      console.error(`Error checking local records for ${tableName}:`, error);
      return false;
    }
  }

  // Recursively check children
  if (Object.keys(children).length > 0) {
    if (isQuestRelated) {
      console.log(`Checking children of ${tableName}:`, Object.keys(children));
    }
    for (const [childTable, childRecords] of Object.entries(children)) {
      // Find the child node in the tree structure
      const childNode = findChildNode(treeNode, childTable);
      if (childNode) {
        if (isQuestRelated) {
          console.log(
            `Found child node for ${childTable}:`,
            JSON.stringify(childNode, null, 2)
          );
        }
        const childData: ServerRecordData = {
          table: childTable,
          records: childRecords
        };
        const childrenExist = await checkRecordsExistLocally(
          childData,
          childNode
        );
        if (!childrenExist) {
          if (isQuestRelated) {
            console.log(`Child table ${childTable} check failed`);
          }
          return false;
        }
      } else {
        if (isQuestRelated) {
          console.log(`No child node found for ${childTable}`);
        }
      }
    }
  }

  return true;
}

/**
 * Finds a node in the tree structure by table name (recursive search)
 */
function findNodeInTree(node: TreeNode, tableName: string): TreeNode | null {
  // Check if current node matches
  if (node.table === tableName) {
    return node;
  }

  // Check children recursively
  if (node.children) {
    for (const child of node.children) {
      const found = findNodeInTree(child, tableName);
      if (found) {
        return found;
      }
    }
  }

  return null;
}

/**
 * Finds a child node in the tree structure by table name
 */
function findChildNode(
  parentNode: TreeNode,
  childTable: string
): TreeNode | null {
  if (!parentNode.children) {
    return null;
  }

  for (const child of parentNode.children) {
    if (child.table === childTable) {
      return child;
    }
  }

  return null;
}

/**
 * Hook to get project download status
 */
export function useDownloadStatus(
  downloadTreeStructure: TreeNode | null | undefined,
  recordTable: keyof typeof system.db.query,
  recordId: string
) {
  const {
    data: isDownloaded,
    isLoading,
    ...rest
  } = useQuery({
    queryKey: ['download-status', recordTable, recordId],
    queryFn: () =>
      getDownloadStatus(downloadTreeStructure!, recordTable, recordId),
    enabled: !!recordId && !!downloadTreeStructure
  });

  return { isDownloaded, isLoading, ...rest };
}

/**
 * Hook for project download mutations
 */
export function useDownload(
  recordTable: keyof typeof system.db.query,
  recordId: string
) {
  const queryClient = useQueryClient();
  const { data: downloadTreeStructure } = useDownloadTreeStructure();
  const { isDownloaded, isLoading } = useDownloadStatus(
    downloadTreeStructure,
    recordTable,
    recordId
  );
  const { currentUser } = useAuth();

  const mutation = useMutation({
    mutationFn: async (downloaded: boolean) => {
      if (!currentUser?.id || !recordId) {
        throw new Error('Profile ID and Record ID are required');
      }

      console.log('downloading', recordTable, recordId, downloaded);
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
        queryKey: ['download-status', recordTable, recordId]
      });
    }
  });

  const toggleDownload = async () => {
    if (!recordId || !downloadTreeStructure) return;

    const isCurrentlyDownloaded = await getDownloadStatus(
      downloadTreeStructure,
      recordTable,
      recordId
    );
    console.log('isCurrentlyDownloaded', isCurrentlyDownloaded);
    await mutation.mutateAsync(isCurrentlyDownloaded);
  };

  return {
    isDownloaded,
    isLoading: isLoading || mutation.isPending,
    toggleDownload,
    mutation
  };
}
