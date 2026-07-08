import { system } from '@/db/powersync/system';
import { resolveTable } from '@/utils/dbUtils';
import { and, eq, inArray } from 'drizzle-orm';
import uuid from 'react-native-uuid';
import type { AssetOperationTypes } from './types';
import {
  dequeue as dequeueAssetGc,
  enqueue as enqueueAssetGc,
  type AssetGcOperation
} from './assetGarbageCollectorService';
import { batchUpdateAssetVerse, renameAsset } from './assetService';

async function restoreAssetsToQuest(
  projectId: string,
  questId: string,
  assetIds: string[]
): Promise<void> {
  if (!projectId || !questId || assetIds.length === 0) return;

  const uniqueAssetIds = Array.from(new Set(assetIds));
  const assetLocal = resolveTable('asset', { localOverride: true });
  const questAssetLinkLocal = resolveTable('quest_asset_link', {
    localOverride: true
  });

  await system.db.transaction(async (tx) => {
    await tx
      .update(assetLocal)
      .set({ project_id: projectId })
      .where(inArray(assetLocal.id, uniqueAssetIds));

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

    const assets = await tx
      .select({
        id: assetLocal.id,
        download_profiles: assetLocal.download_profiles
      })
      .from(assetLocal)
      .where(inArray(assetLocal.id, uniqueAssetIds));

    const linksToInsert = assets
      .filter((asset) => !existingAssetIds.has(asset.id))
      .map((asset) => ({
        id: String(uuid.v4()),
        quest_id: questId,
        asset_id: asset.id,
        download_profiles: asset.download_profiles ?? []
      }));

    if (linksToInsert.length > 0) {
      await tx.insert(questAssetLinkLocal).values(linksToInsert);
    }
  });
}

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

  await system.db.transaction(async (tx) => {
    await tx
      .update(assetLocal)
      .set({ project_id: null })
      .where(inArray(assetLocal.id, uniqueAssetIds));

    await tx
      .delete(questAssetLinkLocal)
      .where(
        and(
          eq(questAssetLinkLocal.quest_id, questId),
          inArray(questAssetLinkLocal.asset_id, uniqueAssetIds)
        )
      );
  });

  await enqueueAssetGc(uniqueAssetIds, gcOperation);
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
  const previousIds = operation.previousData.map((item) => item.id);
  await restoreAssetsToQuest(projectId, questId, previousIds);
  await dequeueAssetGc(previousIds);
}

async function undoMerge(
  questId: string,
  projectId: string,
  operation: AssetOperationTypes
): Promise<void> {
  const previousIds = operation.previousData.map((item) => item.id);
  const newIds = operation.newData.map((item) => item.id);

  await restoreAssetsToQuest(projectId, questId, previousIds);
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

  await restoreAssetsToQuest(projectId, questId, previousIds);
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

async function redoCreate(
  projectId: string,
  questId: string,
  operation: AssetOperationTypes
): Promise<void> {
  const newIds = operation.newData.map((item) => item.id);
  await restoreAssetsToQuest(projectId, questId, newIds);
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
  await detachAssetsFromQuest(questId, previousIds, 'delete');
}

async function redoMerge(
  projectId: string,
  questId: string,
  operation: AssetOperationTypes
): Promise<void> {
  const previousIds = operation.previousData.map((item) => item.id);
  const newIds = operation.newData.map((item) => item.id);

  await detachAssetsFromQuest(questId, previousIds, 'merge');
  await restoreAssetsToQuest(projectId, questId, newIds);
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
  await restoreAssetsToQuest(projectId, questId, newIds);
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
    default:
      throw new Error(`Unsupported asset redo action: ${operation.action}`);
  }
}
