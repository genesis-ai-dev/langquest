import { createLocalAssetInTx } from '@/database_services/assetService';
import {
  deleteLocalAssetRecordsInTx,
  getLocalAssetCascadeIds
} from '@/database_services/audioSegmentService';
import { system } from '@/db/powersync/system';
import { resolveTable } from '@/utils/dbUtils';
import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';

export interface MergeLocalAssetsParams {
  orderedAssetIds: string[];
  userId: string;
}

export interface MergeLocalAssetsResult {
  targetAssetId: string;
  deletedSourceAssetIds: string[];
  deletedAssetIds: string[];
  movedSegmentCount: number;
}

function ensureUniqueOrderedIds(ids: string[]): string[] {
  const unique: string[] = [];
  const seen = new Set<string>();

  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
  }

  return unique;
}

/**
 * Merge local assets by moving all source content-link rows to the first asset.
 * This is intentionally destructive for source assets, but preserves audio files.
 */
export async function mergeLocalAssets(
  params: MergeLocalAssetsParams
): Promise<MergeLocalAssetsResult> {
  const orderedAssetIds = ensureUniqueOrderedIds(params.orderedAssetIds);
  if (orderedAssetIds.length < 2) {
    throw new Error('At least 2 unique asset IDs are required to merge');
  }

  const targetAssetId = orderedAssetIds[0]!;
  const sourceAssetIds = orderedAssetIds.slice(1);
  const assetLocal = resolveTable('asset', { localOverride: true });
  const assetSynced = resolveTable('asset', { localOverride: false });
  const contentLocal = resolveTable('asset_content_link', {
    localOverride: true
  });

  const localAssets = await system.db
    .select({ id: assetLocal.id })
    .from(assetLocal)
    .where(inArray(assetLocal.id, orderedAssetIds));
  const localIdSet = new Set(localAssets.map((a) => a.id));

  const missingLocalIds = orderedAssetIds.filter((id) => !localIdSet.has(id));
  if (missingLocalIds.length > 0) {
    throw new Error(
      `Cannot merge non-local assets: ${missingLocalIds.map((id) => id.slice(0, 8)).join(', ')}`
    );
  }

  const syncedAssets = await system.db
    .select({ id: assetSynced.id })
    .from(assetSynced)
    .where(inArray(assetSynced.id, orderedAssetIds));
  if (syncedAssets.length > 0) {
    throw new Error(
      `Cannot merge synced assets: ${syncedAssets.map((a) => a.id.slice(0, 8)).join(', ')}`
    );
  }

  let movedSegmentCount = 0;
  let deletedAssetIds: string[] = [];

  await system.db.transaction(async (tx) => {
    const maxOrderResult = await tx
      .select({ maxOrder: sql<number>`MAX(${contentLocal.order_index})` })
      .from(contentLocal)
      .where(eq(contentLocal.asset_id, targetAssetId));
    let nextOrder = (maxOrderResult[0]?.maxOrder ?? 0) + 1;

    for (const sourceAssetId of sourceAssetIds) {
      const srcContent = await tx
        .select()
        .from(contentLocal)
        .where(eq(contentLocal.asset_id, sourceAssetId))
        .orderBy(asc(contentLocal.order_index), asc(contentLocal.created_at));

      for (const row of srcContent) {
        if (!row.audio) continue;
        await tx.insert(contentLocal).values({
          asset_id: targetAssetId,
          source_language_id: row.source_language_id,
          languoid_id: row.languoid_id ?? row.source_language_id ?? null,
          text: row.text || '',
          audio: row.audio,
          download_profiles: row.download_profiles ?? [params.userId],
          order_index: nextOrder++,
          metadata: (row as { metadata?: string | null }).metadata ?? null,
          _metadata: row._metadata ?? null
        });
        movedSegmentCount += 1;
      }
    }

    const allDeleteIdsOrdered: string[] = [];
    const seen = new Set<string>();
    for (const sourceAssetId of sourceAssetIds) {
      const cascadeIds = await getLocalAssetCascadeIds(sourceAssetId);
      for (const id of cascadeIds) {
        if (id === targetAssetId || seen.has(id)) continue;
        seen.add(id);
        allDeleteIdsOrdered.push(id);
      }
    }

    if (allDeleteIdsOrdered.length > 0) {
      await deleteLocalAssetRecordsInTx(tx, allDeleteIdsOrdered);
    }

    const allTargetContent = await tx
      .select({ id: contentLocal.id })
      .from(contentLocal)
      .where(eq(contentLocal.asset_id, targetAssetId))
      .orderBy(asc(contentLocal.order_index), asc(contentLocal.created_at));

    for (let i = 0; i < allTargetContent.length; i++) {
      await tx
        .update(contentLocal)
        .set({ order_index: i + 1 })
        .where(eq(contentLocal.id, allTargetContent[i]!.id));
    }

    deletedAssetIds = allDeleteIdsOrdered;
  });

  return {
    targetAssetId,
    deletedSourceAssetIds: sourceAssetIds,
    deletedAssetIds,
    movedSegmentCount
  };
}

// ============================================================================
// UNMERGE
// ============================================================================

export interface UnmergeLocalAssetParams {
  assetId: string;
  userId: string;
}

export interface UnmergedAssetInfo {
  id: string;
  name: string;
  orderIndex: number;
}

export interface UnmergeLocalAssetResult {
  originalAssetId: string;
  newAssets: UnmergedAssetInfo[];
}

/**
 * Unmerge a local asset that has multiple segments.
 * Keeps the first segment on the original asset and creates a new asset
 * for each subsequent segment. New assets are named "{originalName} (2)", "(3)", etc.
 * and inserted immediately after the original in list order.
 */
export async function unmergeLocalAsset(
  params: UnmergeLocalAssetParams
): Promise<UnmergeLocalAssetResult> {
  const { assetId, userId } = params;

  const assetLocal = resolveTable('asset', { localOverride: true });
  const assetSynced = resolveTable('asset', { localOverride: false });
  const contentLocal = resolveTable('asset_content_link', {
    localOverride: true
  });
  const linkLocal = resolveTable('quest_asset_link', { localOverride: true });

  // Validate: asset must exist locally
  const [localAsset] = await system.db
    .select()
    .from(assetLocal)
    .where(eq(assetLocal.id, assetId))
    .limit(1);

  if (!localAsset) {
    throw new Error('Asset not found in local table');
  }

  // Validate: asset must not be synced
  const syncedCheck = await system.db
    .select({ id: assetSynced.id })
    .from(assetSynced)
    .where(eq(assetSynced.id, assetId))
    .limit(1);

  if (syncedCheck.length > 0) {
    throw new Error('Cannot unmerge a synced asset');
  }

  // Read segments
  const segments = await system.db
    .select()
    .from(contentLocal)
    .where(eq(contentLocal.asset_id, assetId))
    .orderBy(asc(contentLocal.order_index), asc(contentLocal.created_at));

  if (segments.length < 2) {
    throw new Error('Asset has only one segment — nothing to unmerge');
  }

  // Find the quest this asset belongs to
  const [questLink] = await system.db
    .select({ quest_id: linkLocal.quest_id })
    .from(linkLocal)
    .where(eq(linkLocal.asset_id, assetId))
    .limit(1);

  if (!questLink) {
    throw new Error('Asset is not linked to any quest');
  }

  const questId = questLink.quest_id;
  const originalName = localAsset.name ?? 'Asset';
  const originalOrderIndex =
    typeof localAsset.order_index === 'number' ? localAsset.order_index : 0;
  const projectId = localAsset.project_id ?? '';
  const languoidId =
    localAsset.source_language_id ?? segments[0]?.languoid_id ?? '';

  const [keepSegment, ...splitSegments] = segments;
  const newAssets: UnmergedAssetInfo[] = [];

  await system.db.transaction(async (tx) => {
    // Remove all segments except the first from the original asset
    await tx
      .delete(contentLocal)
      .where(
        and(
          eq(contentLocal.asset_id, assetId),
          ne(contentLocal.id, keepSegment!.id)
        )
      );

    // Normalize the kept segment's order_index to 1
    await tx
      .update(contentLocal)
      .set({ order_index: 1 })
      .where(eq(contentLocal.id, keepSegment!.id));

    // Create a new asset for each split-off segment.
    // Each call shifts existing assets at/after the target position, so
    // consecutive inserts at originalOrderIndex+1, +2, ... each make room.
    for (let i = 0; i < splitSegments.length; i++) {
      const seg = splitSegments[i]!;
      const suffix = i + 2; // (2), (3), ...
      const newName = `${originalName} (${suffix})`;
      const newOrderIndex = originalOrderIndex + suffix - 1;

      const newId = await createLocalAssetInTx(tx, {
        name: newName,
        orderIndex: newOrderIndex,
        questId,
        projectId,
        userId,
        languoidId,
        audio: seg.audio ?? [],
        text: seg.text ?? newName,
        contentMetadata: seg._metadata ?? null,
        trimMetadata: (seg as { metadata?: string | null }).metadata ?? null,
        assetMetadata: localAsset.metadata ?? null,
        shiftExisting: true
      });

      newAssets.push({ id: newId, name: newName, orderIndex: newOrderIndex });
    }
  });

  console.log(
    `✅ Unmerge completed: "${originalName}" split into 1 + ${newAssets.length} assets`
  );

  return { originalAssetId: assetId, newAssets };
}
