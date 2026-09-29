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

const MAX_COLLECT_PASSES = 5;

// Serializes enqueue, dequeue, collect, and tombstone pruning. A collect
// holds the lock across the delete so undo cannot restore rows underneath it.
let tail: Promise<void> = Promise.resolve();

function withLock<T>(work: () => Promise<T>): Promise<T> {
  const result = tail.then(work, work);
  tail = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

async function flushLock(): Promise<void> {
  await tail;
}

export async function enqueue(
  ids: string[],
  operation: AssetGcOperation
): Promise<void> {
  if (ids.length === 0) return;

  await withLock(async () => {
    const queue = { ...(await readQueue()) };
    for (const id of Array.from(new Set(ids))) {
      const existing = queue[id];
      if (existing === 'tombstone' && operation !== 'tombstone') {
        continue;
      }
      queue[id] = operation;
    }
    await writeQueue(queue);
  });
}

export async function dequeue(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  await withLock(async () => {
    const queue = { ...(await readQueue()) };
    for (const id of Array.from(new Set(ids))) {
      delete queue[id];
    }
    await writeQueue(queue);
  });
}

export async function getQueuedAssetIds(): Promise<string[]> {
  return Object.keys(await readQueue());
}

function hasPendingCollect(queue: AssetGcQueue): boolean {
  return Object.values(queue).some((operation) => operation !== 'tombstone');
}

async function uploadQueueIsEmpty(): Promise<boolean> {
  try {
    const rows = await system.powersync.getAll<{ id: number }>(
      'SELECT 1 AS id FROM ps_crud LIMIT 1'
    );
    return rows.length === 0;
  } catch (error) {
    console.error('[AssetGC] Failed to read upload queue:', error);
    return false;
  }
}

// Drop tombstones only after every local upload has landed. Until ps_crud
// is empty, a checkpoint can still restore a quest link and verse-normalize
// would PATCH it back.
async function pruneUploadedTombstonesLocked(): Promise<void> {
  const queue = await readQueue();
  const tombstoneIds = Object.entries(queue)
    .filter(([, operation]) => operation === 'tombstone')
    .map(([id]) => id);
  if (tombstoneIds.length === 0) return;
  if (!(await uploadQueueIsEmpty())) return;

  for (const id of tombstoneIds) {
    delete queue[id];
  }
  await writeQueue(queue);
  devLog('[AssetGC] Pruned uploaded tombstones:', tombstoneIds);
}

export async function pruneUploadedTombstones(): Promise<void> {
  await withLock(pruneUploadedTombstonesLocked);
}

async function runOnce(): Promise<
  { id: string; operation: AssetGcOperation }[]
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
  const processedIds = new Set<string>();

  for (const entry of entries) {
    if (entry.operation === 'tombstone') {
      continue;
    }

    // Undo may have dequeued this id before the lock was taken.
    const current = (await readQueue())[entry.id];
    if (current !== entry.operation) {
      continue;
    }

    try {
      const [assetRecord] = await system.db
        .select({ id: assetLocal.id })
        .from(assetLocal)
        .where(eq(assetLocal.id, entry.id))
        .limit(1);

      if (assetRecord) {
        // Local audio files are never removed. collect-merge still asks to
        // preserve them so a future file-deletion path can spare merge
        // sources. Server objects survive a merge because the new rows
        // still reference them.
        await audioSegmentService.deleteAudioSegment(entry.id, {
          preserveAudioFiles: entry.operation === 'collect-merge'
        });
        devLog(`[AssetGC] Collected asset: ${entry.id}`);
      }

      processedIds.add(entry.id);
    } catch (error) {
      console.error(`[AssetGC] Failed to collect ${entry.id}:`, error);
    }
  }

  // Re-read so a storage write made during the delete is kept. An id
  // removed before this lock was taken was already skipped above.
  const latest = await readQueue();
  const merged: AssetGcQueue = { ...latest };
  for (const id of processedIds) {
    if (id in merged) {
      merged[id] = 'tombstone';
    }
  }
  await writeQueue(merged);
  return entries;
}

export async function run(): Promise<
  { id: string; operation: AssetGcOperation }[]
> {
  if (runInFlight) return runInFlight;

  runInFlight = (async () => {
    let lastEntries: { id: string; operation: AssetGcOperation }[] = [];
    // A caller may enqueue while a pass holds the lock. Flush that waiter
    // and collect it on the next pass of this same leave-screen run.
    for (let pass = 0; pass < MAX_COLLECT_PASSES; pass++) {
      lastEntries = await withLock(runOnce);
      await flushLock();
      const stillPending = await withLock(async () =>
        hasPendingCollect(await readQueue())
      );
      if (!stillPending) {
        await pruneUploadedTombstones();
        return lastEntries;
      }
    }

    const remaining = await withLock(async () => {
      const queue = await readQueue();
      return Object.entries(queue)
        .filter(([, operation]) => operation !== 'tombstone')
        .map(([id]) => id);
    });
    console.error(
      '[AssetGC] Collect passes exhausted; ids still queued:',
      remaining.join(', ')
    );
    await pruneUploadedTombstones();
    return lastEntries;
  })();

  try {
    return await runInFlight;
  } finally {
    runInFlight = null;
  }
}
