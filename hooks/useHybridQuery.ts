import type { CompilableQuery } from '@powersync/react-native';
import { useQuery } from '@powersync/tanstack-react-query';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { QueryFunctionContext } from '@tanstack/react-query';
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
 * Options for online queries (excludes the 'query' property)
 */
type HybridQueryOptions<T> = Omit<GetQueryParam<T>, 'queryFn' | 'query'> &
  HybridQueryConfig<T>;

type HybridQueryConfig<T> = (
  | {
      offlineFn: GetQueryParam<T>['queryFn'];
      offlineQuery?: never;
    }
  | {
      offlineQuery: string | CompilableQuery<T>;
      offlineFn?: never;
    }
) & {
  onlineFn: GetQueryParam<T>['queryFn'];
  alwaysOnline?: boolean;
  /**
   * Function to get the ID of a record. Defaults to (record) => record.id
   */
  getId?: (record: T | Partial<T>) => string | number;
};

/**
 * useHybridQuery
 *
 * A hook that automatically chooses between an online query function and an offline Drizzle query,
 * depending on network connectivity. Compatible with PowerSync/Drizzle/React Query stack.
 *
 * @example
 * const { data, isLoading, error } = useHybridQuery({
 *   queryKey: ['projects'],
 *   onlineFn: async () => await system.supabaseConnector.client
 *     .from('project')
 *     .select('*')
 *     .eq('visible', true)
 *     .eq('active', true)
 *     .overrideTypes<Project[]>(),
 *   offlineQuery: toCompilableQuery(system.db.query.project.findMany({
 *     where: (fields, { eq, and }) =>
 *       and(eq(fields.visible, true), eq(fields.active, true))
 *   })),
 *   // ... any other useQuery options
 * });
 */
export function useHybridQuery<T extends Record<string, unknown>>(
  options: HybridQueryOptions<T>
) {
  const {
    queryKey,
    onlineFn,
    select,
    getId = (record: T | Partial<T>) =>
      (record as unknown as { id: string | number }).id,
    ...restOptions
  } = options;
  const isOnline = useNetworkStatus();
  const queryClient = useQueryClient();

  // FIXED: Stabilize query keys with useMemo to prevent infinite loops
  const stableQueryKeys = React.useMemo(() => {
    // Filter out undefined/null values from the query key
    const cleanQueryKey = queryKey.filter(
      (key) => key !== undefined && key !== null
    );

    // Use dual cache system for better offline/online separation
    const hybridQueryKey = [...cleanQueryKey, isOnline ? 'online' : 'offline'];
    const oppositeQueryKey = [
      ...cleanQueryKey,
      isOnline ? 'offline' : 'online'
    ];

    return { hybridQueryKey, oppositeQueryKey };
  }, [queryKey, isOnline]);

  const cachedOppositeData = queryClient.getQueryData<T[]>(
    stableQueryKeys.oppositeQueryKey
  );
  const oppositeCachedQueryState = queryClient.getQueryState<T[]>(
    stableQueryKeys.oppositeQueryKey
  );

  // Memoize the merged data to prevent infinite re-renders
  const stableMergedData = React.useMemo(() => {
    if (!cachedOppositeData) return undefined;

    // Return the same reference if no changes
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
    queryKey: stableQueryKeys.hybridQueryKey,
    initialData: stableMergedData,
    initialDataUpdatedAt: oppositeCachedQueryState?.dataUpdatedAt,
    select: stableSelect,
    staleTime: 30 * 1000, // Consider data fresh for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: false, // Prevent excessive refetching
    refetchOnMount: false, // Don't refetch if we have data
    ...restOptions
  };

  const useOfflineQuery = () => {
    if ('offlineFn' in options && options.offlineFn) {
      return useQuery({
        queryFn: options.offlineFn,
        ...sharedQueryOptions
      });
    } else if ('offlineQuery' in options && options.offlineQuery) {
      return useQuery({
        query: options.offlineQuery,
        ...sharedQueryOptions
      });
    } else {
      throw new Error('Either offlineFn or offlineQuery must be provided');
    }
  };

  if (isOnline) {
    return useQuery({
      ...sharedQueryOptions,
      queryFn: onlineFn,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false, // FIXED: Prevent excessive refetching on focus
      refetchOnMount: false, // FIXED: Prevent refetch on every mount
      networkMode: 'always'
    });
  }

  return useOfflineQuery();
}

/**
 * Options for the realtime subscription
 */
interface RealtimeSubscriptionOptions<T extends Record<string, unknown>> {
  subscribeRealtime: (
    onChange: (payload: RealtimePostgresChangesPayload<T>) => void
  ) => () => Promise<'ok' | 'timed out' | 'error'>;
  /**
   * Function to get the ID of a record. Defaults to (record) => record.id
   */
}

/**
 * Combined options for hybrid realtime query - only supports offlineQuery variant
 */
type HybridRealtimeQueryOptions<T extends Record<string, unknown>> =
  HybridQueryOptions<T> & RealtimeSubscriptionOptions<T>;

/**
 * useHybridRealtimeQuery
 *
 * Like useHybridQuery, but also sets up a realtime subscription (e.g. Supabase) when online.
 * The hook automatically handles cache updates via setQueryData based on realtime events.
 * Note: This hook only supports the offlineQuery variant, not offlineFn.
 *
 * @example
 * const { data, isLoading, error } = useHybridRealtimeQuery({
 *   queryKey: ['projects'],
 *   onlineFn: ...,
 *   offlineQuery: ...,
 *   subscribeRealtime: (onChange) => {
 *     const channel = system.supabaseConnector.client
 *       .channel('public:project')
 *       .on('postgres_changes', { event: '*', schema: 'public', table: 'project' }, onChange);
 *     channel.subscribe();
 *     return () => system.supabaseConnector.client.removeChannel(channel)
 *   },
 *   getId: (project) => project.id, // Optional: defaults to record.id
 *   enabled: true,
 *   refetchOnWindowFocus: false,
 *   // ... any other useQuery options
 * });
 */
export function useHybridRealtimeQuery<T extends Record<string, unknown>>({
  queryKey,
  subscribeRealtime,
  getId = (record: T | Partial<T>) =>
    (record as unknown as { id: string | number }).id,
  ...restOptions
}: HybridRealtimeQueryOptions<T>) {
  const queryClient = useQueryClient();
  const realtimeChannelRef = useRef<ReturnType<
    typeof subscribeRealtime
  > | null>(null);

  const isOnline = useNetworkStatus();
  // Extract the specific properties to avoid duplicates
  const { offlineFn, offlineQuery, onlineFn, ...otherOptions } = restOptions;

  // Type-narrow the options to call the correct overload
  const result = offlineFn
    ? useHybridQuery<T>({
        queryKey,
        offlineFn,
        onlineFn,
        ...otherOptions
      } as HybridQueryOptions<T>)
    : useHybridQuery<T>({
        queryKey,
        offlineQuery,
        onlineFn,
        ...otherOptions
      } as HybridQueryOptions<T>);

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
      const cacheKey = [...queryKey, true];

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
              'useHybridRealtimeQuery: Unhandled event type',
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
 * Configuration for hybridFetch function
 */
type HybridFetchConfig<T extends Record<string, unknown>> = (
  | {
      offlineFn: () => Promise<T[] | undefined>;
      offlineQuery?: never;
    }
  | {
      offlineQuery: string | CompilableQuery<T>;
      offlineFn?: never;
    }
) & {
  queryKey: GetQueryParam<T>['queryKey'];
  onlineFn: () => Promise<T[]>;
  /**
   * Optional network status. If not provided, will attempt to check navigator.onLine
   */
};

/**
 * hybridFetch
 *
 * A standalone function that automatically chooses between an online fetch function and an offline query,
 * depending on network connectivity. Can be used outside of React components.
 *
 * @example
 * const projects = await hybridFetch({
 *   onlineFn: async () => {
 *     const response = await system.supabaseConnector.client
 *       .from('project')
 *       .select('*')
 *       .eq('visible', true);
 *     return response.data || [];
 *   },
 *   offlineFn: async () => {
 *     return await system.db.query.project.findMany({
 *       where: (fields, { eq }) => eq(fields.visible, true)
 *     });
 *   }
 * });
 */
export async function hybridFetch<T extends Record<string, unknown>>(
  config: HybridFetchConfig<T>
) {
  const { onlineFn, ...restConfig } = config;

  const runOfflineQuery = async () => {
    if ('offlineFn' in restConfig && restConfig.offlineFn) {
      return await restConfig.offlineFn();
    } else if ('offlineQuery' in restConfig) {
      // For standalone usage, offlineQuery should be a CompilableQuery, not string
      if (typeof restConfig.offlineQuery === 'string') {
        throw new Error(
          'String queries not supported in standalone hybridFetch. Use offlineFn instead.'
        );
      } else {
        return await restConfig.offlineQuery.execute();
      }
    } else {
      throw new Error('Either offlineFn or offlineQuery must be provided');
    }
  };

  const isOnline = getNetworkStatus();
  if (isOnline) return await onlineFn();

  return runOfflineQuery();
}

export function createHybridQueryConfig<T extends Record<string, unknown>>(
  options: HybridQueryOptions<T>
) {
  return options;
}

export function convertToFetchConfig<T extends Record<string, unknown>>(
  options: HybridQueryOptions<T>
): HybridFetchConfig<T> {
  const { onlineFn, offlineFn, offlineQuery, queryKey } = options;
  return {
    onlineFn,
    offlineFn,
    offlineQuery,
    queryKey
  } as HybridFetchConfig<T>;
}

/**
 * Page data structure for hybrid infinite queries
 */
interface HybridPageData<T, TPageParam = unknown> {
  data: T[];
  nextCursor?: TPageParam;
  hasMore?: boolean;
  totalCount?: number;
}

/**
 * Configuration for hybrid infinite queries
 */
type HybridInfiniteQueryOptions<
  T extends Record<string, unknown>,
  TPageParam = unknown
> = {
  queryKey: readonly unknown[];
  onlineFn: (
    context: QueryFunctionContext<readonly unknown[], TPageParam>
  ) => Promise<HybridPageData<T, TPageParam>>;
  initialPageParam: TPageParam;
  getNextPageParam: (
    lastPage: HybridPageData<T, TPageParam>
  ) => TPageParam | undefined;
  getPreviousPageParam?: (
    firstPage: HybridPageData<T, TPageParam>
  ) => TPageParam | undefined;
  enabled?: boolean;
  staleTime?: number;
  gcTime?: number;
  refetchOnMount?: boolean;
  refetchOnWindowFocus?: boolean;
  refetchOnReconnect?: boolean;
  getId?: (record: T | Partial<T>) => string | number;
} & (
  | {
      offlineFn: (
        context: QueryFunctionContext<readonly unknown[], TPageParam>
      ) => Promise<HybridPageData<T, TPageParam>>;
      offlineQuery?: never;
    }
  | {
      offlineQuery: string | CompilableQuery<T>;
      offlineFn?: never;
    }
);

/**
 * useHybridInfiniteQuery
 *
 * A hook that provides infinite scrolling with automatic online/offline switching.
 * Follows TKDodo's best practices for infinite queries with proper TypeScript support.
 *
 * @example
 * const {
 *   data,
 *   fetchNextPage,
 *   hasNextPage,
 *   isFetching,
 *   isFetchingNextPage
 * } = useHybridInfiniteQuery({
 *   queryKey: ['assets', 'paginated', questId],
 *   onlineFn: async ({ pageParam = 0 }: { pageParam: number }) => {
 *     const response = await supabaseClient
 *       .from('assets')
 *       .select('*')
 *       .range(pageParam * 20, (pageParam + 1) * 20 - 1);
 *     return {
 *       data: response.data || [],
 *       nextCursor: response.data?.length === 20 ? pageParam + 1 : undefined,
 *       hasMore: response.data?.length === 20
 *     };
 *   },
 *   offlineFn: async ({ pageParam = 0 }: { pageParam: number }) => {
 *     const assets = await db.query.asset.findMany({
 *       limit: 20,
 *       offset: pageParam * 20
 *     });
 *     return {
 *       data: assets,
 *       nextCursor: assets.length === 20 ? pageParam + 1 : undefined,
 *       hasMore: assets.length === 20
 *     };
 *   },
 *   initialPageParam: 0,
 *   getNextPageParam: (lastPage) => lastPage.nextCursor
 * });
 */
export function useHybridInfiniteQuery<
  T extends Record<string, unknown>,
  TPageParam = unknown
>(options: HybridInfiniteQueryOptions<T, TPageParam>) {
  const timestamp = performance.now();
  const {
    queryKey,
    onlineFn,
    offlineFn: _offlineFn,
    initialPageParam,
    getNextPageParam,
    getPreviousPageParam,
    ...restOptions
  } = options;

  const isOnline = useNetworkStatus();
  const queryClient = useQueryClient();

  // Performance tracking is handled in the query functions below

  // FIXED: Stabilize query keys with useMemo to prevent infinite loops
  const stableQueryKeys = React.useMemo(() => {
    // Use dual cache system for better offline/online separation
    // Don't add 'infinite' again if it's already in the queryKey
    const hasInfinite = queryKey.includes('infinite');
    const baseKey = hasInfinite ? queryKey : [...queryKey, 'infinite'];

    // Filter out undefined/null values from the query key
    const cleanBaseKey = baseKey.filter(
      (key) => key !== undefined && key !== null
    );
    const hybridQueryKey = [...cleanBaseKey, isOnline ? 'online' : 'offline'];
    const oppositeQueryKey = [...cleanBaseKey, isOnline ? 'offline' : 'online'];

    return { hybridQueryKey, oppositeQueryKey };
  }, [queryKey, isOnline]);

  // Get cached data from opposite network state for initial data
  const oppositeCachedQueryState = queryClient.getQueryState(
    stableQueryKeys.oppositeQueryKey
  );

  const sharedOptions = {
    queryKey: stableQueryKeys.hybridQueryKey,
    initialPageParam,
    getNextPageParam,
    getPreviousPageParam,
    initialDataUpdatedAt: oppositeCachedQueryState?.dataUpdatedAt,
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000, // Data fresh for 30 seconds
    gcTime: 10 * 60 * 1000,
    networkMode: 'always' as const,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false, // FIXED: Prevent excessive refetching
    ...restOptions
  };

  const useOfflineInfiniteQuery = () => {
    if (typeof options.offlineFn === 'function') {
      return useInfiniteQuery({
        ...sharedOptions,
        queryFn: options.offlineFn,
        enabled: true
      });
    } else {
      console.error(
        '[HybridInfiniteQuery] offlineQuery not supported in infinite queries, use offlineFn instead'
      );
      throw new Error(
        'offlineQuery not supported in infinite queries, use offlineFn instead'
      );
    }
  };

  if (isOnline) {
    const result = useInfiniteQuery({
      ...sharedOptions,
      queryFn: onlineFn,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false, // FIXED: Prevent excessive refetching on focus
      refetchOnMount: false // FIXED: Prevent refetch on every mount
    });
    // console.log(
    //   `[${performance.now() - timestamp}ms] useHybridInfiniteQuery (online) ${JSON.stringify(stableQueryKeys.hybridQueryKey)}`
    // );
    return result;
  }

  const result = useOfflineInfiniteQuery();
  // console.log(
  //   `[${performance.now() - timestamp}ms] useHybridInfiniteQuery (offline) ${JSON.stringify(stableQueryKeys.hybridQueryKey)}`
  // );
  return result;
}

/**
 * Traditional paginated hybrid query with keepPreviousData for smooth page transitions
 * Use this when you need discrete page navigation (Previous/Next buttons)
 */
export function useHybridPaginatedQuery<T extends Record<string, unknown>>(
  options: HybridQueryOptions<T> & {
    page: number;
    pageSize: number;
  }
) {
  const { page, pageSize, ...hybridOptions } = options;

  return useHybridQuery({
    ...hybridOptions,
    queryKey: [...hybridOptions.queryKey, 'paginated', page, pageSize],
    placeholderData: keepPreviousData // Smooth page transitions
  });
}
