import type { QueryClient } from '@tanstack/react-query';

/**
 * Refetch hybrid *cloud* overlays only. Offline lists are PowerSync-watched
 * (or infinite watchTables) and must not be kicked after a local SQLite write
 * while those watches are mounted.
 *
 * Stored keys: finite `[type, 'cloud', …]`, infinite `[type, 'infinite', …, 'cloud']`.
 */
export function invalidateCloud(
  queryClient: QueryClient,
  ...dataTypes: string[]
) {
  const types = new Set(dataTypes);
  return queryClient.invalidateQueries({
    predicate: (query) => {
      const [dataType] = query.queryKey;
      if (typeof dataType !== 'string' || !types.has(dataType)) return false;
      return query.queryKey[1] === 'cloud' || query.queryKey.at(-1) === 'cloud';
    }
  });
}

/**
 * Chapter/pericope lists unmount during recording, so their PowerSync watch
 * misses local writes (publish, version label). Mark the create-time snapshot
 * stale so remount rereads SQLite.
 */
export function invalidateOfflineChapterLists(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['bible-chapters', 'offline'] }),
    queryClient.invalidateQueries({
      queryKey: ['fia-pericope-quests', 'offline']
    })
  ]);
}
