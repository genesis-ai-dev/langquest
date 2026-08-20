import { system } from '@/db/powersync/system';
import { resolveTable } from '@/utils/dbUtils';
import { and, eq, inArray } from 'drizzle-orm';
import uuid from 'react-native-uuid';
import type { AssetOperationDataItem, AssetOperationTypes } from './types';
import {
  dequeue as dequeueAssetGc,
  enqueue as enqueueAssetGc,
  type AssetGcOperation
} from './assetGarbageCollectorService';
import {
  batchUpdateAssetVerse,
  renameAsset,
  softDeleteAssetsFromQuest
} from './assetService';

function isCreatedItem(item: AssetOperationDataItem): boolean {
  return item.metadata?.provenance?.type === 'created';
}

function serializeLinkMetadata(
  metadata: AssetOperationDataItem['metadata']
): string | null {
  if (metadata == null) return null;
  return JSON.stringify(metadata);
}

/**
 * Restore assets (and their quest_asset_link snapshots) to a quest.
 * - Created / local assets: restore project_id
 * - All items: recreate quest_asset_link with name, order_index, metadata
 */
async function restoreAssetsToQuest(
  projectId: string,
  questId: string,
  items: AssetOperationDataItem[]
): Promise<void> {
  if (!projectId || !questId || items.length === 0) return;

  const itemsById = new Map<string, AssetOperationDataItem>();
  for (const item of items) {
    itemsById.set(item.id, item);
  }
  const uniqueItems = Array.from(itemsById.values());
  const uniqueAssetIds = uniqueItems.map((item) => item.id);

  const assetLocal = resolveTable('asset', { localOverride: true });
  const questAssetLinkLocal = resolveTable('quest_asset_link', {
    localOverride: true
  });

  await system.db.transaction(async (tx) => {
    const localAssets = await tx
      .select({
        id: assetLocal.id,
        download_profiles: assetLocal.download_profiles
      })
      .from(assetLocal)
      .where(inArray(assetLocal.id, uniqueAssetIds));

    const localAssetMap = new Map(
      localAssets.map((asset) => [asset.id, asset])
    );

    const createdOrLocalIds = uniqueItems
      .filter((item) => isCreatedItem(item) || localAssetMap.has(item.id))
      .map((item) => item.id);

    if (createdOrLocalIds.length > 0) {
      await tx
        .update(assetLocal)
        .set({ project_id: projectId })
        .where(inArray(assetLocal.id, createdOrLocalIds));
    }

    const existingLinks = await tx
      .select({ asset_id: questAssetLinkLocal.asset_id })
      .from(questAssetLinkLocal)
      .where(
        and(
          eq(questAssetLinkLocal.quest_id, questId),
          inArray(questAssetLinkLocal.asset_id, uniqueAssetIds)
        )
      );

    const existingAssetIds = new Set(
      existingLinks.map((link) => link.asset_id)
    );

    const linksToInsert = uniqueItems
      .filter((item) => !existingAssetIds.has(item.id))
      .map((item) => {
        const localAsset = localAssetMap.get(item.id);
        return {
          id: String(uuid.v4()),
          quest_id: questId,
          asset_id: item.id,
          name: item.name ?? null,
          order_index: item.order_index ?? 0,
          metadata: serializeLinkMetadata(item.metadata),
          download_profiles:
            item.download_profiles ?? localAsset?.download_profiles ?? []
        };
      });

    if (linksToInsert.length > 0) {
      await tx.insert(questAssetLinkLocal).values(linksToInsert);
    }
  });
}

/**
 * Detach assets from a quest (provenance-aware).
 * - Deletes quest_asset_link for the quest
 * - Nulls project_id and enqueues GC only for created assets
 */
async function detachAssetsFromQuest(
  questId: string,
  assetIds: string[],
  gcOperation: AssetGcOperation
): Promise<void> {
  if (assetIds.length === 0) return;
  const uniqueAssetIds = Array.from(new Set(assetIds));
  const assetLocal = resolveTable('asset', { localOverride: true });
  const questAssetLinkLocal = resolveTable('quest_asset_link', {
    localOverride: true
  });

  const links = await system.db
    .select({
      asset_id: questAssetLinkLocal.asset_id,
      metadata: questAssetLinkLocal.metadata
    })
    .from(questAssetLinkLocal)
    .where(
      and(
        eq(questAssetLinkLocal.quest_id, questId),
        inArray(questAssetLinkLocal.asset_id, uniqueAssetIds)
      )
    );

  // Explicit imported → never GC. Explicit created → GC.
  // Missing provenance → GC only if the asset still exists locally (legacy).
  const localAssets = await system.db
    .select({ id: assetLocal.id })
    .from(assetLocal)
    .where(inArray(assetLocal.id, uniqueAssetIds));
  const localIdSet = new Set(localAssets.map((row) => row.id));

  const createdForGc = Array.from(
    new Set(
      links
        .filter((link) => {
          let provenanceType: string | undefined;
          if (link.metadata) {
            try {
              const parsed =
                typeof link.metadata === 'string'
                  ? (JSON.parse(link.metadata) as {
                      provenance?: { type?: string };
                    })
                  : (link.metadata as { provenance?: { type?: string } });
              provenanceType = parsed?.provenance?.type;
            } catch {
              provenanceType = undefined;
            }
          }
          if (provenanceType === 'imported') return false;
          if (provenanceType === 'created') return true;
          return localIdSet.has(link.asset_id);
        })
        .map((link) => link.asset_id)
    )
  );

  await system.db.transaction(async (tx) => {
    if (createdForGc.length > 0) {
      await tx
        .update(assetLocal)
        .set({ project_id: null })
        .where(inArray(assetLocal.id, createdForGc));
    }

    await tx
      .delete(questAssetLinkLocal)
      .where(
        and(
          eq(questAssetLinkLocal.quest_id, questId),
          inArray(questAssetLinkLocal.asset_id, uniqueAssetIds)
        )
      );
  });

  if (createdForGc.length > 0) {
    await enqueueAssetGc(createdForGc, gcOperation);
  }
}

async function undoCreate(
  questId: string,
  operation: AssetOperationTypes
): Promise<void> {
  const newIds = operation.newData.map((item) => item.id);
  await detachAssetsFromQuest(questId, newIds, 'delete');
}

async function undoRename(
  questId: string,
  operation: AssetOperationTypes
): Promise<void> {
  for (const previous of operation.previousData) {
    if (!previous.name) continue;
    await renameAsset(questId, previous.id, previous.name);
  }
}

async function undoDelete(
  projectId: string,
  questId: string,
  operation: AssetOperationTypes
): Promise<void> {
  await restoreAssetsToQuest(projectId, questId, operation.previousData);
  // Safe for imported: dequeue is a no-op when the id was never enqueued.
  await dequeueAssetGc(operation.previousData.map((item) => item.id));
}

async function undoMerge(
  questId: string,
  projectId: string,
  operation: AssetOperationTypes
): Promise<void> {
  const previousIds = operation.previousData.map((item) => item.id);
  const newIds = operation.newData.map((item) => item.id);

  await restoreAssetsToQuest(projectId, questId, operation.previousData);
  await dequeueAssetGc(previousIds);
  // New merged records are only detached and queued for GC, enabling redo.
  await detachAssetsFromQuest(questId, newIds, 'merge');
}

async function undoReplace(
  questId: string,
  projectId: string,
  operation: AssetOperationTypes
): Promise<void> {
  const previousIds = operation.previousData.map((item) => item.id);
  const newIds = operation.newData.map((item) => item.id);

  await restoreAssetsToQuest(projectId, questId, operation.previousData);
  await dequeueAssetGc(previousIds);
  await detachAssetsFromQuest(questId, newIds, 'delete');
}

async function undoMove(
  questId: string,
  operation: AssetOperationTypes
): Promise<void> {
  const updates = operation.previousData.map((item) => ({
    assetId: item.id,
    metadata: item.metadata ?? null,
    order_index: item.order_index ?? undefined
  }));

  if (updates.length === 0) return;
  await batchUpdateAssetVerse(questId, updates);
}

async function undoImport(
  questId: string,
  operation: AssetOperationTypes
): Promise<void> {
  const importedIds = operation.newData.map((item) => item.id);
  await softDeleteAssetsFromQuest(questId, importedIds);
}

async function redoImport(
  projectId: string,
  questId: string,
  operation: AssetOperationTypes
): Promise<void> {
  await restoreAssetsToQuest(projectId, questId, operation.newData);
}

async function redoCreate(
  projectId: string,
  questId: string,
  operation: AssetOperationTypes
): Promise<void> {
  const newIds = operation.newData.map((item) => item.id);
  await restoreAssetsToQuest(projectId, questId, operation.newData);
  await dequeueAssetGc(newIds);
}

async function redoRename(
  questId: string,
  operation: AssetOperationTypes
): Promise<void> {
  for (const next of operation.newData) {
    if (!next.name) continue;
    await renameAsset(questId, next.id, next.name);
  }
}

async function redoDelete(
  questId: string,
  operation: AssetOperationTypes
): Promise<void> {
  const previousIds = operation.previousData.map((item) => item.id);
  await softDeleteAssetsFromQuest(questId, previousIds);
}

async function redoMerge(
  projectId: string,
  questId: string,
  operation: AssetOperationTypes
): Promise<void> {
  const previousIds = operation.previousData.map((item) => item.id);
  const newIds = operation.newData.map((item) => item.id);

  await detachAssetsFromQuest(questId, previousIds, 'merge');
  await restoreAssetsToQuest(projectId, questId, operation.newData);
  await dequeueAssetGc(newIds);
}

async function redoReplace(
  projectId: string,
  questId: string,
  operation: AssetOperationTypes
): Promise<void> {
  const previousIds = operation.previousData.map((item) => item.id);
  const newIds = operation.newData.map((item) => item.id);

  await detachAssetsFromQuest(questId, previousIds, 'delete');
  await restoreAssetsToQuest(projectId, questId, operation.newData);
  await dequeueAssetGc(newIds);
}

async function redoMove(
  questId: string,
  operation: AssetOperationTypes
): Promise<void> {
  const updates = operation.newData.map((item) => ({
    assetId: item.id,
    metadata: item.metadata ?? null,
    order_index: item.order_index ?? undefined
  }));

  if (updates.length === 0) return;
  await batchUpdateAssetVerse(questId, updates);
}

/**
 * Revert a recorded asset operation.
 * Receives context IDs and the history operation payload.
 */
export async function undo(
  projectId: string,
  questId: string,
  operation: AssetOperationTypes
): Promise<void> {
  if (!projectId || !questId) {
    throw new Error('undo requires both projectId and questId');
  }

  if (operation.domain !== 'asset') {
    throw new Error(`Unsupported undo domain: ${operation.domain}`);
  }

  switch (operation.action) {
    case 'create':
      await undoCreate(questId, operation);
      return;
    case 'rename':
      await undoRename(questId, operation);
      return;
    case 'delete':
      await undoDelete(projectId, questId, operation);
      return;
    case 'merge':
      await undoMerge(questId, projectId, operation);
      return;
    case 'replace':
      await undoReplace(questId, projectId, operation);
      return;
    case 'move':
      await undoMove(questId, operation);
      return;
    case 'import':
      await undoImport(questId, operation);
      return;
    default:
      throw new Error(`Unsupported asset undo action: ${operation.action}`);
  }
}

/**
 * Re-apply a previously undone asset operation.
 * Uses the same recorded payload and context IDs from undo history.
 */
export async function redo(
  projectId: string,
  questId: string,
  operation: AssetOperationTypes
): Promise<void> {
  if (!projectId || !questId) {
    throw new Error('redo requires both projectId and questId');
  }

  if (operation.domain !== 'asset') {
    throw new Error(`Unsupported redo domain: ${operation.domain}`);
  }

  switch (operation.action) {
    case 'create':
      await redoCreate(projectId, questId, operation);
      return;
    case 'rename':
      await redoRename(questId, operation);
      return;
    case 'delete':
      await redoDelete(questId, operation);
      return;
    case 'merge':
      await redoMerge(projectId, questId, operation);
      return;
    case 'replace':
      await redoReplace(projectId, questId, operation);
      return;
    case 'move':
      await redoMove(questId, operation);
      return;
    case 'import':
      await redoImport(projectId, questId, operation);
      return;
    default:
      throw new Error(`Unsupported asset redo action: ${operation.action}`);
  }
}
