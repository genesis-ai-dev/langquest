import { system } from '@/db/powersync/system';
import { resolveTable } from '@/utils/dbUtils';
import { and, eq, inArray } from 'drizzle-orm';
import uuid from 'react-native-uuid';
import type { AssetOperationTypes } from './types';
import { dequeue as dequeueAssetGc } from './assetGarbageCollectorService';
import { renameAsset } from './assetService';
import { audioSegmentService } from './audioSegmentService';

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

    const existingAssetIds = new Set(existingLinks.map((link) => link.asset_id));

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

async function deleteAssetsPhysically(
  assetIds: string[],
  options?: { preserveAudioFiles?: boolean }
): Promise<void> {
  if (assetIds.length === 0) return;
  for (const id of Array.from(new Set(assetIds))) {
    await audioSegmentService.deleteAudioSegment(id, options);
  }
}

async function undoCreate(operation: AssetOperationTypes): Promise<void> {
  const newIds = operation.newData.map((item) => item.id);
  await deleteAssetsPhysically(newIds);
}

async function undoRename(operation: AssetOperationTypes): Promise<void> {
  for (const previous of operation.previousData) {
    if (!previous.name) continue;
    await renameAsset(previous.id, previous.name);
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
  projectId: string,
  questId: string,
  operation: AssetOperationTypes
): Promise<void> {
  const previousIds = operation.previousData.map((item) => item.id);
  const newIds = operation.newData.map((item) => item.id);

  await restoreAssetsToQuest(projectId, questId, previousIds);
  await dequeueAssetGc(previousIds);
  // IMPORTANT: keep audio files, since previous records still use them.
  await deleteAssetsPhysically(newIds, { preserveAudioFiles: true });
}

async function undoReplace(
  projectId: string,
  questId: string,
  operation: AssetOperationTypes
): Promise<void> {
  const previousIds = operation.previousData.map((item) => item.id);
  const newIds = operation.newData.map((item) => item.id);

  await restoreAssetsToQuest(projectId, questId, previousIds);
  await dequeueAssetGc(previousIds);
  await deleteAssetsPhysically(newIds);
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
      await undoCreate(operation);
      return;
    case 'rename':
      await undoRename(operation);
      return;
    case 'delete':
      await undoDelete(projectId, questId, operation);
      return;
    case 'merge':
      await undoMerge(projectId, questId, operation);
      return;
    case 'replace':
      await undoReplace(projectId, questId, operation);
      return;
    default:
      throw new Error(`Unsupported asset undo action: ${operation.action}`);
  }
}
