import { defaultShouldDehydrateQuery } from '@tanstack/query-core';
import type { Query, QueryKey } from '@tanstack/query-core';

/** Persist FIA / Bible Brain API data on disk for 1 year */
export const FIA_BIBLE_API_QUERY_CACHE_MS = 1000 * 60 * 60 * 24 * 365;

/** Consider cached data stale after 14 days — triggers background refetch */
const FIA_BIBLE_API_STALE_MS = 1000 * 60 * 60 * 24 * 14;

/** Keep in memory slightly longer than `maxAge` so hydration is not immediately GC'd */
const FIA_BIBLE_API_GC_BUFFER_MS = 1000 * 60 * 60;

/** Bump when persisted query shape or keys change so stale blobs are dropped */
export const FIA_BIBLE_QUERY_PERSIST_BUSTER = 'fia-bible-api-v1';

export const FIA_BIBLE_QUERY_ASYNC_STORAGE_KEY =
  'tanstack-query-fia-bible-api-cache';

const PERSISTED_ROOT_KEYS = new Set<string>([
  'bible-brain-content',
  'bible-brain-bibles',
  'bible-brain-bibles-by-iso',
  'bible-brain-languages',
  'fia-books',
  'fia-book-quests',
  'fia-pericope-quests'
]);

export function isFiaBibleApiPersistedQueryKey(queryKey: QueryKey): boolean {
  const root = queryKey[0];
  return typeof root === 'string' && PERSISTED_ROOT_KEYS.has(root);
}

export function shouldDehydrateFiaBibleApiQuery(query: Query): boolean {
  return (
    defaultShouldDehydrateQuery(query) &&
    isFiaBibleApiPersistedQueryKey(query.queryKey)
  );
}

/** Use on FIA / Bible Brain edge-function queries so global refetchInterval does not hammer the API */
export const fiaBibleApiQueryOptions = {
  staleTime: FIA_BIBLE_API_STALE_MS,
  gcTime: FIA_BIBLE_API_QUERY_CACHE_MS + FIA_BIBLE_API_GC_BUFFER_MS,
  refetchInterval: false,
  refetchOnMount: true
} as const;
