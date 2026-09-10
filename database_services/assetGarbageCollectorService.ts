import { system } from '@/db/powersync/system';
import { resolveTable } from '@/utils/dbUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { eq, inArray } from 'drizzle-orm';
import { audioSegmentService } from './audioSegmentService';

const ASSET_GC_QUEUE_KEY = '@asset_gc_queue_v1';

export type AssetGcOperation = 'tombstone' | 'collect' | 'collect-merge';

type AssetGcQueue = Record<string, AssetGcOperation>;

let cachedQueue: AssetGcQueue = {};
const listeners = new Set<() => void>();
let runInFlight: Promise<{ id: string; operation: AssetGcOperation }[]> | null =
  null;

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
  if (__DEV__) {
    console.log(...args);
  }
}

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

function setCachedQueue(queue: AssetGcQueue): void {
  const prevKeys = Object.keys(cachedQueue).join(',');
  const nextKeys = Object.keys(queue).join(',');
  cachedQueue = queue;
  if (prevKeys !== nextKeys) {
    notify();
  }
}

export function subscribeAssetGcQueue(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getCachedQueuedAssetIds(): string[] {
  return Object.keys(cachedQueue);
}

function normalizeOperation(value: unknown): AssetGcOperation {
  if (value === 'collect-merge' || value === 'merge') return 'collect-merge';
  if (value === 'tombstone') return 'tombstone';
  return 'collect';
}

async function readQueue(): Promise<AssetGcQueue> {
  try {
    const raw = await AsyncStorage.getItem(ASSET_GC_QUEUE_KEY);
    if (!raw) {
      setCachedQueue({});
      return {};
    }
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      setCachedQueue({});
      return {};
    }
    const queue: AssetGcQueue = {};
    for (const [id, operation] of Object.entries(parsed)) {
      queue[id] = normalizeOperation(operation);
    }
    setCachedQueue(queue);
    return queue;
  } catch (error) {
    console.error('[AssetGC] Failed to read queue:', error);
    return cachedQueue;
  }
}

async function writeQueue(queue: AssetGcQueue): Promise<void> {
  setCachedQueue(queue);
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
    const existing = queue[id];
    if (existing === 'tombstone' && operation !== 'tombstone') {
      continue;
    }
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

export async function getQueuedAssetIds(): Promise<string[]> {
  return Object.keys(await readQueue());
}

export async function run(): Promise<
  { id: string; operation: AssetGcOperation }[]
> {
  if (runInFlight) return runInFlight;

  runInFlight = (async () => {
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
    const nextQueue: AssetGcQueue = { ...queue };

    for (const entry of entries) {
      if (entry.operation === 'tombstone') {
        continue;
      }

      try {
        const [assetRecord] = await system.db
          .select({ id: assetLocal.id })
          .from(assetLocal)
          .where(eq(assetLocal.id, entry.id))
          .limit(1);

        if (assetRecord) {
          await audioSegmentService.deleteAudioSegment(entry.id, {
            preserveAudioFiles: entry.operation === 'collect-merge'
          });
          devLog(`[AssetGC] Collected asset: ${entry.id}`);
        }

        nextQueue[entry.id] = 'tombstone';
      } catch (error) {
        devLog(`[AssetGC] Failed to process ${entry.id}:`, error);
      }
    }

    await writeQueue(nextQueue);
    return entries;
  })();

  try {
    return await runInFlight;
  } finally {
    runInFlight = null;
  }
}
