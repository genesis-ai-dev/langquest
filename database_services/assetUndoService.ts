import { system } from '@/db/powersync/system';
import { resolveTable } from '@/utils/dbUtils';
import { and, eq, inArray } from 'drizzle-orm';
import uuid from 'react-native-uuid';
import type { AssetGcOperation } from './assetGarbageCollectorService';
import {
  dequeue as dequeueAssetGc,
  enqueue as enqueueAssetGc
} from './assetGarbageCollectorService';
import {
  batchUpdateAssetVerseDirect,
  renameAssetDirect,
  softDeleteAssetsFromQuestDirect
} from './assetService';
import { enqueueAssetWrite } from './assetWriteQueue';
import { audioSegmentService } from './audioSegmentService';
import type { AssetOperationDataItem, AssetOperationTypes } from './types';

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
 * - Created / local assets: restore project_id if an older client nulled it
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

  await insertCreatedAssetsFromSnapshot(questId, uniqueItems);

  const assetLocal = resolveTable('asset', { localOverride: true });
  const questAssetLinkLocal = resolveTable('quest_asset_link', {
    localOverride: true
  });

  await system.db.transaction(async (tx) => {
    const localAssets = await tx
      .select({
        id: assetLocal.id,
        project_id: assetLocal.project_id,
        download_profiles: assetLocal.download_profiles
      })
      .from(assetLocal)
      .where(inArray(assetLocal.id, uniqueAssetIds));

    const localAssetMap = new Map(
      localAssets.map((asset) => [asset.id, asset])
    );

    const createdOrLocalIds = uniqueItems
      .filter((item) => isCreatedItem(item) || localAssetMap.has(item.id))
      .map((item) => item.id)
      .filter((id) => localAssetMap.get(id)?.project_id !== projectId);

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
      .filter(
        (item) => !existingAssetIds.has(item.id) && localAssetMap.has(item.id)
      )
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

function toAssetRowMetadata(
  item: AssetOperationDataItem,
  questId: string
): string {
  const { provenance: _provenance, ...rest } = item.metadata ?? {};
  return JSON.stringify({
    ...rest,
    origin: { questId }
  });
}

async function insertCreatedAssetsFromSnapshot(
  questId: string,
  items: AssetOperationDataItem[]
): Promise<void> {
  const itemsWithRows = items.filter(
    (item) => (item.contents?.length ?? 0) > 0
  );
  if (itemsWithRows.length === 0) return;

  const assetLocal = resolveTable('asset', { localOverride: true });
  const contentLocal = resolveTable('asset_content_link', {
    localOverride: true
  });
  const uniqueAssetIds = itemsWithRows.map((item) => item.id);

  await system.db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: assetLocal.id })
      .from(assetLocal)
      .where(inArray(assetLocal.id, uniqueAssetIds));
    const existingIds = new Set(existing.map((row) => row.id));

    const existingContent = await tx
      .select({ asset_id: contentLocal.asset_id })
      .from(contentLocal)
      .where(inArray(contentLocal.asset_id, uniqueAssetIds));
    const assetsWithContent = new Set(
      existingContent.map((row) => row.asset_id)
    );

    for (const item of itemsWithRows) {
      if (!existingIds.has(item.id)) {
        await tx.insert(assetLocal).values({
          id: item.id,
          name: item.name ?? null,
          order_index: item.order_index ?? 0,
          source_language_id: item.source_language_id ?? null,
          project_id: item.project_id ?? null,
          creator_id: item.creator_id ?? null,
          download_profiles: item.download_profiles ?? [],
          metadata: toAssetRowMetadata(item, questId)
        });
      }

      if (assetsWithContent.has(item.id)) continue;

      for (const content of item.contents ?? []) {
        await tx.insert(contentLocal).values({
          ...(content.id ? { id: content.id } : {}),
          asset_id: item.id,
          source_language_id:
            content.source_language_id ?? item.source_language_id ?? null,
          languoid_id:
            content.languoid_id ??
            content.source_language_id ??
            item.source_language_id ??
            null,
          text: content.text ?? item.name ?? '',
          audio: content.audio ?? [],
          download_profiles:
            content.download_profiles ?? item.download_profiles ?? [],
          order_index: content.order_index ?? 1
        });
      }
    }
  });
}

async function rematerializeCreatedAssetsFromSnapshot(
  projectId: string,
  questId: string,
  items: AssetOperationDataItem[]
): Promise<void> {
  const withSnapshot = items.filter((item) => (item.contents?.length ?? 0) > 0);
  if (withSnapshot.length === 0) {
    await restoreAssetsToQuest(projectId, questId, items);
    return;
  }

  const assetLocal = resolveTable('asset', { localOverride: true });
  const contentLocal = resolveTable('asset_content_link', {
    localOverride: true
  });
  const questAssetLinkLocal = resolveTable('quest_asset_link', {
    localOverride: true
  });
  const assetIds = withSnapshot.map((item) => item.id);

  // One transaction so a checkpoint cannot restore the old content-link id
  // between delete and insert. Reuse snapshot ids so redo PUTs the same rows
  // the original create uploaded.
  await system.db.transaction(async (tx) => {
    await tx
      .delete(questAssetLinkLocal)
      .where(
        and(
          eq(questAssetLinkLocal.quest_id, questId),
          inArray(questAssetLinkLocal.asset_id, assetIds)
        )
      );
    await tx
      .delete(contentLocal)
      .where(inArray(contentLocal.asset_id, assetIds));
    await tx.delete(assetLocal).where(inArray(assetLocal.id, assetIds));

    for (const item of withSnapshot) {
      await tx.insert(assetLocal).values({
        id: item.id,
        name: item.name ?? null,
        order_index: item.order_index ?? 0,
        source_language_id: item.source_language_id ?? null,
        project_id: item.project_id ?? projectId,
        creator_id: item.creator_id ?? null,
        download_profiles: item.download_profiles ?? [],
        metadata: toAssetRowMetadata(item, questId)
      });

      for (const content of item.contents ?? []) {
        await tx.insert(contentLocal).values({
          ...(content.id ? { id: content.id } : {}),
          asset_id: item.id,
          source_language_id:
            content.source_language_id ?? item.source_language_id ?? null,
          languoid_id:
            content.languoid_id ??
            content.source_language_id ??
            item.source_language_id ??
            null,
          text: content.text ?? item.name ?? '',
          audio: content.audio ?? [],
          download_profiles:
            content.download_profiles ?? item.download_profiles ?? [],
          order_index: content.order_index ?? 1
        });
      }

      await tx.insert(questAssetLinkLocal).values({
        ...(item.link_id ? { id: item.link_id } : { id: String(uuid.v4()) }),
        quest_id: questId,
        asset_id: item.id,
        name: item.name ?? null,
        order_index: item.order_index ?? 0,
        metadata: serializeLinkMetadata(item.metadata),
        download_profiles: item.download_profiles ?? []
      });
    }
  });
}

/**
 * Detach assets from a quest (provenance-aware).
 * - Deletes quest_asset_link for the quest
 * - Enqueues GC only for created assets; GC deletes the asset row so the
 *   removal syncs to Postgres. Redo dequeues before restoring the link.
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
  _questId: string,
  operation: AssetOperationTypes
): Promise<void> {
  const newIds = operation.newData.map((item) => item.id);
  // Hard-delete immediately so PowerSync uploads DELETE before a checkpoint
  // can resurrect the PUT. Keep IDs queued so exit-time verse normalize
  // will not PATCH a checkpoint-restored quest_asset_link back onto the
  // server.
  for (const id of newIds) {
    await audioSegmentService.deleteAudioSegment(id);
  }
  await enqueueAssetGc(newIds, 'tombstone');
}

async function undoRename(
  questId: string,
  operation: AssetOperationTypes
): Promise<void> {
  for (const previous of operation.previousData) {
    if (!previous.name) continue;
    await renameAssetDirect(questId, previous.id, previous.name);
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
  await detachAssetsFromQuest(questId, newIds, 'collect-merge');
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
  for (const id of newIds) {
    await audioSegmentService.deleteAudioSegment(id);
  }
  await enqueueAssetGc(newIds, 'tombstone');
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
  await batchUpdateAssetVerseDirect(questId, updates);
}

async function undoImport(
  questId: string,
  operation: AssetOperationTypes
): Promise<void> {
  const importedIds = operation.newData.map((item) => item.id);
  await softDeleteAssetsFromQuestDirect(questId, importedIds);
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
  await rematerializeCreatedAssetsFromSnapshot(
    projectId,
    questId,
    operation.newData
  );
  await dequeueAssetGc(newIds);
}

async function redoRename(
  questId: string,
  operation: AssetOperationTypes
): Promise<void> {
  for (const next of operation.newData) {
    if (!next.name) continue;
    await renameAssetDirect(questId, next.id, next.name);
  }
}

async function redoDelete(
  questId: string,
  operation: AssetOperationTypes
): Promise<void> {
  const previousIds = operation.previousData.map((item) => item.id);
  await softDeleteAssetsFromQuestDirect(questId, previousIds);
}

async function redoMerge(
  projectId: string,
  questId: string,
  operation: AssetOperationTypes
): Promise<void> {
  const previousIds = operation.previousData.map((item) => item.id);
  const newIds = operation.newData.map((item) => item.id);

  await detachAssetsFromQuest(questId, previousIds, 'collect-merge');
  await rematerializeCreatedAssetsFromSnapshot(
    projectId,
    questId,
    operation.newData
  );
  await dequeueAssetGc(newIds);
}

async function redoReplace(
  projectId: string,
  questId: string,
  operation: AssetOperationTypes
): Promise<void> {
  const previousIds = operation.previousData.map((item) => item.id);
  const newIds = operation.newData.map((item) => item.id);

  await detachAssetsFromQuest(questId, previousIds, 'collect');
  await rematerializeCreatedAssetsFromSnapshot(
    projectId,
    questId,
    operation.newData
  );
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
  await batchUpdateAssetVerseDirect(questId, updates);
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
  return enqueueAssetWrite(questId, () =>
    undoInternal(projectId, questId, operation)
  );
}

async function undoInternal(
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
  return enqueueAssetWrite(questId, () =>
    redoInternal(projectId, questId, operation)
  );
}

async function redoInternal(
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
