import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useQuery } from '@powersync/tanstack-react-query';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import {
  keepPreviousData,
  useInfiniteQuery,
  useQueryClient
} from '@tanstack/react-query';
import React, { useEffect, useRef } from 'react';
import { getNetworkStatus, useNetworkStatus } from './useNetworkStatus';

/**
 * Base options that are common to both online and offline queries
 */
type GetQueryParam<T> = Parameters<typeof useQuery<T>>[0];

/**
 * Options for hybrid Supabase queries
 */
type HybridSupabaseQueryOptions<T extends Record<string, unknown>> = Omit<
  GetQueryParam<T>,
  'queryFn' | 'query'
> &
  HybridSupabaseQueryConfig<T>;

interface HybridSupabaseQueryConfig<T> {
  /**
   * Function to get the ID of a record. Defaults to (record) => record.id
   */
  query: Parameters<typeof toCompilableQuery<T>>[0];
  getId?: (record: T | Partial<T>) => string | number;
}

/**
 * useHybridSupabaseQuery
 *
 * A hook that automatically chooses between an online Supabase SQLTR query and an offline Drizzle query,
 * depending on network connectivity. Includes dual cache system for seamless online/offline transitions.
 *
 * @example
 * const { data, isLoading, error } = useHybridSupabaseQuery({
 *   queryKey: ['projects'],
 *   query: db.select().from(projectTable).where(eq(projectTable.visible, true)),
 *   // ... any other useQuery options
 * });
 */
export function useHybridSupabaseQuery<T extends Record<string, unknown>>({
  query,
  queryKey,
  select,
  getId = (record: T | Partial<T>) =>
    (record as unknown as { id: string | number }).id,
  ...restOptions
}: HybridSupabaseQueryOptions<T>) {
  const isOnline = useNetworkStatus();
  const queryClient = useQueryClient();

  // Filter out undefined/null values from the query key
  const cleanQueryKey = queryKey.filter(
    (key) => key !== undefined && key !== null
  );

  // Use dual cache system for better offline/online separation
  const hybridQueryKey = [...cleanQueryKey, isOnline ? 'online' : 'offline'];
  const oppositeQueryKey = [...cleanQueryKey, isOnline ? 'offline' : 'online'];
  const cachedOppositeData = queryClient.getQueryData<T[]>(oppositeQueryKey);
  const oppositeCachedQueryState =
    queryClient.getQueryState<T[]>(oppositeQueryKey);

  // Memoize the merged data to prevent infinite re-renders
  const stableMergedData = React.useMemo(() => {
    if (!cachedOppositeData) return undefined;
    return cachedOppositeData;
  }, [cachedOppositeData]);

  // Create a stable select function that only changes when user's select function changes
  const stableSelect = React.useCallback(
    (data: T[]) => {
      if (!cachedOppositeData && !data.length) {
        return select ? select([]) : [];
      }

      // Only merge if we have both datasets
      if (cachedOppositeData && data.length > 0) {
        const combinedMap = new Map<string | number, T>();

        // Add cached data first
        cachedOppositeData.forEach((item) => {
          combinedMap.set(getId(item), item);
        });

        // Override with fresh data
        data.forEach((item) => {
          combinedMap.set(getId(item), item);
        });

        const mergedArray = Array.from(combinedMap.values());
        return select ? select(mergedArray) : mergedArray;
      }

      // If no cached data, just use current data
      return select ? select(data) : data;
    },
    [cachedOppositeData, select, getId]
  );

  const sharedQueryOptions = {
    queryKey: hybridQueryKey,
    initialData: stableMergedData,
    initialDataUpdatedAt: oppositeCachedQueryState?.dataUpdatedAt,
    select: stableSelect,
    staleTime: 30 * 1000, // Consider data fresh for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: false, // Prevent excessive refetching
    refetchOnMount: false, // Don't refetch if we have data
    ...restOptions
  };

  if (isOnline) {
    const onlineFn = async () => {
      const data = query.toSQL();
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/sqltr?sql=${data.sql}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`
          }
        }
      );
      return (await response.json()) as T[];
    };

    return useQuery({
      ...sharedQueryOptions,
      queryFn: onlineFn,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      networkMode: 'always'
    });
  }

  return useQuery({
    ...sharedQueryOptions,
    queryKey: sharedQueryOptions.queryKey,
    query: toCompilableQuery<T>(query)
  });
}

/**
 * Options for the realtime subscription
 */
interface RealtimeSubscriptionOptions<T extends Record<string, unknown>> {
  subscribeRealtime: (
    onChange: (payload: RealtimePostgresChangesPayload<T>) => void
  ) => () => Promise<'ok' | 'timed out' | 'error'> | (() => void);
  /**
   * Function to get the ID of a record. Defaults to (record) => record.id
   */
}

/**
 * Combined options for hybrid realtime query
 */
type HybridSupabaseRealtimeQueryOptions<T extends Record<string, unknown>> =
  HybridSupabaseQueryOptions<T> & RealtimeSubscriptionOptions<T>;

/**
 * useHybridSupabaseRealtimeQuery
 *
 * Like useHybridSupabaseQuery, but also sets up a realtime subscription when online.
 * The hook automatically handles cache updates via setQueryData based on realtime events.
 *
 * @example
 * const { data, isLoading, error } = useHybridSupabaseRealtimeQuery({
 *   queryKey: ['projects'],
 *   query: db.select().from(projectTable),
 *   subscribeRealtime: (onChange) => {
 *     const channel = system.supabaseConnector.client
 *       .channel('public:project')
 *       .on('postgres_changes', { event: '*', schema: 'public', table: 'project' }, onChange);
 *     channel.subscribe();
 *     return () => system.supabaseConnector.client.removeChannel(channel)
 *   },
 *   getId: (project) => project.id, // Optional: defaults to record.id
 * });
 */
export function useHybridSupabaseRealtimeQuery<
  T extends Record<string, unknown>
>({
  queryKey,
  subscribeRealtime,
  getId = (record: T | Partial<T>) =>
    (record as unknown as { id: string | number }).id,
  ...restOptions
}: HybridSupabaseRealtimeQueryOptions<T>) {
  const queryClient = useQueryClient();
  const realtimeChannelRef = useRef<ReturnType<
    typeof subscribeRealtime
  > | null>(null);

  const isOnline = useNetworkStatus();

  // Use the base hybrid query
  const result = useHybridSupabaseQuery<T>({
    queryKey,
    ...restOptions
  });

  useEffect(() => {
    if (!isOnline) return;

    // Unsubscribe previous
    if (realtimeChannelRef.current) {
      void realtimeChannelRef.current();
      realtimeChannelRef.current = null;
    }

    // Subscribe with automatic cache management
    const subscription = subscribeRealtime((payload) => {
      const { eventType, new: newRow, old: oldRow } = payload;
      const cacheKey = [...queryKey, 'online'];

      queryClient.setQueryData<T[]>(cacheKey, (prev = []) => {
        switch (eventType) {
          case 'INSERT': {
            const recordId = getId(newRow);
            // Avoid duplicates
            if (prev.some((record) => getId(record) === recordId)) {
              return prev;
            }
            return [...prev, newRow];
          }
          case 'UPDATE': {
            const recordId = getId(newRow);
            return prev.map((record) =>
              getId(record) === recordId ? newRow : record
            );
          }
          case 'DELETE': {
            const recordId = getId(oldRow);
            return prev.filter((record) => getId(record) !== recordId);
          }
          default: {
            console.warn(
              'useHybridSupabaseRealtimeQuery: Unhandled event type',
              eventType
            );
            return prev;
          }
        }
      });
    });

    realtimeChannelRef.current = subscription;

    return () => {
      if (realtimeChannelRef.current) {
        void realtimeChannelRef.current();
        realtimeChannelRef.current = null;
      }
    };
  }, [
    isOnline,
    subscribeRealtime,
    queryClient,
    getId,
    JSON.stringify(queryKey)
  ]);

  return result;
}

/**
 * Configuration for hybridSupabaseFetch function
 */
interface HybridSupabaseFetchConfig<T extends Record<string, unknown>> {
  query: Parameters<typeof toCompilableQuery<T>>[0];
  queryKey: GetQueryParam<T>['queryKey'];
}

/**
 * hybridSupabaseFetch
 *
 * A standalone function that automatically chooses between online and offline queries,
 * depending on network connectivity. Can be used outside of React components.
 *
 * @example
 * const projects = await hybridSupabaseFetch({
 *   query: db.select().from(projectTable).where(eq(projectTable.visible, true)),
 *   queryKey: ['projects']
 * });
 */
export async function hybridSupabaseFetch<T extends Record<string, unknown>>(
  config: HybridSupabaseFetchConfig<T>
) {
  const { queryKey: _queryKey, ...restConfig } = config;

  const runOfflineQuery = () =>
    toCompilableQuery<T>(restConfig.query).execute();

  const isOnline = getNetworkStatus();
  if (isOnline) {
    try {
      const data = restConfig.query.toSQL();
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/sqltr?sql=${data.sql}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`
          }
        }
      );
      return (await response.json()) as T[];
    } catch {
      return runOfflineQuery();
    }
  } else {
    return runOfflineQuery();
  }
}

/**
 * Page data structure for hybrid infinite queries
 */
interface HybridPageData<T, TPageParam = unknown> {
  data: T[];
  nextCursor?: TPageParam | undefined;
  hasMore?: boolean;
  totalCount?: number;
}

/**
 * Extract parameter types from useInfiniteQuery
 */
type GetInfiniteQueryParam<T> = Parameters<
  typeof useInfiniteQuery<HybridPageData<T>>
>[0];

/**
 * Configuration for hybrid infinite queries
 */
type HybridSupabaseInfiniteQueryOptions<T extends Record<string, unknown>> =
  Omit<GetInfiniteQueryParam<T>, 'queryFn'> & {
    query: (
      pageParam: GetInfiniteQueryParam<T>['initialPageParam']
    ) => Parameters<typeof toCompilableQuery<T>>[0];
    pageSize: number;
    getId?: (record: T | Partial<T>) => string | number;
  };

/**
 * useHybridSupabaseInfiniteQuery
 *
 * A hook that provides infinite scrolling with automatic online/offline switching for Supabase.
 *
 * @example
 * const {
 *   data,
 *   fetchNextPage,
 *   hasNextPage,
 *   isFetching,
 *   isFetchingNextPage
 * } = useHybridSupabaseInfiniteQuery({
 *   queryKey: ['assets', 'paginated', questId],
 *   query: (pageParam) => db.select().from(assetTable).limit(pageSize).offset(pageParam * pageSize),
 *   pageSize: 20,
 *   initialPageParam: 0,
 *   getNextPageParam: (lastPage) => lastPage.nextCursor
 * });
 */
export function useHybridSupabaseInfiniteQuery<
  T extends Record<string, unknown>
>({
  queryKey,
  query,
  pageSize = 10,
  initialPageParam,
  getNextPageParam,
  getPreviousPageParam,
  ...restOptions
}: HybridSupabaseInfiniteQueryOptions<T>) {
  const timestamp = performance.now();

  const isOnline = useNetworkStatus();
  const queryClient = useQueryClient();

  // Use dual cache system for better offline/online separation
  const hasInfinite = queryKey.includes('infinite');
  const baseKey = hasInfinite ? queryKey : [...queryKey, 'infinite'];
  const cleanBaseKey = baseKey.filter(
    (key: unknown) => key !== undefined && key !== null
  );
  const hybridQueryKey = [...cleanBaseKey, isOnline ? 'online' : 'offline'];
  const oppositeQueryKey = [...cleanBaseKey, isOnline ? 'offline' : 'online'];

  // Get cached data from opposite network state for initial data
  const oppositeCachedQueryState = queryClient.getQueryState(oppositeQueryKey);

  const sharedOptions = {
    queryKey: hybridQueryKey,
    initialPageParam,
    getNextPageParam,
    getPreviousPageParam,
    initialDataUpdatedAt: oppositeCachedQueryState?.dataUpdatedAt,
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
    networkMode: 'always' as const,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    ...restOptions
  };

  return useInfiniteQuery({
    ...sharedOptions,
    queryFn: async ({ pageParam }) => {
      let results: T[] = [];
      if (isOnline) {
        const sqlQuery = query(pageParam);
        const data = sqlQuery.toSQL();
        const response = await fetch(
          `${process.env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/sqltr?sql=${data.sql}`,
          {
            headers: {
              Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`
            }
          }
        );
        results = (await response.json()) as T[];
      } else {
        const sqlQuery = query(pageParam);
        const compiledQuery = toCompilableQuery<T>(sqlQuery);
        results = await compiledQuery.execute();
      }
      console.log(
        `[${performance.now() - timestamp}ms] useHybridSupabaseInfiniteQuery (${isOnline ? 'online' : 'offline'}) ${JSON.stringify(hybridQueryKey)}`
      );
      return {
        data: results,
        nextCursor:
          results.length === pageSize ? (pageParam as number) + 1 : undefined,
        hasMore: results.length === pageSize
      } satisfies HybridPageData<T>;
    },
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    refetchOnMount: true
  });

  // const result = useInfiniteQuery({
  //   ...sharedOptions,
  //   queryFn: offlineQueryFn,
  //   enabled: true
  // });
  // console.log(
  //   `[${performance.now() - timestamp}ms] useHybridSupabaseInfiniteQuery (offline) ${JSON.stringify(hybridQueryKey)}`
  // );
  // return result;
}

/**
 * Traditional paginated hybrid query with keepPreviousData for smooth page transitions
 * Use this when you need discrete page navigation (Previous/Next buttons)
 */
export function useHybridSupabasePaginatedQuery<
  T extends Record<string, unknown>
>(
  options: HybridSupabaseQueryOptions<T> & {
    page: number;
    pageSize: number;
  }
) {
  const { page, pageSize, ...hybridOptions } = options;

  return useHybridSupabaseQuery({
    ...hybridOptions,
    queryKey: [...hybridOptions.queryKey, 'paginated', page, pageSize],
    placeholderData: keepPreviousData // Smooth page transitions
  });
}

/**
 * Helper function to create hybrid query config
 */
export function createHybridSupabaseQueryConfig<
  T extends Record<string, unknown>
>(options: HybridSupabaseQueryOptions<T>) {
  return options;
}

/**
 * Helper function to convert to fetch config
 */
export function convertToSupabaseFetchConfig<T extends Record<string, unknown>>(
  options: HybridSupabaseQueryOptions<T>
): HybridSupabaseFetchConfig<T> {
  const { queryKey, ...rest } = options;
  return {
    queryKey,
    ...rest
  } as HybridSupabaseFetchConfig<T>;
}
