import { system } from '@/db/powersync/system';
import { resolveTable } from '@/utils/dbUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { inArray } from 'drizzle-orm';

const ASSET_GC_QUEUE_KEY = '@asset_gc_queue_v1';

export type AssetGcOperation = 'merge' | 'delete';

type AssetGcQueue = Record<string, AssetGcOperation>;

/* FUNCTION TO BE REMOVED */
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

  console.log('[AssetGC] Current queue entries:', entriesWithName);
  return entries;
}
