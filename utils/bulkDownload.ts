import { system } from '@/db/powersync/system';

interface DiscoveredIds {
  questIds: string[];
  projectIds: string[];
  questAssetLinkIds: string[];
  assetIds: string[];
  assetContentLinkIds: string[];
  voteIds: string[];
  questTagLinkIds: string[];
  assetTagLinkIds: string[];
  tagIds: string[];
  languageIds: string[];
}

interface BulkDownloadResult {
  tableName: string;
  recordsUpdated: number;
}

/**
 * Performs bulk download by updating download_profiles for all discovered records.
 * This replaces the RPC function with direct Supabase queries.
 */
export async function bulkDownloadQuest(
  discoveredIds: DiscoveredIds,
  userId: string
): Promise<BulkDownloadResult[]> {
  console.log('📥 [Bulk Download] Starting bulk download for user:', userId);
  console.log('📥 [Bulk Download] Discovered IDs:', discoveredIds);

  const results: BulkDownloadResult[] = [];

  try {
    // Helper function to update a table with single ID
    const updateTable = async (
      tableName: string,
      ids: string[]
    ): Promise<number> => {
      if (ids.length === 0) {
        console.log(`📥 [Bulk Download] Skipping ${tableName} (no IDs)`);
        return 0;
      }

      console.log(
        `📥 [Bulk Download] Updating ${tableName}: ${ids.length} records`
      );

      // Call atomic function for each ID
      let updated = 0;
      const updatePromises = ids.map(async (id) => {
        const { data, error } = await system.supabaseConnector.client.rpc(
          'add_to_download_profiles',
          {
            p_table_name: tableName,
            p_record_id: id
          }
        );

        if (error) {
          console.error(
            `📥 [Bulk Download] Error updating ${tableName} ${id}:`,
            error
          );
          throw error;
        }

        if (data) {
          updated++;
          console.log(`📥 [Bulk Download] Added to ${tableName} ${id}`);
        } else {
          console.log(
            `📥 [Bulk Download] Already downloaded ${tableName} ${id}`
          );
        }
      });

      await Promise.all(updatePromises);
      console.log(
        `📥 [Bulk Download] Updated ${tableName}: ${updated} records`
      );
      return updated;
    };

    // Helper function to update link tables with composite keys
    const updateLinkTable = async (
      tableName: string,
      compositeKeys: string[],
      key1Name: string,
      key2Name: string
    ): Promise<number> => {
      if (compositeKeys.length === 0) {
        console.log(`📥 [Bulk Download] Skipping ${tableName} (no IDs)`);
        return 0;
      }

      console.log(
        `📥 [Bulk Download] Updating ${tableName}: ${compositeKeys.length} records`
      );

      const parsedKeys = compositeKeys.map((key) => {
        const [key1, key2] = key.split('|');
        return { key1, key2 };
      });

      let updated = 0;
      const updatePromises = parsedKeys.map(async ({ key1, key2 }) => {
        const { data, error } = await system.supabaseConnector.client.rpc(
          'add_to_download_profiles_link',
          {
            p_table_name: tableName,
            p_key1_name: key1Name,
            p_key1_value: key1,
            p_key2_name: key2Name,
            p_key2_value: key2
          }
        );

        if (error) {
          console.error(
            `📥 [Bulk Download] Error updating ${tableName} (${key1}, ${key2}):`,
            error
          );
          return;
        }

        if (data) {
          updated++;
          console.log(
            `📥 [Bulk Download] Added to ${tableName} (${key1}, ${key2})`
          );
        }
      });

      await Promise.all(updatePromises);
      console.log(
        `📥 [Bulk Download] Updated ${tableName}: ${updated} records`
      );
      return updated;
    };

    // Update each table
    const questsUpdated = await updateTable('quest', discoveredIds.questIds);
    results.push({ tableName: 'quest', recordsUpdated: questsUpdated });

    const projectsUpdated = await updateTable(
      'project',
      discoveredIds.projectIds
    );
    results.push({ tableName: 'project', recordsUpdated: projectsUpdated });

    const questAssetLinksUpdated = await updateLinkTable(
      'quest_asset_link',
      discoveredIds.questAssetLinkIds,
      'quest_id',
      'asset_id'
    );
    results.push({
      tableName: 'quest_asset_link',
      recordsUpdated: questAssetLinksUpdated
    });

    const assetsUpdated = await updateTable('asset', discoveredIds.assetIds);
    results.push({ tableName: 'asset', recordsUpdated: assetsUpdated });

    const assetContentLinksUpdated = await updateTable(
      'asset_content_link',
      discoveredIds.assetContentLinkIds
    );
    results.push({
      tableName: 'asset_content_link',
      recordsUpdated: assetContentLinksUpdated
    });

    const votesUpdated = await updateTable('vote', discoveredIds.voteIds);
    results.push({ tableName: 'vote', recordsUpdated: votesUpdated });

    const questTagLinksUpdated = await updateLinkTable(
      'quest_tag_link',
      discoveredIds.questTagLinkIds,
      'quest_id',
      'tag_id'
    );
    results.push({
      tableName: 'quest_tag_link',
      recordsUpdated: questTagLinksUpdated
    });

    const assetTagLinksUpdated = await updateLinkTable(
      'asset_tag_link',
      discoveredIds.assetTagLinkIds,
      'asset_id',
      'tag_id'
    );
    results.push({
      tableName: 'asset_tag_link',
      recordsUpdated: assetTagLinksUpdated
    });

    const tagsUpdated = await updateTable('tag', discoveredIds.tagIds);
    results.push({ tableName: 'tag', recordsUpdated: tagsUpdated });

    const languagesUpdated = await updateTable(
      'language',
      discoveredIds.languageIds
    );
    results.push({ tableName: 'language', recordsUpdated: languagesUpdated });

    console.log('📥 [Bulk Download] Completed successfully:', results);
    return results;
  } catch (error) {
    console.error('📥 [Bulk Download] Failed:', error);
    throw error;
  }
}
