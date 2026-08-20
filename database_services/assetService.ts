/**
 * Asset service - Database operations for assets.
 */

import { system } from '@/db/powersync/system';
import { resolveTable } from '@/utils/dbUtils';
import { and, asc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import uuid from 'react-native-uuid';
import { enqueue as enqueueAssetGc } from './assetGarbageCollectorService';
import type { AssetOperationDataItem } from './types';

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

export interface QuestAssetLinkMetadata {
  verse?: {
    from: number;
    to: number;
  };
  recordingSessionId?: string;
  provenance?: {
    type: 'created' | 'imported';
  };
}

/**
 * Update an asset's name within a quest.
 * - Published quest_asset_link rows are immutable.
 * - Imported/remixed links only update quest_asset_link.name.
 * - Created links update both quest_asset_link.name and the local asset name.
 *
 * @param questId - The quest where the asset is being renamed
 * @param assetId - The ID of the asset to rename
 * @param newName - The new name for the asset
 * @throws Error if the quest link or created asset is synced (immutable)
 */
export async function renameAsset(
  questId: string,
  assetId: string,
  newName: string
): Promise<void> {
  try {
    const trimmedName = newName.trim();
    const questAssetLinkLocalTable = resolveTable('quest_asset_link', {
      localOverride: true
    });
    const questAssetLinkSyncedTable = resolveTable('quest_asset_link', {
      localOverride: false
    });
    const assetLocalTable = resolveTable('asset', { localOverride: true });

    const syncedQuestAssetLink = await system.db
      .select()
      .from(questAssetLinkSyncedTable)
      .where(
        and(
          eq(questAssetLinkSyncedTable.quest_id, questId),
          eq(questAssetLinkSyncedTable.asset_id, assetId)
        )
      )
      .limit(1);

    if (syncedQuestAssetLink.length > 0) {
      throw new Error(
        'Cannot rename asset in a published quest link - it is immutable once published'
      );
    }

    const localQuestAssetLink = await system.db
      .select()
      .from(questAssetLinkLocalTable)
      .where(
        and(
          eq(questAssetLinkLocalTable.quest_id, questId),
          eq(questAssetLinkLocalTable.asset_id, assetId)
        )
      )
      .limit(1);

    const questAssetLink = localQuestAssetLink[0];

    if (!questAssetLink) {
      throw new Error(
        'Quest asset link not found in local table - cannot rename published links'
      );
    }

    const parsedMetadata =
      typeof questAssetLink.metadata === 'string'
        ? (JSON.parse(questAssetLink.metadata) as {
            provenance?: { type?: string };
          })
        : (questAssetLink.metadata as {
            provenance?: { type?: string };
          } | null);
    const isCreated = parsedMetadata?.provenance?.type === 'created';

    if (!isCreated) {
      await system.db
        .update(questAssetLinkLocalTable)
        .set({ name: trimmedName })
        .where(
          and(
            eq(questAssetLinkLocalTable.quest_id, questId),
            eq(questAssetLinkLocalTable.asset_id, assetId)
          )
        );

      console.log(
        `✅ Quest asset link ${assetId.slice(0, 8)} renamed to: ${trimmedName}`
      );
      return;
    }

    // Created assets can update the canonical local asset too, as long as it
    // has not been published.
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

    await system.db.transaction(async (tx) => {
      await tx
        .update(assetLocalTable)
        .set({ name: trimmedName })
        .where(eq(assetLocalTable.id, assetId));

      await tx
        .update(questAssetLinkLocalTable)
        .set({ name: trimmedName })
        .where(
          and(
            eq(questAssetLinkLocalTable.quest_id, questId),
            eq(questAssetLinkLocalTable.asset_id, assetId)
          )
        );
    });

    console.log(`✅ Asset ${assetId.slice(0, 8)} renamed to: ${trimmedName}`);
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

type MetadataRecord = Record<string, unknown> & {
  verse?: {
    from?: number;
    to?: number;
  };
  provenance?: {
    type?: string;
  };
};

function parseMetadataRecord(metadata: unknown): MetadataRecord {
  if (!metadata) return {};
  if (typeof metadata === 'string') {
    try {
      const parsed = JSON.parse(metadata) as unknown;
      return parsed && typeof parsed === 'object'
        ? (parsed as MetadataRecord)
        : {};
    } catch {
      return {};
    }
  }
  return typeof metadata === 'object' ? (metadata as MetadataRecord) : {};
}

function patchVerseMetadata(
  existingMetadata: unknown,
  nextVerse: AssetMetadata['verse'] | null | undefined
): MetadataRecord {
  const base = parseMetadataRecord(existingMetadata);

  if (!nextVerse) {
    const { verse: _verse, ...rest } = base;
    return rest;
  }

  return {
    ...base,
    verse: {
      ...(base.verse ?? {}),
      from: nextVerse.from,
      to: nextVerse.to
    }
  };
}

export async function updateAssetVerse(
  questId: string,
  assetId: string,
  metadata: AssetMetadata | null | undefined,
  orderIndex?: number
): Promise<void> {
  try {
    const questAssetLinkLocalTable = resolveTable('quest_asset_link', {
      localOverride: true
    });
    const questAssetLinkSyncedTable = resolveTable('quest_asset_link', {
      localOverride: false
    });
    const assetLocalTable = resolveTable('asset', { localOverride: true });

    const syncedQuestAssetLink = await system.db
      .select()
      .from(questAssetLinkSyncedTable)
      .where(
        and(
          eq(questAssetLinkSyncedTable.quest_id, questId),
          eq(questAssetLinkSyncedTable.asset_id, assetId)
        )
      )
      .limit(1);

    if (syncedQuestAssetLink.length > 0) {
      throw new Error(
        'Cannot update verse in a published quest link - it is immutable once published'
      );
    }

    const localQuestAssetLink = await system.db
      .select()
      .from(questAssetLinkLocalTable)
      .where(
        and(
          eq(questAssetLinkLocalTable.quest_id, questId),
          eq(questAssetLinkLocalTable.asset_id, assetId)
        )
      )
      .limit(1);

    const questAssetLink = localQuestAssetLink[0];

    if (!questAssetLink) {
      throw new Error(
        'Quest asset link not found in local table - cannot update published links'
      );
    }

    const setLinkPayload: {
      metadata?: string;
      order_index?: number;
    } = {};

    if (metadata !== undefined) {
      const nextLinkMetadata = patchVerseMetadata(
        questAssetLink.metadata,
        metadata?.verse
      );
      setLinkPayload.metadata = JSON.stringify(nextLinkMetadata);
    }

    if (orderIndex !== undefined) {
      setLinkPayload.order_index = orderIndex;
    }

    if (Object.keys(setLinkPayload).length === 0) {
      return;
    }

    const isCreated =
      parseMetadataRecord(questAssetLink.metadata).provenance?.type ===
      'created';

    if (!isCreated) {
      console.log('>>>>> Updating quest asset link metadata');
      await system.db
        .update(questAssetLinkLocalTable)
        .set(setLinkPayload)
        .where(
          and(
            eq(questAssetLinkLocalTable.quest_id, questId),
            eq(questAssetLinkLocalTable.asset_id, assetId)
          )
        );

      // console.log(`✅ Quest asset link ${assetId.slice(0, 8)} verse updated`);
      return;
    }

    const localAsset = await system.db
      .select()
      .from(assetLocalTable)
      .where(eq(assetLocalTable.id, assetId))
      .limit(1);

    const asset = localAsset[0];

    if (!asset) {
      throw new Error(
        'Asset not found in local table - cannot update synced assets'
      );
    }

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

    await system.db.transaction(async (tx) => {
      if (metadata !== undefined) {
        const nextAssetMetadata = patchVerseMetadata(
          asset.metadata,
          metadata?.verse
        );
        await tx
          .update(assetLocalTable)
          .set({ metadata: JSON.stringify(nextAssetMetadata) })
          .where(eq(assetLocalTable.id, assetId));
      }

      await tx
        .update(questAssetLinkLocalTable)
        .set(setLinkPayload)
        .where(
          and(
            eq(questAssetLinkLocalTable.quest_id, questId),
            eq(questAssetLinkLocalTable.asset_id, assetId)
          )
        );
    });

    // console.log(`✅ Asset ${assetId.slice(0, 8)} verse updated`);
  } catch (error) {
    console.error('Failed to update asset verse:', error);
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

export interface SoftMergeAssetInput {
  id: string;
}

export interface SoftMergeResult {
  newAssetId: string;
  newAssetName: string;
  orderIndex: number | null;
}

/**
 * Batch update asset verse and/or quest-specific order_index for multiple assets.
 * Only metadata.verse is patched; every other metadata property is preserved.
 */
export async function batchUpdateAssetVerse(
  questId: string,
  updates: AssetUpdatePayload[]
): Promise<void> {
  if (updates.length === 0) return;

  try {
    for (const update of updates) {
      await updateAssetVerse(
        questId,
        update.assetId,
        update.metadata,
        update.order_index
      );
    }

    // console.log(`✅ Updated ${updates.length} asset verse placement(s)`);
  } catch (error) {
    console.error('Failed to batch update asset verses:', error);
    throw error;
  }
}

/**
 * Soft delete assets for a specific quest.
 * - Sets asset.project_id = null for created assets only
 * - Deletes quest_asset_link rows for the provided quest
 * - Enqueues GC only for created assets
 * - Keeps asset_content_link rows intact
 * - Returns link snapshots for undo/redo restore
 */
export async function softDeleteAssetsFromQuest(
  questId: string,
  assetIds: string[]
): Promise<AssetOperationDataItem[]> {
  if (!questId || assetIds.length === 0) return [];

  const assetLocal = resolveTable('asset', { localOverride: true });
  const questAssetLinkLocal = resolveTable('quest_asset_link', {
    localOverride: true
  });
  const linksToDelete = await system.db
    .select({
      asset_id: questAssetLinkLocal.asset_id,
      name: questAssetLinkLocal.name,
      order_index: questAssetLinkLocal.order_index,
      metadata: questAssetLinkLocal.metadata,
      download_profiles: questAssetLinkLocal.download_profiles
    })
    .from(questAssetLinkLocal)
    .where(
      and(
        eq(questAssetLinkLocal.quest_id, questId),
        inArray(questAssetLinkLocal.asset_id, assetIds)
      )
    );

  const snapshots: AssetOperationDataItem[] = linksToDelete.map((link) => ({
    id: link.asset_id,
    name: link.name ?? null,
    order_index: link.order_index ?? 0,
    metadata: parseMetadataRecord(link.metadata),
    download_profiles: link.download_profiles ?? []
  }));

  const createdAssetIds = snapshots
    .filter((item) => item.metadata?.provenance?.type === 'created')
    .map((item) => item.id);

  await system.db.transaction(async (tx) => {
    if (createdAssetIds.length > 0) {
      await tx
        .update(assetLocal)
        .set({ project_id: null })
        .where(inArray(assetLocal.id, createdAssetIds));
    }

    await tx
      .delete(questAssetLinkLocal)
      .where(
        and(
          eq(questAssetLinkLocal.quest_id, questId),
          inArray(questAssetLinkLocal.asset_id, assetIds)
        )
      );
  });

  if (createdAssetIds.length > 0) {
    await enqueueAssetGc(createdAssetIds, 'delete');
  }

  return snapshots;
}

/**
 * Soft merge assets in a quest:
 * - Creates a NEW asset based on the first selected asset
 * - Creates NEW quest_asset_link for the new asset
 * - Creates NEW asset_content_link rows with sequential order_index
 * - Only then removes project_id and quest links from merged source assets
 */
export async function softMergeAssetsInQuest(params: {
  questId: string;
  assetsToMerge: SoftMergeAssetInput[];
  fallbackProjectId?: string | null;
  fallbackCreatorId?: string | null;
}): Promise<SoftMergeResult | null> {
  const { questId, assetsToMerge, fallbackProjectId, fallbackCreatorId } =
    params;
  if (!questId || assetsToMerge.length < 2) return null;

  const sourceIds = assetsToMerge.map((asset) => asset.id);
  const firstSelected = assetsToMerge[0]!;
  const assetLocal = resolveTable('asset', { localOverride: true });
  const questAssetLinkLocal = resolveTable('quest_asset_link', {
    localOverride: true
  });
  const contentLocal = resolveTable('asset_content_link', {
    localOverride: true
  });

  return system.db
    .transaction(async (tx) => {
      const sourceLinks = await tx
        .select({
          asset_id: questAssetLinkLocal.asset_id,
          name: questAssetLinkLocal.name,
          order_index: questAssetLinkLocal.order_index,
          download_profiles: questAssetLinkLocal.download_profiles,
          metadata: questAssetLinkLocal.metadata
        })
        .from(questAssetLinkLocal)
        .where(
          and(
            eq(questAssetLinkLocal.quest_id, questId),
            inArray(questAssetLinkLocal.asset_id, sourceIds)
          )
        );

      if (sourceLinks.length !== sourceIds.length) {
        throw new Error(
          'One or more selected assets are not linked to this quest'
        );
      }

      const nonCreatedLink = sourceLinks.find((link) => {
        const metadata = parseMetadataRecord(link.metadata);
        return metadata.provenance?.type !== 'created';
      });

      if (nonCreatedLink) {
        throw new Error(
          'Cannot merge imported or remixed assets. Only assets created in this quest can be merged.'
        );
      }

      const firstSourceLink = sourceLinks.find(
        (link) => link.asset_id === firstSelected.id
      );

      if (!firstSourceLink) {
        throw new Error('First selected asset link not found for soft merge');
      }

      const firstAsset = await tx
        .select()
        .from(assetLocal)
        .where(eq(assetLocal.id, firstSelected.id))
        .limit(1);
      const first = firstAsset[0];
      if (!first) {
        throw new Error('First selected asset not found for soft merge');
      }

      const mergedContent: {
        source_language_id: string | null;
        languoid_id: string | null;
        text: string | null;
        audio: string[] | null;
        download_profiles: string[] | null;
      }[] = [];

      for (const source of assetsToMerge) {
        const sourceContent = await tx
          .select({
            source_language_id: contentLocal.source_language_id,
            languoid_id: contentLocal.languoid_id,
            text: contentLocal.text,
            audio: contentLocal.audio,
            download_profiles: contentLocal.download_profiles
          })
          .from(contentLocal)
          .where(eq(contentLocal.asset_id, source.id))
          .orderBy(asc(contentLocal.order_index), asc(contentLocal.created_at));

        mergedContent.push(...sourceContent);
      }

      const newAssetId = String(uuid.v4());
      const creatorId = first.creator_id ?? fallbackCreatorId ?? null;
      const newProjectId = first.project_id ?? fallbackProjectId ?? null;
      const mergedName = firstSourceLink.name ?? first.name;
      const mergedOrderIndex = firstSourceLink.order_index ?? first.order_index;
      const mergedAssetMetadata = {
        ...parseMetadataRecord(first.metadata),
        origin: {
          questId
        }
      };
      const mergedQuestAssetLinkMetadata = {
        ...parseMetadataRecord(firstSourceLink.metadata),
        provenance: {
          type: 'created'
        }
      };

      await tx.insert(assetLocal).values({
        id: newAssetId,
        name: mergedName,
        images: first.images,
        visible: first.visible,
        download_profiles:
          first.download_profiles ?? (creatorId ? [creatorId] : []),
        source_language_id: first.source_language_id,
        project_id: newProjectId,
        source_asset_id: first.source_asset_id,
        content_type: first.content_type,
        creator_id: creatorId,
        order_index: mergedOrderIndex,
        metadata: JSON.stringify(mergedAssetMetadata),
        uploaded_at: first.uploaded_at
      });

      await tx.insert(questAssetLinkLocal).values({
        id: String(uuid.v4()),
        quest_id: questId,
        asset_id: newAssetId,
        name: mergedName,
        order_index: mergedOrderIndex,
        metadata: JSON.stringify(mergedQuestAssetLinkMetadata),
        download_profiles:
          firstSourceLink.download_profiles ??
          first.download_profiles ??
          (creatorId ? [creatorId] : [])
      });

      let contentOrder = 1;
      for (const content of mergedContent) {
        await tx.insert(contentLocal).values({
          asset_id: newAssetId,
          source_language_id: content.source_language_id,
          languoid_id: content.languoid_id ?? content.source_language_id,
          text: content.text ?? '',
          audio: content.audio,
          download_profiles:
            content.download_profiles ?? (creatorId ? [creatorId] : []),
          order_index: contentOrder++
        });
      }

      // IMPORTANT: only after creating new records do we remove old links.
      await tx
        .update(assetLocal)
        .set({ project_id: null })
        .where(inArray(assetLocal.id, sourceIds));

      await tx
        .delete(questAssetLinkLocal)
        .where(
          and(
            eq(questAssetLinkLocal.quest_id, questId),
            inArray(questAssetLinkLocal.asset_id, sourceIds)
          )
        );

      return {
        newAssetId,
        newAssetName: mergedName ?? 'Merged',
        orderIndex: mergedOrderIndex
      };
    })
    .then(async (result) => {
      await enqueueAssetGc(sourceIds, 'merge');
      return result;
    });
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
          // name: assetTable.name,
          order_index: questAssetLinkTable.order_index
        })
        .from(assetTable)
        .innerJoin(
          questAssetLinkTable,
          eq(assetTable.id, questAssetLinkTable.asset_id)
        )
        .where(
          and(
            eq(questAssetLinkTable.quest_id, questId),
            gte(questAssetLinkTable.order_index, minOrderIndex),
            lte(questAssetLinkTable.order_index, maxOrderIndex)
          )
        )
        .orderBy(asc(questAssetLinkTable.order_index));

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
        await batchUpdateAssetVerse(questId, updates);
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

export interface LinkExistingAssetToQuestItem {
  assetId: string;
  name?: string | null;
  order_index: number;
  metadata: QuestAssetLinkMetadata;
}

export interface LinkExistingAssetsToQuestResult {
  linkedAssetIds: string[];
  skippedAssetIds: string[];
  linkedSnapshots: AssetOperationDataItem[];
}

/**
 * Link existing assets into a quest by creating quest_asset_link rows only.
 * Never inserts/updates the shared asset record.
 */
export async function linkExistingAssetsToQuest(params: {
  questId: string;
  userId: string;
  items: LinkExistingAssetToQuestItem[];
}): Promise<LinkExistingAssetsToQuestResult> {
  const { questId, userId, items } = params;
  if (items.length === 0) {
    return { linkedAssetIds: [], skippedAssetIds: [], linkedSnapshots: [] };
  }

  const linkLocal = resolveTable('quest_asset_link', { localOverride: true });
  const linkSynced = resolveTable('quest_asset_link', { localOverride: false });
  const assetIds = items.map((item) => item.assetId);

  const [localLinks, syncedLinks] = await Promise.all([
    system.db
      .select({ asset_id: linkLocal.asset_id })
      .from(linkLocal)
      .where(
        and(
          eq(linkLocal.quest_id, questId),
          inArray(linkLocal.asset_id, assetIds)
        )
      ),
    system.db
      .select({ asset_id: linkSynced.asset_id })
      .from(linkSynced)
      .where(
        and(
          eq(linkSynced.quest_id, questId),
          inArray(linkSynced.asset_id, assetIds)
        )
      )
  ]);

  const alreadyLinked = new Set(
    [...localLinks, ...syncedLinks].map((link) => link.asset_id)
  );

  const itemsToInsert = items.filter(
    (item) => !alreadyLinked.has(item.assetId)
  );
  const skippedAssetIds = items
    .filter((item) => alreadyLinked.has(item.assetId))
    .map((item) => item.assetId);

  if (itemsToInsert.length === 0) {
    return { linkedAssetIds: [], skippedAssetIds, linkedSnapshots: [] };
  }

  const linkedSnapshots: AssetOperationDataItem[] = itemsToInsert.map(
    (item) => ({
      id: item.assetId,
      name: item.name ?? null,
      order_index: item.order_index,
      metadata: item.metadata as Record<string, unknown>,
      download_profiles: [userId]
    })
  );

  await system.db.transaction(async (tx) => {
    for (const item of itemsToInsert) {
      await tx.insert(linkLocal).values({
        id: String(uuid.v4()),
        quest_id: questId,
        asset_id: item.assetId,
        name: item.name ?? null,
        order_index: item.order_index,
        metadata: JSON.stringify(item.metadata),
        download_profiles: [userId]
      });
    }
  });

  return {
    linkedAssetIds: itemsToInsert.map((item) => item.assetId),
    skippedAssetIds,
    linkedSnapshots
  };
}
