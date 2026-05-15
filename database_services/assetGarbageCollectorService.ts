import { system } from '@/db/powersync/system';
import { resolveTable } from '@/utils/dbUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { and, eq, inArray } from 'drizzle-orm';
import { audioSegmentService } from './audioSegmentService';

const ASSET_GC_QUEUE_KEY = '@asset_gc_queue_v1';

export type AssetGcOperation = 'merge' | 'delete';

type AssetGcQueue = Record<string, AssetGcOperation>;

async function getAssetNameMap(
  ids: string[]
): Promise<Record<string, string | null>> {
  const uniqueIds = Array.from(new Set(ids));
  if (uniqueIds.length === 0) return {};

  const localAssetTable = resolveTable('asset', { localOverride: true });
  const localAssets = await system.db
    .select({ id: localAssetTable.id, name: localAssetTable.name })
    .from(localAssetTable)
    .where(inArray(localAssetTable.id, uniqueIds));

  return localAssets.reduce<Record<string, string | null>>((acc, asset) => {
    acc[asset.id] = asset.name;
    return acc;
  }, {});
}

function devLog(...args: unknown[]): void {
  // eslint-disable-next-line no-undef
  if (__DEV__) {
    console.log(...args);
  }
}

async function readQueue(): Promise<AssetGcQueue> {
  try {
    const raw = await AsyncStorage.getItem(ASSET_GC_QUEUE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as AssetGcQueue;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch (error) {
    console.error('[AssetGC] Failed to read queue:', error);
    return {};
  }
}

async function writeQueue(queue: AssetGcQueue): Promise<void> {
  try {
    await AsyncStorage.setItem(ASSET_GC_QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error('[AssetGC] Failed to write queue:', error);
  }
}

export async function enqueue(
  ids: string[],
  operation: AssetGcOperation
): Promise<void> {
  if (ids.length === 0) return;

  const queue = await readQueue();
  for (const id of Array.from(new Set(ids))) {
    queue[id] = operation;
  }
  await writeQueue(queue);
}

export async function dequeue(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  const queue = await readQueue();
  for (const id of Array.from(new Set(ids))) {
    delete queue[id];
  }
  await writeQueue(queue);
}

export async function run(): Promise<
  Array<{ id: string; operation: AssetGcOperation }>
> {
  const queue = await readQueue();
  const entries = Object.entries(queue).map(([id, operation]) => ({
    id,
    operation
  }));

  const nameMap = await getAssetNameMap(entries.map((entry) => entry.id));
  const entriesWithName = entries.map((entry) => ({
    ...entry,
    name: nameMap[entry.id] ?? null
  }));

  devLog('[AssetGC] Current queue entries:', entriesWithName);

  if (entries.length === 0) {
    return [];
  }

  const assetLocal = resolveTable('asset', { localOverride: true });
  const questAssetLinkLocal = resolveTable('quest_asset_link', {
    localOverride: true
  });
  const processedIds = new Set<string>();

  for (const entry of entries) {
    try {
      const [assetRecord] = await system.db
        .select({
          id: assetLocal.id,
          project_id: assetLocal.project_id
        })
        .from(assetLocal)
        .where(eq(assetLocal.id, entry.id))
        .limit(1);

      // If asset no longer exists, consider it already collected.
      if (!assetRecord) {
        devLog(`[AssetGC] Asset not found, removing from queue: ${entry.id}`);
        processedIds.add(entry.id);
        continue;
      }

      const hasProjectLink = !!assetRecord.project_id;
      const [questLink] = await system.db
        .select({ id: questAssetLinkLocal.id })
        .from(questAssetLinkLocal)
        .where(eq(questAssetLinkLocal.asset_id, entry.id))
        .limit(1);
      const hasQuestLink = !!questLink;

      // Abort deletion if still connected to quest/project.
      if (hasProjectLink || hasQuestLink) {
        devLog(
          `[AssetGC] Skipping connected asset ${entry.id} | hasProjectLink=${hasProjectLink} hasQuestLink=${hasQuestLink}`
        );
        continue;
      }

      if (entry.operation === 'delete') {
        await audioSegmentService.deleteAudioSegment(entry.id);
        devLog(`[AssetGC] Deleted asset + files: ${entry.id}`);
      } else if (entry.operation === 'merge') {
        await audioSegmentService.deleteAudioSegment(entry.id, {
          preserveAudioFiles: true
        });
        devLog(`[AssetGC] Deleted merged asset records only: ${entry.id}`);
      }

      processedIds.add(entry.id);
    } catch (error) {
      devLog(`[AssetGC] Failed to process ${entry.id}:`, error);
    }
  }

  if (processedIds.size > 0) {
    const nextQueue: AssetGcQueue = { ...queue };
    for (const id of processedIds) {
      delete nextQueue[id];
    }
    await writeQueue(nextQueue);
    devLog(
      `[AssetGC] Removed ${processedIds.size} processed item(s) from queue`
    );
  }

  return entries;
}
