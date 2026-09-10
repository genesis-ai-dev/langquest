import { AuthContext } from '@/contexts/AuthContext';
import { sourceOptions } from '@/db/constants';
import { system } from '@/db/powersync/system';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useContext } from 'react';

import type { WithSource } from '@/utils/dbUtils';
import type { CompilableQuery as CompilableQueryNative } from '@powersync/react-native';
import { useQuery as usePowerSyncQuery } from '@powersync/tanstack-react-query';
import type {
  UseInfiniteQueryOptions,
  UseQueryOptions
} from '@tanstack/react-query';
import {
  useInfiniteQuery,
  useQueryClient,
  useQuery as useTanstackQuery
} from '@tanstack/react-query';
import React from 'react';

type CompilableQuery<T = unknown> = CompilableQueryNative<T>;
type QueryKeyParam = string | number | boolean | null | undefined;
type ItemId = string | number;

/**
 * PowerSync's TanStack `useQuery` already watches SQLite and puts rows in the
 * query cache. This hook adds the piece that package does not: a parallel
 * Supabase overlay, merged local-first, with `source` tags for the UI.
 *
 * Cloud stays on vanilla TanStack `useQuery` because the PowerSync wrapper
 * overwrites `enabled` with `streamsHaveSynced`. Same reason a disabled
 * offline watch uses an empty SQL statement instead of `enabled: false`.
 *
 * Infinite lists stay on TanStack `useInfiniteQuery`. The PowerSync package
 * has no infinite hook, so table changes are forwarded with `onChange`.
 */

/** Empty watch. PowerSync's TanStack hook ignores `enabled`. */
const DISABLED_WATCH = 'SELECT 1 WHERE 0';

export type HybridDataSource = (typeof sourceOptions)[number];
type OfflineDataSource = Exclude<HybridDataSource, 'cloud'>;

function inferOfflineSource(item: {
  source?: OfflineDataSource;
  published_at?: string | Date | null;
}): OfflineDataSource {
  if (item.source) return item.source;
  if (item.published_at === undefined) return 'synced';
  return item.published_at == null ? 'local' : 'synced';
}

function defaultGetItemId(item: unknown): ItemId {
  return (item as { id: ItemId }).id;
}

/**
 * `queryKey[0]` is the data type used for invalidation (e.g. `'assets'`).
 * Stored keys stay `[dataType, 'offline' | 'cloud', ...queryKey.slice(1)]`.
 */
function splitHybridQueryKey(queryKey: readonly QueryKeyParam[]): {
  dataType: string;
  rest: QueryKeyParam[];
} {
  const [dataType, ...rest] = queryKey;
  if (typeof dataType !== 'string' || dataType.length === 0) {
    throw new Error('useHybridQuery queryKey[0] must be a non-empty string');
  }
  return { dataType, rest };
}

function tagOffline<T>(item: T): WithSource<T> {
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

function tagCloud<T>(
  item: unknown,
  transform?: (data: never) => unknown
): WithSource<T> {
  const transformed = (transform ? transform(item as never) : item) as T;
  return { ...transformed, source: 'cloud' } as WithSource<T>;
}

function mergeLocalFirst<T>(
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

interface HybridQueryOptions<TOfflineData, TCloudData = TOfflineData> {
  queryKey: readonly QueryKeyParam[];

  /** PowerSync SQL or Drizzle compilable. Live SQLite watch. */
  offlineQuery: string | CompilableQuery<TOfflineData>;

  cloudQueryFn?: () => Promise<TCloudData[]>;

  getItemId?: (item: WithSource<TOfflineData | TCloudData>) => ItemId;

  transformCloudData?: (data: TCloudData) => TOfflineData;

  offlineQueryOptions?: Omit<
    UseQueryOptions<TOfflineData[]>,
    'queryKey' | 'queryFn' | 'query' | 'parameters'
  >;

  cloudQueryOptions?: Omit<
    UseQueryOptions<TCloudData[]>,
    'queryKey' | 'queryFn' | 'enabled'
  >;

  enableCloudQuery?: boolean;

  enableOfflineQuery?: boolean;

  enabled?: boolean;
}

interface HybridQueryResult<T> {
  data: WithSource<T>[];

  isOfflineLoading: boolean;
  isCloudLoading: boolean;
  isLoading: boolean;
  isError: boolean;

  offlineError: Error | null;
  cloudError: Error | null;

  isOnline: boolean;

  refetch: () => void;
}

export function useHybridQuery<TOfflineData, TCloudData = TOfflineData>(
  options: HybridQueryOptions<TOfflineData, TCloudData>
): HybridQueryResult<TOfflineData> {
  const {
    queryKey,
    offlineQuery,
    cloudQueryFn,
    getItemId = defaultGetItemId,
    transformCloudData,
    offlineQueryOptions,
    cloudQueryOptions,
    enableCloudQuery,
    enableOfflineQuery = true,
    enabled = true
  } = options;

  const { dataType, rest: queryKeyParams } = splitHybridQueryKey(queryKey);
  const isOnline = useNetworkStatus();
  const isAuthenticated = useContext(AuthContext)?.isAuthenticated ?? false;

  const watchOffline =
    enableOfflineQuery &&
    enabled &&
    isAuthenticated &&
    offlineQueryOptions?.enabled !== false;

  const offline = usePowerSyncQuery<TOfflineData>({
    ...offlineQueryOptions,
    queryKey: [dataType, 'offline', ...queryKeyParams],
    query: watchOffline ? offlineQuery : DISABLED_WATCH
  });

  const fetchCloud =
    enableCloudQuery !== false && isOnline && enabled && !!cloudQueryFn;

  const cloud = useTanstackQuery({
    ...cloudQueryOptions,
    queryKey: [dataType, 'cloud', ...queryKeyParams],
    queryFn: cloudQueryFn ?? (async () => [] as TCloudData[]),
    enabled: fetchCloud
  });

  const data = React.useMemo(() => {
    const local = (offline.data ?? []).filter(Boolean).map(tagOffline);
    const remote = (cloud.data ?? []).map((item) =>
      tagCloud<TOfflineData>(item, transformCloudData)
    );
    return mergeLocalFirst(local, remote, getItemId);
  }, [offline.data, cloud.data, getItemId, transformCloudData]);

  const isOfflineLoading = watchOffline && offline.isLoading;
  const isCloudLoading = cloud.isLoading;

  return {
    data,
    isOfflineLoading,
    isCloudLoading,
    isLoading: watchOffline
      ? isOfflineLoading || isCloudLoading
      : isCloudLoading,
    isError: !!offline.error || !!cloud.error,
    offlineError: watchOffline ? (offline.error ?? null) : null,
    cloudError: cloud.error ?? null,
    isOnline,
    refetch: () => {
      if (watchOffline) void offline.refetch();
      if (fetchCloud) void cloud.refetch();
    }
  };
}

interface InfiniteQueryContext {
  pageParam: number;
  pageSize: number;
}

interface HybridPageData<T> {
  data: T[];
  nextCursor?: number;
  hasMore: boolean;
}

interface HybridInfiniteQueryOptions<
  TOfflineData,
  TCloudData = TOfflineData
> {
  queryKey: readonly QueryKeyParam[];

  offlineQueryFn: (context: InfiniteQueryContext) => Promise<TOfflineData[]>;

  cloudQueryFn: (context: InfiniteQueryContext) => Promise<TCloudData[]>;

  pageSize?: number;

  getItemId?: (item: WithSource<TOfflineData | TCloudData>) => ItemId;

  transformCloudData?: (cloudData: TCloudData) => WithSource<TOfflineData>;

  offlineQueryOptions?: Omit<
    UseInfiniteQueryOptions<HybridPageData<TOfflineData>>,
    'queryKey' | 'queryFn' | 'initialPageParam' | 'getNextPageParam' | 'select'
  >;

  cloudQueryOptions?: Omit<
    UseInfiniteQueryOptions<HybridPageData<TCloudData>>,
    | 'queryKey'
    | 'queryFn'
    | 'enabled'
    | 'initialPageParam'
    | 'getNextPageParam'
    | 'select'
  >;

  enableCloudQuery?: boolean;

  /**
   * Local tables that offlineQueryFn reads. Infinite pages are one-shot
   * reads, so sync arrivals would otherwise wait for refetchInterval.
   */
  watchTables?: string[];
}

interface HybridInfiniteQueryResult<T> {
  data: {
    pages: HybridPageData<WithSource<T>>[];
    pageParams: number[];
  };

  fetchNextPage: () => void;
  fetchPreviousPage: () => void;
  refetch: () => void;

  hasNextPage: boolean;
  hasPreviousPage: boolean;
  isFetchingNextPage: boolean;
  isFetchingPreviousPage: boolean;
  isLoading: boolean;
  isOfflineLoading: boolean;
  isCloudLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  isSuccess: boolean;

  error: Error | null;

  isOnline: boolean;

  status: 'error' | 'pending' | 'success';
}

function toHybridPage<T>(
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

export function useHybridInfiniteQuery<TOfflineData, TCloudData = TOfflineData>(
  options: HybridInfiniteQueryOptions<TOfflineData, TCloudData>
): HybridInfiniteQueryResult<TOfflineData> {
  const {
    queryKey,
    offlineQueryFn,
    cloudQueryFn,
    pageSize = 10,
    getItemId = defaultGetItemId,
    transformCloudData,
    enableCloudQuery,
    watchTables,
    offlineQueryOptions,
    cloudQueryOptions
  } = options;

  const { dataType, rest: queryKeyParams } = splitHybridQueryKey(queryKey);
  const queryClient = useQueryClient();
  const isOnline = useNetworkStatus();
  const isAuthenticated = useContext(AuthContext)?.isAuthenticated ?? false;

  const watchOffline =
    isAuthenticated && offlineQueryOptions?.enabled !== false;
  const fetchCloud = enableCloudQuery !== false && isOnline;

  const baseKey = [dataType, 'infinite', ...queryKeyParams];
  const offlineQueryKey = [...baseKey, 'offline'];
  const cloudQueryKey = [...baseKey, 'cloud'];

  const offlineQuery = useInfiniteQuery({
    ...offlineQueryOptions,
    queryKey: offlineQueryKey,
    initialPageParam: 0,
    getNextPageParam: (lastPage: HybridPageData<TOfflineData>) =>
      lastPage.nextCursor,
    enabled: watchOffline,
    queryFn: async ({ pageParam }) =>
      toHybridPage(
        await offlineQueryFn({
          pageParam: pageParam as number,
          pageSize
        }),
        pageParam as number,
        pageSize
      )
  });

  const cloudQuery = useInfiniteQuery({
    ...cloudQueryOptions,
    queryKey: cloudQueryKey,
    initialPageParam: 0,
    getNextPageParam: (lastPage: HybridPageData<TCloudData>) =>
      lastPage.nextCursor,
    enabled: fetchCloud,
    queryFn: async ({ pageParam }) =>
      toHybridPage(
        await cloudQueryFn({
          pageParam: pageParam as number,
          pageSize
        }),
        pageParam as number,
        pageSize
      )
  });

  const watchTablesKey = watchTables?.join(',') ?? '';

  React.useEffect(() => {
    if (!watchOffline || !watchTablesKey) return;

    return system.powersync.onChangeWithCallback(
      {
        onChange: () => {
          void queryClient.invalidateQueries({
            queryKey: [dataType, 'infinite'],
            predicate: (query) => query.queryKey.at(-1) === 'offline'
          });
        },
        onError: (error) =>
          console.error(`[${dataType}] Offline table watch failed:`, error)
      },
      { tables: watchTablesKey.split(','), throttleMs: 250 }
    );
  }, [dataType, queryClient, watchOffline, watchTablesKey]);

  const mergedData = React.useMemo(() => {
    const offlinePages = offlineQuery.data?.pages ?? [];
    const cloudPages = cloudQuery.data?.pages ?? [];
    const maxPages = Math.max(offlinePages.length, cloudPages.length);
    const pages: HybridPageData<WithSource<TOfflineData>>[] = [];

    for (let i = 0; i < maxPages; i++) {
      const offlinePage = offlinePages[i];
      const cloudPage = cloudPages[i];
      if (!offlinePage && !cloudPage) continue;

      pages.push({
        data: mergeLocalFirst(
          offlinePage?.data.map(tagOffline) ?? [],
          cloudPage?.data.map((item) =>
            tagCloud<TOfflineData>(item, transformCloudData)
          ) ?? [],
          getItemId
        ),
        nextCursor: offlinePage?.nextCursor ?? cloudPage?.nextCursor,
        hasMore: Boolean(offlinePage?.hasMore || cloudPage?.hasMore)
      });
    }

    return {
      pages,
      pageParams: (offlineQuery.data?.pageParams ??
        cloudQuery.data?.pageParams ??
        []) as number[]
    };
  }, [offlineQuery.data, cloudQuery.data, getItemId, transformCloudData]);

  const isOfflineLoading = offlineQuery.isLoading;
  const isCloudLoading = fetchCloud && cloudQuery.isLoading;
  const isPending = watchOffline
    ? offlineQuery.isLoading || cloudQuery.isLoading
    : cloudQuery.isLoading;

  return {
    data: mergedData,
    fetchNextPage: () => {
      void offlineQuery.fetchNextPage();
      if (fetchCloud) void cloudQuery.fetchNextPage();
    },
    fetchPreviousPage: () => {
      void offlineQuery.fetchPreviousPage();
      if (fetchCloud) void cloudQuery.fetchPreviousPage();
    },
    refetch: () => {
      void offlineQuery.refetch();
      if (fetchCloud) void cloudQuery.refetch();
    },
    hasNextPage: offlineQuery.hasNextPage || cloudQuery.hasNextPage,
    hasPreviousPage: offlineQuery.hasPreviousPage || cloudQuery.hasPreviousPage,
    isFetchingNextPage:
      offlineQuery.isFetchingNextPage || cloudQuery.isFetchingNextPage,
    isFetchingPreviousPage:
      offlineQuery.isFetchingPreviousPage || cloudQuery.isFetchingPreviousPage,
    isLoading: isPending,
    isOfflineLoading,
    isCloudLoading,
    isFetching: offlineQuery.isFetching || cloudQuery.isFetching,
    isError: offlineQuery.isError || cloudQuery.isError,
    isSuccess: offlineQuery.isSuccess || cloudQuery.isSuccess,
    error: offlineQuery.error || cloudQuery.error,
    isOnline,
    status:
      offlineQuery.isError || cloudQuery.isError
        ? 'error'
        : isPending
          ? 'pending'
          : 'success'
  };
}
