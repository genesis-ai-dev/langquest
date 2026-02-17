/**
 * Asset service - Database operations for assets
 */

import { system } from '@/db/powersync/system';
import { resolveTable } from '@/utils/dbUtils';
import { and, asc, eq, gte, inArray, lte, sql } from 'drizzle-orm';

/**
 * Asset metadata structure for verse ranges
 */
export interface AssetMetadata {
  verse?: {
    from: number;
    to: number;
  };
  recordingSessionId?: string;
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

    if (localAsset.length === 0) {
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

    if (syncedAsset.length > 0) {
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

    if (localAssetContent.length === 0) {
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

    if (syncedAssetContent.length > 0) {
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

    if (localAsset.length === 0) {
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

    if (syncedAsset.length > 0) {
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
 * Asset update payload for batch operations
 */
export interface AssetUpdatePayload {
  assetId: string;
  metadata?: AssetMetadata | null;
  order_index?: number;
}

/**
 * Batch update asset metadata and/or order_index for multiple assets
 * @param updates - Array of { assetId, metadata?, order_index? } objects
 */
export async function batchUpdateAssetMetadata(
  updates: AssetUpdatePayload[]
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
    for (const update of localUpdates) {
      const setPayload: { metadata?: string | null; order_index?: number } = {};

      // Only include metadata if explicitly provided
      if (update.metadata !== undefined) {
        setPayload.metadata = update.metadata
          ? JSON.stringify(update.metadata)
          : null;
      }

      // Only include order_index if explicitly provided
      if (update.order_index !== undefined) {
        setPayload.order_index = update.order_index;
      }

      // Skip if nothing to update
      if (Object.keys(setPayload).length === 0) continue;

      await system.db
        .update(assetLocalTable)
        .set(setPayload)
        .where(eq(assetLocalTable.id, update.assetId));
    }

    console.log(`✅ Updated ${localUpdates.length} assets`);
  } catch (error) {
    console.error('Failed to batch update assets:', error);
    throw error;
  }
}

/**
 * Normalize order_index for recorded verses
 * Recording uses unit scale (7001001, 7001002) but Assets view uses thousand scale (7001000, 7002000)
 * This function reads assets from DB and reassigns order_index with thousand scale
 * @param questId - The quest ID to normalize assets for
 * @param verses - Array of verse numbers that were recorded
 */
export async function normalizeOrderIndexForVerses(
  questId: string,
  verses: number[]
): Promise<void> {
  if (!questId || verses.length === 0) return;

  const assetTable = resolveTable('asset', { localOverride: true });
  const questAssetLinkTable = resolveTable('quest_asset_link', {
    localOverride: true
  });

  for (const verse of verses) {
    // Calculate order_index range for this verse
    // Formula: verse * 1000 * 1000 to (verse + 1) * 1000 * 1000 - 1
    // Example: verse 7 → 7000000 to 7999999
    const minOrderIndex = verse * 1000 * 1000;
    const maxOrderIndex = (verse + 1) * 1000 * 1000 - 1;

    try {
      // Query assets by order_index range using join with quest_asset_link
      // This ensures we only get assets that belong to this quest
      const assetsInVerse = await system.db
        .select({
          id: assetTable.id,
          name: assetTable.name,
          order_index: assetTable.order_index
        })
        .from(assetTable)
        .innerJoin(
          questAssetLinkTable,
          eq(assetTable.id, questAssetLinkTable.asset_id)
        )
        .where(
          and(
            eq(questAssetLinkTable.quest_id, questId),
            gte(assetTable.order_index, minOrderIndex),
            lte(assetTable.order_index, maxOrderIndex)
          )
        )
        .orderBy(asc(assetTable.order_index));

      if (assetsInVerse.length === 0) {
        continue;
      }

      // Recalculate order_index with thousand scale
      // Formula: (verse * 1000 + sequential) * 1000
      // sequential starts at 1: 7001000, 7002000, 7003000...
      const updates: AssetUpdatePayload[] = [];
      let hasChanges = false;

      for (let i = 0; i < assetsInVerse.length; i++) {
        const asset = assetsInVerse[i];
        if (!asset) continue;

        const sequential = i + 1; // 1-based
        const newOrderIndex = (verse * 1000 + sequential) * 1000;

        // Only update if order_index changed
        if (asset.order_index !== newOrderIndex) {
          hasChanges = true;
          updates.push({
            assetId: asset.id,
            order_index: newOrderIndex
          });
        }
      }

      if (hasChanges && updates.length > 0) {
        await batchUpdateAssetMetadata(updates);
        console.log(
          `  ✅ Verse ${verse}: normalized ${updates.length} of ${assetsInVerse.length} asset(s)`
        );
      }
    } catch (error) {
      console.error(`  ❌ Failed to normalize verse ${verse}:`, error);
    }
  }
}

/**
 * Update the order_index of content links within an asset.
 * Accepts an array of content link IDs in the desired order.
 * Each ID gets assigned order_index = its position in the array (1-based).
 *
 * NOTE: We use 1-based indexing so that every position differs from the
 * column default (0). PowerSync only includes changed columns in CRUD
 * patches, so setting order_index to 0 on a record that already has 0
 * would silently omit it from the sync payload.
 *
 * @param assetId - The asset whose content links are being reordered
 * @param orderedIds - Content link IDs in the desired display order
 */
export async function updateContentLinkOrder(
  assetId: string,
  orderedIds: string[],
  options?: { localOverride?: boolean }
): Promise<void> {
  const aclTable = resolveTable('asset_content_link', {
    localOverride: options?.localOverride ?? false
  });

  // Update each content link's order_index based on its position (1-based)
  for (let i = 0; i < orderedIds.length; i++) {
    await system.db
      .update(aclTable)
      .set({ order_index: i + 1 })
      .where(
        and(eq(aclTable.id, orderedIds[i]!), eq(aclTable.asset_id, assetId))
      );
  }
}

/**
 * Get the next available order_index for a given asset's content links.
 * Useful when inserting new content links (e.g. during merge).
 *
 * @param assetId - The asset to check
 * @returns The next order_index value (max + 1, or 1 if no content links exist)
 */
export async function getNextOrderIndex(
  assetId: string,
  options?: { localOverride?: boolean }
): Promise<number> {
  const aclTable = resolveTable('asset_content_link', {
    localOverride: options?.localOverride ?? false
  });

  const result = await system.db
    .select({ maxOrder: sql<number>`MAX(${aclTable.order_index})` })
    .from(aclTable)
    .where(eq(aclTable.asset_id, assetId));

  const maxOrder = result[0]?.maxOrder;
  return (maxOrder ?? 0) + 1;
}
