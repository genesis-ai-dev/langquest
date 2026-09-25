/// <reference types="jest" />

import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@/db/powersync/system', () => ({
  system: {
    db: {
      select: jest.fn()
    },
    powersync: {
      getAll: jest.fn(async () => [{ id: 1 }])
    }
  }
}));

jest.mock('@/utils/dbUtils', () => ({
  resolveTable: () => ({ id: 'id', name: 'name' })
}));

jest.mock('../audioSegmentService', () => ({
  audioSegmentService: {
    deleteAudioSegment: jest.fn(async () => undefined)
  }
}));

import { system } from '@/db/powersync/system';
import { audioSegmentService } from '../audioSegmentService';
import {
  dequeue,
  enqueue,
  getCachedQueuedAssetIds,
  getQueuedAssetIds,
  pruneUploadedTombstones,
  run,
  subscribeAssetGcQueue
} from '../assetGarbageCollectorService';

const deleteAudioSegment =
  audioSegmentService.deleteAudioSegment as jest.MockedFunction<
    typeof audioSegmentService.deleteAudioSegment
  >;

const ASSET_GC_QUEUE_KEY = '@asset_gc_queue_v1';

function thenableRows(rows: unknown[]) {
  const query = {
    from() {
      return query;
    },
    where() {
      return query;
    },
    limit() {
      return Promise.resolve(rows);
    },
    then(
      onFulfilled?: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) {
      return Promise.resolve(rows).then(onFulfilled, onRejected);
    }
  };
  return query;
}

async function resetQueue() {
  const ids = await getQueuedAssetIds();
  await dequeue(ids);
  await AsyncStorage.removeItem(ASSET_GC_QUEUE_KEY);
  await getQueuedAssetIds();
}

async function waitUntil(predicate: () => boolean) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > 1000) {
      throw new Error('timed out waiting for collector');
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

async function storedQueue(): Promise<Record<string, string>> {
  const raw = await AsyncStorage.getItem(ASSET_GC_QUEUE_KEY);
  return raw ? (JSON.parse(raw) as Record<string, string>) : {};
}

describe('assetGarbageCollectorService', () => {
  beforeEach(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    deleteAudioSegment.mockReset();
    deleteAudioSegment.mockResolvedValue(undefined);
    (system.db.select as jest.Mock).mockReset();
    (system.db.select as jest.Mock).mockImplementation(() => thenableRows([]));
    (system.powersync.getAll as jest.Mock).mockReset();
    (system.powersync.getAll as jest.Mock).mockResolvedValue([{ id: 1 }]);
    await resetQueue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('normalizeOperation maps merge aliases when reading storage', async () => {
    await AsyncStorage.setItem(
      ASSET_GC_QUEUE_KEY,
      JSON.stringify({
        a: 'merge',
        b: 'tombstone',
        c: 'nope'
      })
    );

    const ids = await getQueuedAssetIds();
    expect(ids.sort()).toEqual(['a', 'b', 'c']);

    const result = await run();
    expect(result).toEqual(
      expect.arrayContaining([
        { id: 'a', operation: 'collect-merge' },
        { id: 'b', operation: 'tombstone' },
        { id: 'c', operation: 'collect' }
      ])
    );
  });

  it('enqueue tombstone blocks a later collect downgrade', async () => {
    await enqueue(['asset-1'], 'tombstone');
    await enqueue(['asset-1'], 'collect');
    await enqueue(['asset-2'], 'collect');

    expect(await getQueuedAssetIds()).toEqual(
      expect.arrayContaining(['asset-1', 'asset-2'])
    );

    (system.db.select as jest.Mock).mockImplementation(() =>
      thenableRows([{ id: 'asset-2', name: 'Take' }])
    );
    await run();
    expect(deleteAudioSegment).toHaveBeenCalledWith('asset-2', {
      preserveAudioFiles: false
    });
    expect(deleteAudioSegment).not.toHaveBeenCalledWith(
      'asset-1',
      expect.anything()
    );
  });

  it('dequeue removes ids and notifies listeners', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeAssetGcQueue(listener);
    await enqueue(['asset-1', 'asset-1'], 'collect');
    expect(getCachedQueuedAssetIds()).toEqual(['asset-1']);
    expect(listener).toHaveBeenCalled();

    listener.mockClear();
    await dequeue(['asset-1']);
    expect(await getQueuedAssetIds()).toEqual([]);
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });

  it('treats invalid stored JSON as an empty queue', async () => {
    await AsyncStorage.setItem(ASSET_GC_QUEUE_KEY, '["not-an-object"]');
    expect(await getQueuedAssetIds()).toEqual([]);
  });

  it('keeps an id enqueued during an in-flight run and collects it', async () => {
    await enqueue(['asset-1'], 'collect');

    let release!: (value: unknown[]) => void;
    const delayed = new Promise<unknown[]>((resolve) => {
      release = resolve;
    });
    (system.db.select as jest.Mock).mockImplementation(() => ({
      from() {
        return this;
      },
      where() {
        return this;
      },
      limit() {
        return delayed;
      },
      then(
        onFulfilled?: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) {
        return delayed.then(onFulfilled, onRejected);
      }
    }));

    const running = run();
    const enqueued = enqueue(['asset-2'], 'collect');
    await waitUntil(
      () => (system.db.select as jest.Mock).mock.calls.length > 0
    );
    expect(await storedQueue()).not.toHaveProperty('asset-2');
    (system.db.select as jest.Mock).mockImplementation(() =>
      thenableRows([{ id: 'asset-2', name: 'Take' }])
    );
    release([{ id: 'asset-1', name: 'First' }]);
    await enqueued;
    await running;

    expect(deleteAudioSegment).toHaveBeenCalledWith('asset-1', {
      preserveAudioFiles: false
    });
    expect(deleteAudioSegment).toHaveBeenCalledWith('asset-2', {
      preserveAudioFiles: false
    });
  });

  it('coalesces concurrent run calls', async () => {
    await enqueue(['asset-1'], 'collect');

    let release!: (value: unknown[]) => void;
    const delayed = new Promise<unknown[]>((resolve) => {
      release = resolve;
    });
    (system.db.select as jest.Mock).mockImplementation(() => ({
      from() {
        return this;
      },
      where() {
        return this;
      },
      limit() {
        return delayed;
      },
      then(
        onFulfilled?: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) {
        return delayed.then(onFulfilled, onRejected);
      }
    }));

    const first = run();
    const second = run();
    release([]);
    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult).toEqual([{ id: 'asset-1', operation: 'collect' }]);
    expect(secondResult).toEqual(firstResult);
    // One name-map select + one per-asset select from a single run().
    expect(system.db.select).toHaveBeenCalledTimes(2);
  });

  it('is a no-op for empty enqueue and dequeue', async () => {
    await enqueue([], 'collect');
    await dequeue([]);
    expect(await getQueuedAssetIds()).toEqual([]);
  });

  it('keeps both ids when enqueues overlap', async () => {
    await Promise.all([
      enqueue(['asset-1'], 'collect'),
      enqueue(['asset-2'], 'collect-merge')
    ]);

    expect(await storedQueue()).toEqual({
      'asset-1': 'collect',
      'asset-2': 'collect-merge'
    });
  });

  it('skips a delete when the id was dequeued before the pass', async () => {
    await enqueue(['asset-1'], 'collect');
    await dequeue(['asset-1']);
    (system.db.select as jest.Mock).mockImplementation(() =>
      thenableRows([{ id: 'asset-1', name: 'Take' }])
    );

    await run();

    expect(deleteAudioSegment).not.toHaveBeenCalled();
  });

  it('holds the lock across a delete so dequeue cannot restore underneath it', async () => {
    await enqueue(['asset-1'], 'collect');
    (system.db.select as jest.Mock).mockImplementation(() =>
      thenableRows([{ id: 'asset-1', name: 'Take' }])
    );
    let releaseDelete!: () => void;
    deleteAudioSegment.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseDelete = resolve;
        })
    );

    const running = run();
    await waitUntil(() => deleteAudioSegment.mock.calls.length > 0);

    let dequeued = false;
    const removed = dequeue(['asset-1']).then(() => {
      dequeued = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(dequeued).toBe(false);

    releaseDelete();
    await running;
    await removed;

    expect(deleteAudioSegment).toHaveBeenCalledTimes(1);
    expect(await getQueuedAssetIds()).toEqual([]);
  });

  it('passes preserveAudioFiles for a merge collect', async () => {
    await enqueue(['asset-1'], 'collect-merge');
    (system.db.select as jest.Mock).mockImplementation(() =>
      thenableRows([{ id: 'asset-1', name: 'Take' }])
    );

    await run();

    expect(deleteAudioSegment).toHaveBeenCalledWith('asset-1', {
      preserveAudioFiles: true
    });
  });

  it('logs a failed collect and leaves the id queued', async () => {
    await enqueue(['asset-1'], 'collect');
    (system.db.select as jest.Mock).mockImplementation(() =>
      thenableRows([{ id: 'asset-1', name: 'Take' }])
    );
    deleteAudioSegment.mockRejectedValue(new Error('disk'));

    await run();

    expect(console.error).toHaveBeenCalledWith(
      '[AssetGC] Failed to collect asset-1:',
      expect.any(Error)
    );
    expect(console.error).toHaveBeenCalledWith(
      '[AssetGC] Collect passes exhausted; ids still queued:',
      'asset-1'
    );
    expect(await storedQueue()).toEqual({ 'asset-1': 'collect' });
  });

  it('drops tombstones once the upload queue is empty', async () => {
    await enqueue(['asset-1'], 'tombstone');
    await enqueue(['asset-2'], 'collect');
    (system.powersync.getAll as jest.Mock).mockResolvedValue([]);

    await pruneUploadedTombstones();

    expect(await storedQueue()).toEqual({ 'asset-2': 'collect' });
  });

  it('keeps tombstones while an upload is still pending', async () => {
    await enqueue(['asset-1'], 'tombstone');
    (system.powersync.getAll as jest.Mock).mockResolvedValue([{ id: 9 }]);

    await pruneUploadedTombstones();

    expect(await storedQueue()).toEqual({ 'asset-1': 'tombstone' });
  });

  it('keeps tombstones when the upload queue cannot be read', async () => {
    await enqueue(['asset-1'], 'tombstone');
    (system.powersync.getAll as jest.Mock).mockRejectedValue(
      new Error('not ready')
    );

    await pruneUploadedTombstones();

    expect(await storedQueue()).toEqual({ 'asset-1': 'tombstone' });
    expect(console.error).toHaveBeenCalledWith(
      '[AssetGC] Failed to read upload queue:',
      expect.any(Error)
    );
  });

  it('prunes tombstones at the end of a collect when uploads have landed', async () => {
    await enqueue(['asset-1'], 'collect');
    (system.db.select as jest.Mock).mockImplementation(() =>
      thenableRows([{ id: 'asset-1', name: 'Take' }])
    );
    (system.powersync.getAll as jest.Mock).mockResolvedValue([]);

    await run();

    expect(await getQueuedAssetIds()).toEqual([]);
  });
});
