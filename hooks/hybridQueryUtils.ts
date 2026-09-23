import type { sourceOptions } from '@/db/constants';
import type { WithSource } from '@/utils/dbUtils';

export type HybridDataSource = (typeof sourceOptions)[number];
type OfflineDataSource = Exclude<HybridDataSource, 'cloud'>;
export type QueryKeyParam = string | number | boolean | null | undefined;
export type ItemId = string | number;

export interface HybridPageData<T> {
  data: T[];
  nextCursor?: number;
  hasMore: boolean;
}

export function inferOfflineSource(item: {
  source?: OfflineDataSource;
  published_at?: string | Date | null;
}): OfflineDataSource {
  if (item.source) return item.source;
  if (item.published_at === undefined) return 'synced';
  return item.published_at == null ? 'local' : 'synced';
}

export function defaultGetItemId(item: unknown): ItemId {
  return (item as { id: ItemId }).id;
}

/**
 * `queryKey[0]` is the data type used for invalidation (e.g. `'assets'`).
 * Stored keys stay `[dataType, 'offline' | 'cloud', ...queryKey.slice(1)]`.
 */
export function splitHybridQueryKey(queryKey: readonly QueryKeyParam[]): {
  dataType: string;
  rest: QueryKeyParam[];
} {
  const [dataType, ...rest] = queryKey;
  if (typeof dataType !== 'string' || dataType.length === 0) {
    throw new Error('useHybridQuery queryKey[0] must be a non-empty string');
  }
  return { dataType, rest };
}

export function tagOffline<T>(item: T): WithSource<T> {
  return {
    ...item,
    source: inferOfflineSource(
      item as {
        source?: OfflineDataSource;
        published_at?: string | Date | null;
      }
    )
  } as WithSource<T>;
}

export function tagCloud<T>(
  item: unknown,
  transform?: (data: never) => unknown
): WithSource<T> {
  const transformed = (transform ? transform(item as never) : item) as T;
  return { ...transformed, source: 'cloud' } as WithSource<T>;
}

export function mergeLocalFirst<T>(
  local: T[],
  cloud: T[],
  getItemId: (item: never) => ItemId
): T[] {
  const seen = new Set(local.map((item) => getItemId(item as never)));
  return [
    ...local,
    ...cloud.filter((item) => !seen.has(getItemId(item as never)))
  ];
}

export function toHybridPage<T>(
  results: T[],
  pageParam: number,
  pageSize: number
): HybridPageData<T> {
  return {
    data: results,
    nextCursor: results.length === pageSize ? pageParam + 1 : undefined,
    hasMore: results.length === pageSize
  };
}
