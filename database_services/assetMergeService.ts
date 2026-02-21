import {
  deleteLocalAssetRecordsInTx,
  getLocalAssetCascadeIds
} from '@/database_services/audioSegmentService';
import { system } from '@/db/powersync/system';
import { resolveTable } from '@/utils/dbUtils';
import { asc, eq, inArray, sql } from 'drizzle-orm';

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

  const [targetAssetId, ...sourceAssetIds] = orderedAssetIds;
  const assetLocal = resolveTable('asset', { localOverride: true });
  const assetSynced = resolveTable('asset', { localOverride: false });
  const contentLocal = resolveTable('asset_content_link', { localOverride: true });

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
          metadata: row.metadata ?? null
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
