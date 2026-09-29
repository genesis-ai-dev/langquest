/// <reference types="jest" />

import { enqueueAssetWrite, whenAssetWritesIdle } from '../assetWriteQueue';

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('assetWriteQueue', () => {
  it('runs work immediately when questId is missing', async () => {
    const result = await enqueueAssetWrite(undefined, async () => 7);
    expect(result).toBe(7);
    await expect(whenAssetWritesIdle(undefined)).resolves.toBeUndefined();
  });

  it('serializes two tasks for the same quest', async () => {
    const firstStarted = deferred<void>();
    const first = deferred<void>();
    const order: string[] = [];

    const firstRun = enqueueAssetWrite('quest-a', async () => {
      order.push('first-start');
      firstStarted.resolve();
      await first.promise;
      order.push('first-end');
      return 'first';
    });
    const secondRun = enqueueAssetWrite('quest-a', async () => {
      order.push('second');
      return 'second';
    });

    await firstStarted.promise;
    expect(order).toEqual(['first-start']);
    first.resolve();
    await expect(firstRun).resolves.toBe('first');
    await expect(secondRun).resolves.toBe('second');
    expect(order).toEqual(['first-start', 'first-end', 'second']);
  });

  it('lets a later task run after an earlier failure', async () => {
    await expect(
      enqueueAssetWrite('quest-fail', async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');

    await expect(
      enqueueAssetWrite('quest-fail', async () => 'ok')
    ).resolves.toBe('ok');
  });

  it('runs different quest ids in parallel', async () => {
    const gate = deferred<void>();
    let bStarted = false;

    const a = enqueueAssetWrite('quest-parallel-a', async () => {
      await gate.promise;
      return 'a';
    });
    const b = enqueueAssetWrite('quest-parallel-b', async () => {
      bStarted = true;
      return 'b';
    });

    await expect(b).resolves.toBe('b');
    expect(bStarted).toBe(true);
    gate.resolve();
    await expect(a).resolves.toBe('a');
  });

  it('whenAssetWritesIdle waits for the queued chain', async () => {
    const gate = deferred<void>();
    void enqueueAssetWrite('quest-idle', async () => {
      await gate.promise;
    });

    let idle = false;
    const idlePromise = whenAssetWritesIdle('quest-idle').then(() => {
      idle = true;
    });
    expect(idle).toBe(false);
    gate.resolve();
    await idlePromise;
    expect(idle).toBe(true);
  });

  it('whenAssetWritesIdle resolves immediately when nothing is queued', async () => {
    await expect(whenAssetWritesIdle('never-used')).resolves.toBeUndefined();
  });
});
