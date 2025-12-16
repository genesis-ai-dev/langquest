/**
 * Asset service - Database operations for assets
 */

import { system } from '@/db/powersync/system';
import { resolveTable } from '@/utils/dbUtils';
import { and, eq, inArray } from 'drizzle-orm';

/**
 * Asset metadata structure for verse ranges
 */
export interface AssetMetadata {
  verse?: {
    from: number;
    to: number;
  };
}

/**
 * Update an asset's name - ONLY for local-only assets
 * @param assetId - The ID of the asset to rename
 * @param newName - The new name for the asset
 * @throws Error if asset is synced (immutable)
 */
export async function renameAsset(
  assetId: string,
  newName: string
): Promise<void> {
  try {
    // CRITICAL: Only allow renaming local-only assets
    // Synced assets are immutable once published
    const assetLocalTable = resolveTable('asset', { localOverride: true });

    // First, verify this asset exists in the LOCAL table only
    const localAsset = await system.db
      .select()
      .from(assetLocalTable)
      .where(eq(assetLocalTable.id, assetId))
      .limit(1);

    if (!localAsset || localAsset.length === 0) {
      throw new Error(
        'Asset not found in local table - cannot rename synced assets'
      );
    }

    // Verify it doesn't exist in synced table (double-check it's not published)
    const syncedTable = resolveTable('asset', { localOverride: false });
    const syncedAsset = await system.db
      .select()
      .from(syncedTable)
      .where(eq(syncedTable.id, assetId))
      .limit(1);

    if (syncedAsset && syncedAsset.length > 0) {
      throw new Error(
        'Cannot rename synced assets - they are immutable once published'
      );
    }

    // Safe to rename - it's local only
    await system.db
      .update(assetLocalTable)
      .set({ name: newName.trim() })
      .where(eq(assetLocalTable.id, assetId));

    console.log(`✅ Asset ${assetId.slice(0, 8)} renamed to: ${newName}`);
  } catch (error) {
    console.error('Failed to rename asset:', error);
    throw error;
  }
}

/**
 * Update asset content text - ONLY for local-only assets
 * @param assetId - The ID of the asset whose content to update
 * @param contentId - The ID of the specific content link record to update (optional - updates first content if not provided)
 * @param newText - The new text content
 * @throws Error if asset content is synced (immutable)
 */
export async function updateAssetContentText(
  assetId: string,
  newText: string,
  contentId?: string
): Promise<void> {
  try {
    // CRITICAL: Only allow updating local-only asset content
    // Synced asset content is immutable once published
    const assetContentLocalTable = resolveTable('asset_content_link', {
      localOverride: true
    });

    // First, verify this asset content exists in the LOCAL table only
    const whereCondition = contentId
      ? and(
          eq(assetContentLocalTable.asset_id, assetId),
          eq(assetContentLocalTable.id, contentId)
        )
      : eq(assetContentLocalTable.asset_id, assetId);

    const localAssetContent = await system.db
      .select()
      .from(assetContentLocalTable)
      .where(whereCondition)
      .limit(1);

    if (!localAssetContent || localAssetContent.length === 0) {
      throw new Error(
        'Asset content not found in local table - cannot edit synced content'
      );
    }

    const targetContentId = localAssetContent[0]!.id;

    // Verify it doesn't exist in synced table (double-check it's not published)
    const syncedTable = resolveTable('asset_content_link', {
      localOverride: false
    });
    const syncedAssetContent = await system.db
      .select()
      .from(syncedTable)
      .where(eq(syncedTable.id, targetContentId))
      .limit(1);

    if (syncedAssetContent && syncedAssetContent.length > 0) {
      throw new Error(
        'Cannot edit synced asset content - it is immutable once published'
      );
    }

    // Safe to update - it's local only
    await system.db
      .update(assetContentLocalTable)
      .set({ text: newText.trim() })
      .where(eq(assetContentLocalTable.id, targetContentId));

    console.log(
      `✅ Asset content ${targetContentId.slice(0, 8)} updated for asset ${assetId.slice(0, 8)}`
    );
  } catch (error: unknown) {
    console.error('Failed to update asset content text:', error);
    throw error;
  }
}

/**
 * Update asset metadata (verse range) - ONLY for local-only assets
 * @param assetId - The ID of the asset to update
 * @param metadata - The metadata object to store (will be JSON stringified)
 * @throws Error if asset is synced (immutable)
 */
export async function updateAssetMetadata(
  assetId: string,
  metadata: AssetMetadata | null
): Promise<void> {
  try {
    const assetLocalTable = resolveTable('asset', { localOverride: true });

    // Verify this asset exists in the LOCAL table
    const localAsset = await system.db
      .select()
      .from(assetLocalTable)
      .where(eq(assetLocalTable.id, assetId))
      .limit(1);

    if (!localAsset || localAsset.length === 0) {
      throw new Error(
        'Asset not found in local table - cannot update synced assets'
      );
    }

    // Verify it doesn't exist in synced table (double-check it's not published)
    const syncedTable = resolveTable('asset', { localOverride: false });
    const syncedAsset = await system.db
      .select()
      .from(syncedTable)
      .where(eq(syncedTable.id, assetId))
      .limit(1);

    if (syncedAsset && syncedAsset.length > 0) {
      throw new Error(
        'Cannot update synced assets - they are immutable once published'
      );
    }

    // Safe to update - it's local only
    const metadataStr = metadata ? JSON.stringify(metadata) : null;
    await system.db
      .update(assetLocalTable)
      .set({ metadata: metadataStr })
      .where(eq(assetLocalTable.id, assetId));

    console.log(`✅ Asset ${assetId.slice(0, 8)} metadata updated`);
  } catch (error) {
    console.error('Failed to update asset metadata:', error);
    throw error;
  }
}

/**
 * Batch update asset metadata for multiple assets
 * @param updates - Array of { assetId, metadata } objects
 */
export async function batchUpdateAssetMetadata(
  updates: { assetId: string; metadata: AssetMetadata | null }[]
): Promise<void> {
  if (updates.length === 0) return;

  try {
    const assetLocalTable = resolveTable('asset', { localOverride: true });
    const syncedTable = resolveTable('asset', { localOverride: false });

    const assetIds = updates.map((u) => u.assetId);

    // Check which assets exist in synced table (immutable)
    const syncedAssets = await system.db
      .select({ id: syncedTable.id })
      .from(syncedTable)
      .where(inArray(syncedTable.id, assetIds));

    const syncedIds = new Set(syncedAssets.map((a) => a.id));

    // Filter out synced assets
    const localUpdates = updates.filter((u) => !syncedIds.has(u.assetId));

    if (localUpdates.length === 0) {
      console.log('No local assets to update');
      return;
    }

    // Update each local asset
    for (const { assetId, metadata } of localUpdates) {
      const metadataStr = metadata ? JSON.stringify(metadata) : null;
      console.log(metadataStr);
      await system.db
        .update(assetLocalTable)
        .set({ metadata: metadataStr })
        .where(eq(assetLocalTable.id, assetId));
    }

    console.log(`✅ Updated metadata for ${localUpdates.length} assets`);
  } catch (error) {
    console.error('Failed to batch update asset metadata:', error);
    throw error;
  }
}
