/// <reference types="jest" />

import { act, renderHook, waitFor } from '@testing-library/react-native';

const mockGcQueue = {
  cached: [] as string[],
  listeners: new Set<() => void>(),
  fetch(): Promise<string[]> {
    return Promise.resolve([...this.cached]);
  },
  reset() {
    this.cached = [];
    this.listeners.clear();
    this.fetch = () => Promise.resolve([...this.cached]);
  },
  notify() {
    for (const listener of this.listeners) {
      listener();
    }
  }
};

jest.mock('@/database_services/assetGarbageCollectorService', () => ({
  getCachedQueuedAssetIds: () => mockGcQueue.cached,
  getQueuedAssetIds: () => mockGcQueue.fetch(),
  subscribeAssetGcQueue: (listener: () => void) => {
    mockGcQueue.listeners.add(listener);
    return () => {
      mockGcQueue.listeners.delete(listener);
    };
  }
}));

import { useQueuedAssetIdSet } from '../useAssetGcQueue';

describe('useQueuedAssetIdSet', () => {
  beforeEach(() => {
    mockGcQueue.reset();
  });

  it('applies the fetched ids when nothing else has updated the set', async () => {
    mockGcQueue.cached = ['asset-1'];

    const { result } = await renderHook(() => useQueuedAssetIdSet());

    await waitFor(() => {
      expect([...result.current]).toEqual(['asset-1']);
    });
  });

  it('ignores a fetch that resolves after a subscription update', async () => {
    let releaseFetch!: (ids: string[]) => void;
    mockGcQueue.fetch = () =>
      new Promise((resolve) => {
        releaseFetch = resolve;
      });

    const { result } = await renderHook(() => useQueuedAssetIdSet());

    mockGcQueue.cached = ['asset-2'];
    await act(() => {
      mockGcQueue.notify();
    });

    await waitFor(() => {
      expect([...result.current]).toEqual(['asset-2']);
    });

    releaseFetch(['asset-1']);

    await waitFor(() => {
      expect([...result.current]).toEqual(['asset-2']);
    });
  });

  it('ignores a fetch and a subscription after unmount', async () => {
    let releaseFetch!: (ids: string[]) => void;
    mockGcQueue.fetch = () =>
      new Promise((resolve) => {
        releaseFetch = resolve;
      });

    const { unmount } = await renderHook(() => useQueuedAssetIdSet());
    await unmount();

    releaseFetch(['asset-1']);
    mockGcQueue.cached = ['asset-2'];
    mockGcQueue.notify();
    await Promise.resolve();

    expect(mockGcQueue.listeners.size).toBe(0);
  });
});
