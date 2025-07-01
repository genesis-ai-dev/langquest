import { system } from '@/db/powersync/system';
import type { CompilableQuery } from '@powersync/react-native';
import { parseQuery } from '@powersync/react-native';
import { useQuery } from '@powersync/tanstack-react-query';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { keepPreviousData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
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

  const hybridQueryKey = [...queryKey, isOnline];
  const oppositeQueryKey = [...queryKey, !isOnline];
  // const cachedData = queryClient.getQueryData<T[]>(hybridQueryKey);
  const cachedOppositeData = queryClient.getQueryData<T[]>(oppositeQueryKey);
  // const cachedQueryState = queryClient.getQueryState<T[]>(hybridQueryKey);
  const oppositeCachedQueryState =
    queryClient.getQueryState<T[]>(oppositeQueryKey);

  const sharedQueryOptions = {
    queryKey: hybridQueryKey,
    initialData: cachedOppositeData,
    initialDataUpdatedAt: oppositeCachedQueryState?.dataUpdatedAt,
    // networkMode: 'always' as NetworkMode,
    select: (data: T[]) => {
      // Note: The select function in React Query only triggers re-renders when the selected data changes.
      // Current implementation merges cached and new data using a Map to deduplicate by ID.
      // This approach may cause unnecessary re-renders since we're not optimizing for the user's select function.
      // Consider implementing a more efficient data merging strategy that respects the user's select function.
      const combinedMap = new Map<string | number, T>();
      [...(cachedOppositeData ?? []), ...data].forEach((item) => {
        combinedMap.set(getId(item), item);
      });
      return select
        ? select(Array.from(combinedMap.values()))
        : Array.from(combinedMap.values());
    },
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

  if (isOnline)
    return useQuery({
      ...sharedQueryOptions,
      queryFn: onlineFn,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      networkMode: 'always'
    });

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
 *   offlineQuery: toCompilableQuery(system.db.query.project.findMany({
 *     where: (fields, { eq }) => eq(fields.visible, true)
 *   })),
 *   isOnline: navigator.onLine // Optional: will default to navigator.onLine
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
      // For PowerSync/Drizzle queries, we need to execute the query
      if (typeof restConfig.offlineQuery === 'string') {
        const parsedQuery = parseQuery(restConfig.offlineQuery, []);
        return await system.powersync.getAll<T>(
          parsedQuery.sqlStatement,
          parsedQuery.parameters
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
interface HybridInfiniteQueryOptions<T extends Record<string, unknown>, TPageParam = unknown> {
  queryKey: readonly unknown[];
  onlineFn: (context: { pageParam: TPageParam }) => Promise<HybridPageData<T, TPageParam>>;
  offlineFn: (context: { pageParam: TPageParam }) => Promise<HybridPageData<T, TPageParam>>;
  initialPageParam: TPageParam;
  getNextPageParam: (lastPage: HybridPageData<T, TPageParam>) => TPageParam | undefined;
  getPreviousPageParam?: (firstPage: HybridPageData<T, TPageParam>) => TPageParam | undefined;
  getId?: (record: T | Partial<T>) => string | number;
  enabled?: boolean;
  staleTime?: number;
  gcTime?: number;
  refetchOnMount?: boolean;
  refetchOnWindowFocus?: boolean;
  refetchOnReconnect?: boolean;
}

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
export function useHybridInfiniteQuery<T extends Record<string, unknown>, TPageParam = unknown>(
  options: HybridInfiniteQueryOptions<T, TPageParam>
) {
  const {
    queryKey,
    onlineFn,
    offlineFn,
    initialPageParam,
    getNextPageParam,
    getPreviousPageParam,
    ...restOptions
  } = options;

  const isOnline = useNetworkStatus();
  const queryClient = useQueryClient();

  // Create network-aware query keys for better cache management
  const hybridQueryKey = [...queryKey, 'infinite', isOnline];
  const oppositeQueryKey = [...queryKey, 'infinite', !isOnline];

  // Get cached data from opposite network state for initial data
  const oppositeCachedQueryState = queryClient.getQueryState(oppositeQueryKey);

  return useInfiniteQuery({
    queryKey: hybridQueryKey,
    queryFn: async (context) => {
      try {
        const { pageParam } = context;
        if (isOnline) {
          return await onlineFn({ pageParam: pageParam as TPageParam });
        } else {
          return await offlineFn({ pageParam: pageParam as TPageParam });
        }
      } catch (error) {
        console.error('HybridInfiniteQuery error:', error);
        throw error;
      }
    },
    initialPageParam,
    getNextPageParam,
    getPreviousPageParam,
    // Remove problematic initialData for now
    initialDataUpdatedAt: oppositeCachedQueryState?.dataUpdatedAt,
    // Use placeholderData for smooth transitions when switching between online/offline
    placeholderData: keepPreviousData,
    // Optimize for performance
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    // Network mode that works with both online and offline
    networkMode: 'always',
    // Refetch settings optimized for hybrid usage
    refetchOnReconnect: true,
    refetchOnWindowFocus: false, // Prevent excessive refetching
    refetchOnMount: true,
    ...restOptions
  });
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
    placeholderData: keepPreviousData, // Smooth page transitions
  });
}
