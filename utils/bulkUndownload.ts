import { system } from '@/db/powersync/system';

interface VerifiedIds {
  questIds: string[];
  projectIds: string[];
  questAssetLinkIds: string[];
  assetIds: string[];
  assetContentLinkIds: string[];
  voteIds: string[];
  questTagLinkIds: string[];
  assetTagLinkIds: string[];
  tagIds: string[];
  languoidIds: string[];
  languoidAliasIds: string[];
  languoidSourceIds: string[];
  languoidPropertyIds: string[];
  languoidRegionIds: string[];
  regionIds: string[];
  regionAliasIds: string[];
  regionSourceIds: string[];
  regionPropertyIds: string[];
}

interface BulkUndownloadResult {
  tableName: string;
  recordsUpdated: number;
}

/**
 * Performs bulk undownload by removing download_profiles for all verified records.
 * Mirrors the bulkDownload approach but removes instead of adds.
 */
export async function bulkUndownloadQuest(
  verifiedIds: VerifiedIds
): Promise<BulkUndownloadResult[]> {
  console.log('🗑️ [Bulk Undownload] Starting bulk undownload');
  console.log('🗑️ [Bulk Undownload] Verified IDs:', verifiedIds);

  const results: BulkUndownloadResult[] = [];

  try {
    // Helper function to remove from a table with single ID
    const removeFromTable = async (
      tableName: string,
      ids: string[]
    ): Promise<number> => {
      if (ids.length === 0) {
        console.log(`🗑️ [Bulk Undownload] Skipping ${tableName} (no IDs)`);
        return 0;
      }

      console.log(
        `🗑️ [Bulk Undownload] Removing from ${tableName}: ${ids.length} records`
      );

      // Call atomic function for each ID
      let updated = 0;
      const removePromises = ids.map(async (id) => {
        const { data, error } = await system.supabaseConnector.client.rpc(
          'remove_from_download_profiles',
          {
            p_table_name: tableName,
            p_record_id: id
          }
        );

        if (error) {
          console.error(
            `🗑️ [Bulk Undownload] Error removing from ${tableName} ${id}:`,
            error
          );
          throw error;
        }

        if (data) {
          updated++;
          console.log(`🗑️ [Bulk Undownload] Removed from ${tableName} ${id}`);
        } else {
          console.log(
            `🗑️ [Bulk Undownload] Already removed from ${tableName} ${id}`
          );
        }
      });

      await Promise.all(removePromises);
      console.log(
        `🗑️ [Bulk Undownload] Removed from ${tableName}: ${updated} records`
      );
      return updated;
    };

    // Helper function to remove from link tables with composite keys
    const removeFromLinkTable = async (
      tableName: string,
      compositeKeys: string[],
      key1Name: string,
      key2Name: string
    ): Promise<number> => {
      if (compositeKeys.length === 0) {
        console.log(`🗑️ [Bulk Undownload] Skipping ${tableName} (no IDs)`);
        return 0;
      }

      console.log(
        `🗑️ [Bulk Undownload] Removing from ${tableName}: ${compositeKeys.length} records`
      );

      const parsedKeys = compositeKeys.map((key) => {
        const [key1, key2] = key.split('|');
        return { key1, key2 };
      });

      let updated = 0;
      const removePromises = parsedKeys.map(async ({ key1, key2 }) => {
        const { data, error } = await system.supabaseConnector.client.rpc(
          'remove_from_download_profiles_link',
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
            `🗑️ [Bulk Undownload] Error removing from ${tableName} (${key1}, ${key2}):`,
            error
          );
          return;
        }

        if (data) {
          updated++;
          console.log(
            `🗑️ [Bulk Undownload] Removed from ${tableName} (${key1}, ${key2})`
          );
        }
      });

      await Promise.all(removePromises);
      console.log(
        `🗑️ [Bulk Undownload] Removed from ${tableName}: ${updated} records`
      );
      return updated;
    };

    // Remove from each table in reverse order (opposite of download)
    // This ensures dependencies are removed in the right order

    // Remove from languoid-related tables
    const regionPropertiesUpdated = await removeFromTable(
      'region_property',
      verifiedIds.regionPropertyIds
    );
    results.push({
      tableName: 'region_property',
      recordsUpdated: regionPropertiesUpdated
    });

    const regionSourcesUpdated = await removeFromTable(
      'region_source',
      verifiedIds.regionSourceIds
    );
    results.push({
      tableName: 'region_source',
      recordsUpdated: regionSourcesUpdated
    });

    const regionAliasesUpdated = await removeFromTable(
      'region_alias',
      verifiedIds.regionAliasIds
    );
    results.push({
      tableName: 'region_alias',
      recordsUpdated: regionAliasesUpdated
    });

    const regionsUpdated = await removeFromTable(
      'region',
      verifiedIds.regionIds
    );
    results.push({ tableName: 'region', recordsUpdated: regionsUpdated });

    const languoidRegionsUpdated = await removeFromTable(
      'languoid_region',
      verifiedIds.languoidRegionIds
    );
    results.push({
      tableName: 'languoid_region',
      recordsUpdated: languoidRegionsUpdated
    });

    const languoidPropertiesUpdated = await removeFromTable(
      'languoid_property',
      verifiedIds.languoidPropertyIds
    );
    results.push({
      tableName: 'languoid_property',
      recordsUpdated: languoidPropertiesUpdated
    });

    const languoidSourcesUpdated = await removeFromTable(
      'languoid_source',
      verifiedIds.languoidSourceIds
    );
    results.push({
      tableName: 'languoid_source',
      recordsUpdated: languoidSourcesUpdated
    });

    const languoidAliasesUpdated = await removeFromTable(
      'languoid_alias',
      verifiedIds.languoidAliasIds
    );
    results.push({
      tableName: 'languoid_alias',
      recordsUpdated: languoidAliasesUpdated
    });

    const languoidsUpdated = await removeFromTable(
      'languoid',
      verifiedIds.languoidIds
    );
    results.push({ tableName: 'languoid', recordsUpdated: languoidsUpdated });

    const tagsUpdated = await removeFromTable('tag', verifiedIds.tagIds);
    results.push({ tableName: 'tag', recordsUpdated: tagsUpdated });

    const assetTagLinksUpdated = await removeFromLinkTable(
      'asset_tag_link',
      verifiedIds.assetTagLinkIds,
      'asset_id',
      'tag_id'
    );
    results.push({
      tableName: 'asset_tag_link',
      recordsUpdated: assetTagLinksUpdated
    });

    const questTagLinksUpdated = await removeFromLinkTable(
      'quest_tag_link',
      verifiedIds.questTagLinkIds,
      'quest_id',
      'tag_id'
    );
    results.push({
      tableName: 'quest_tag_link',
      recordsUpdated: questTagLinksUpdated
    });

    const votesUpdated = await removeFromTable('vote', verifiedIds.voteIds);
    results.push({ tableName: 'vote', recordsUpdated: votesUpdated });

    const assetContentLinksUpdated = await removeFromTable(
      'asset_content_link',
      verifiedIds.assetContentLinkIds
    );
    results.push({
      tableName: 'asset_content_link',
      recordsUpdated: assetContentLinksUpdated
    });

    const assetsUpdated = await removeFromTable('asset', verifiedIds.assetIds);
    results.push({ tableName: 'asset', recordsUpdated: assetsUpdated });

    const questAssetLinksUpdated = await removeFromLinkTable(
      'quest_asset_link',
      verifiedIds.questAssetLinkIds,
      'quest_id',
      'asset_id'
    );
    results.push({
      tableName: 'quest_asset_link',
      recordsUpdated: questAssetLinksUpdated
    });

    const projectsUpdated = await removeFromTable(
      'project',
      verifiedIds.projectIds
    );
    results.push({ tableName: 'project', recordsUpdated: projectsUpdated });

    const questsUpdated = await removeFromTable('quest', verifiedIds.questIds);
    results.push({ tableName: 'quest', recordsUpdated: questsUpdated });

    console.log('🗑️ [Bulk Undownload] Completed successfully:', results);
    return results;
  } catch (error) {
    console.error('🗑️ [Bulk Undownload] Failed:', error);
    throw error;
  }
}
