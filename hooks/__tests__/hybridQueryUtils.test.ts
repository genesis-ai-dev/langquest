/// <reference types="jest" />

import {
    inferOfflineSource,
    mergeLocalFirst,
    splitHybridQueryKey,
    tagCloud,
    tagOffline,
    toHybridPage
} from '../hybridQueryUtils';

describe('inferOfflineSource', () => {
  it('keeps an explicit source and otherwise infers from published_at', () => {
    expect(inferOfflineSource({ source: 'local', published_at: 'now' })).toBe(
      'local'
    );
    expect(inferOfflineSource({ published_at: undefined })).toBe('synced');
    expect(inferOfflineSource({ published_at: null })).toBe('local');
    expect(inferOfflineSource({ published_at: '2026-01-01' })).toBe('synced');
  });
});

describe('splitHybridQueryKey', () => {
  it('splits a data type off the rest of the key', () => {
    expect(splitHybridQueryKey(['assets', 'p1', true])).toEqual({
      dataType: 'assets',
      rest: ['p1', true]
    });
  });

  it('throws when queryKey[0] is missing or empty', () => {
    expect(() => splitHybridQueryKey([])).toThrow(
      'useHybridQuery queryKey[0] must be a non-empty string'
    );
    expect(() => splitHybridQueryKey([''])).toThrow(
      'useHybridQuery queryKey[0] must be a non-empty string'
    );
    expect(() => splitHybridQueryKey([1])).toThrow(
      'useHybridQuery queryKey[0] must be a non-empty string'
    );
  });
});

describe('mergeLocalFirst', () => {
  it('keeps local rows and appends unseen cloud rows', () => {
    const local = [
      { id: 'a', name: 'local-a' },
      { id: 'b', name: 'local-b' }
    ];
    const cloud = [
      { id: 'a', name: 'cloud-a' },
      { id: 'c', name: 'cloud-c' }
    ];
    expect(
      mergeLocalFirst(local, cloud, (item: { id: string }) => item.id)
    ).toEqual([
      { id: 'a', name: 'local-a' },
      { id: 'b', name: 'local-b' },
      { id: 'c', name: 'cloud-c' }
    ]);
  });
});

describe('tagOffline and tagCloud', () => {
  it('tags unpublished rows as local and published rows as synced', () => {
    expect(tagOffline({ id: '1', published_at: null })).toEqual({
      id: '1',
      published_at: null,
      source: 'local'
    });
    expect(tagOffline({ id: '2', published_at: '2026-01-01' })).toEqual({
      id: '2',
      published_at: '2026-01-01',
      source: 'synced'
    });
  });

  it('tags cloud rows and optionally transforms them first', () => {
    expect(tagCloud({ id: '3' })).toEqual({ id: '3', source: 'cloud' });
    expect(
      tagCloud({ id: '3', extra: true }, (row: { id: string }) => ({
        id: row.id
      }))
    ).toEqual({ id: '3', source: 'cloud' });
  });
});

describe('toHybridPage', () => {
  it('sets hasMore when the page is full', () => {
    expect(toHybridPage(['a', 'b'], 0, 2)).toEqual({
      data: ['a', 'b'],
      nextCursor: 1,
      hasMore: true
    });
    expect(toHybridPage(['a'], 0, 2)).toEqual({
      data: ['a'],
      nextCursor: undefined,
      hasMore: false
    });
  });
});
