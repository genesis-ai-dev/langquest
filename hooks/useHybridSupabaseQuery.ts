import { system } from '@/db/powersync/system';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useQuery as usePowerSyncQuery } from '@powersync/tanstack-react-query';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { QueryFunctionContext } from '@tanstack/react-query';
import {
  keepPreviousData,
  useInfiniteQuery,
  useQueryClient,
  useQuery as useTanStackQuery
} from '@tanstack/react-query';
import React, { useEffect, useRef } from 'react';
import { getNetworkStatus, useNetworkStatus } from './useNetworkStatus';

/**
 * Helper function to replace SQL placeholders (?) with actual parameter values
 */
function substituteParams(sql: string, params: unknown[]): string {
  let paramIndex = 0;
  return sql.replace(/\?/g, () => {
    if (paramIndex >= params.length) {
      throw new Error('Not enough parameters for SQL placeholders');
    }

    const param = params[paramIndex++];

    if (param === null || param === undefined) {
      return 'NULL';
    }

    if (typeof param === 'string') {
      // Escape single quotes and wrap in quotes
      return `'${param.replace(/'/g, "''")}'`;
    }

    if (typeof param === 'number' || typeof param === 'boolean') {
      return String(param);
    }

    if (param instanceof Date) {
      return `'${param.toISOString()}'`;
    }

    if (typeof param === 'object') {
      // For objects and arrays, use JSON stringification
      return `'${JSON.stringify(param).replace(/'/g, "''")}'`;
    }

    // For primitive types not handled above
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    return `'${String(param).replace(/'/g, "''")}'`;
  });
}

/**
 * Base options that are common to both online and offline queries
 */
type GetQueryParam<T> = Parameters<typeof useTanStackQuery<T[], Error, T[]>>[0];

/**
 * Configuration for hybrid Supabase queries - supports both unified and separate queries
 */
type HybridSupabaseQueryConfig<T extends Record<string, unknown>> = (
  | {
      /**
       * Unified query that will be executed differently based on network status
       * - Online: Converted to SQL and sent via SQLTR
       * - Offline: Compiled to PowerSync query
       */
      query: Parameters<typeof toCompilableQuery<T>>[0];
      onlineFn?: never;
      offlineQuery?: never;
      offlineFn?: never;
    }
  | {
      /**
       * Separate online function for custom online behavior
       */
      onlineFn: GetQueryParam<T>['queryFn'];
      /**
       * Offline query using Drizzle query builder
       */
      offlineQuery: Parameters<typeof toCompilableQuery<T>>[0] | string;
      query?: never;
      offlineFn?: never;
    }
  | {
      /**
       * Separate online function for custom online behavior
       */
      onlineFn: GetQueryParam<T>['queryFn'];
      /**
       * Offline function for custom offline behavior
       */
      offlineFn: GetQueryParam<T>['queryFn'];
      query?: never;
      offlineQuery?: never;
    }
) & {
  /**
   * Function to get the ID of a record. Defaults to (record) => record.id
   */
  getId?: (record: T | Partial<T>) => string | number;
};

/**
 * Options for hybrid Supabase queries
 */
type HybridSupabaseQueryOptions<T extends Record<string, unknown>> = Omit<
  GetQueryParam<T>,
  'queryFn' | 'query'
> &
  HybridSupabaseQueryConfig<T>;

/**
 * useHybridSupabaseQuery
 *
 * A hook that automatically chooses between an online Supabase SQLTR query and an offline Drizzle query,
 * depending on network connectivity. Includes dual cache system for seamless online/offline transitions.
 *
 * @example
 * // Using unified query
 * const { data, isLoading, error } = useHybridSupabaseQuery({
 *   queryKey: ['projects'],
 *   query: db.select().from(projectTable).where(eq(projectTable.visible, true)),
 * });
 *
 * // Using separate queries
 * const { data, isLoading, error } = useHybridSupabaseQuery({
 *   queryKey: ['projects'],
 *   onlineFn: async () => {
 *     const response = await supabase.from('project').select('*').eq('visible', true);
 *     return response.data || [];
 *   },
 *   offlineQuery: db.select().from(projectTable).where(eq(projectTable.visible, true)),
 * });
 */
export function useHybridSupabaseQuery<T extends Record<string, unknown>>(
  options: HybridSupabaseQueryOptions<T>
) {
  const {
    queryKey,
    select,
    getId = (record: T | Partial<T>) =>
      (record as unknown as { id: string | number }).id,
    ...restOptions
  } = options;
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
    refetchOnMount: false // Don't refetch if we have data
  };

  // Determine online query function
  const getOnlineQueryFn = () => {
    if ('onlineFn' in options && options.onlineFn) {
      return options.onlineFn;
    } else if ('query' in options && options.query) {
      return async () => {
        const data = options.query.toSQL();
        const finalSql = substituteParams(data.sql, data.params);
        const response = await fetch(
          `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/sqltr`,
          {
            headers: {
              Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`
            },
            method: 'POST',
            body: JSON.stringify({ sql: finalSql })
          }
        );
        return (await response.json()) as T[];
      };
    }
    throw new Error('Either query or onlineFn must be provided');
  };

  if (isOnline) {
    return useTanStackQuery({
      ...sharedQueryOptions,
      ...restOptions,
      queryFn: getOnlineQueryFn(),
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      networkMode: 'always'
    });
  } else {
    // Handle offline query
    if ('offlineFn' in options && options.offlineFn) {
      return useTanStackQuery({
        ...sharedQueryOptions,
        ...restOptions,
        queryFn: options.offlineFn
      });
    } else if (options.offlineQuery || options.query) {
      const offlineQuery = options.offlineQuery ?? options.query;
      return usePowerSyncQuery({
        ...sharedQueryOptions,
        ...restOptions,
        query:
          typeof offlineQuery === 'string'
            ? offlineQuery
            : toCompilableQuery<T>(offlineQuery)
      });
    } else {
      throw new Error(
        'Either query, offlineQuery, or offlineFn must be provided'
      );
    }
  }
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
type HybridSupabaseFetchConfig<T> = (
  | {
      query: Parameters<typeof toCompilableQuery<T>>[0] | string;
      onlineFn?: never;
      offlineQuery?: never;
      offlineFn?: never;
    }
  | {
      onlineFn: () => Promise<T[]>;
      offlineQuery: Parameters<typeof toCompilableQuery<T>>[0] | string;
      query?: never;
      offlineFn?: never;
    }
  | {
      onlineFn: () => Promise<T[]>;
      offlineFn: () => Promise<T[]>;
      query?: never;
      offlineQuery?: never;
    }
) & {
  queryKey: GetQueryParam<T>['queryKey'];
};

/**
 * hybridSupabaseFetch
 *
 * A standalone function that automatically chooses between online and offline queries,
 * depending on network connectivity. Can be used outside of React components.
 *
 * @example
 * // Using unified query
 * const projects = await hybridSupabaseFetch({
 *   query: db.select().from(projectTable).where(eq(projectTable.visible, true)),
 *   queryKey: ['projects']
 * });
 *
 * // Using separate functions
 * const projects = await hybridSupabaseFetch({
 *   onlineFn: async () => {
 *     const response = await supabase.from('project').select('*').eq('visible', true);
 *     return response.data || [];
 *   },
 *   offlineQuery: db.select().from(projectTable).where(eq(projectTable.visible, true)),
 *   queryKey: ['projects']
 * });
 */
export async function hybridSupabaseFetch<
  T extends Record<string, unknown> | undefined
>(config: HybridSupabaseFetchConfig<T>) {
  const { queryKey: _queryKey, ...restConfig } = config;

  const runOfflineQuery = async () => {
    if (restConfig.offlineFn) {
      return await restConfig.offlineFn();
    } else if (restConfig.offlineQuery) {
      if (typeof restConfig.offlineQuery === 'string') {
        return (await system.powersync.execute(
          restConfig.offlineQuery
        )) as unknown as T[];
      }
      return await toCompilableQuery<T>(restConfig.offlineQuery).execute();
    } else if ('query' in restConfig && restConfig.query) {
      if (typeof restConfig.query === 'string') {
        return (await system.powersync.execute(
          restConfig.query
        )) as unknown as T[];
      }
      return await toCompilableQuery<T>(restConfig.query).execute();
    } else {
      throw new Error(
        'Either query, offlineQuery, or offlineFn must be provided'
      );
    }
  };

  const runOnlineQuery = async () => {
    if (restConfig.onlineFn) {
      return await restConfig.onlineFn();
    } else if ('query' in restConfig) {
      if (typeof restConfig.query === 'string') {
        return (await system.powersync.execute(
          restConfig.query
        )) as unknown as T[];
      }
      const data = restConfig.query.toSQL();
      const finalSql = substituteParams(data.sql, data.params);
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/sqltr`,
        {
          headers: {
            Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
          },
          method: 'POST',
          body: JSON.stringify({ sql: finalSql })
        }
      );
      return (await response.json()) as T[];
    } else {
      throw new Error('Either query or onlineFn must be provided');
    }
  };

  const isOnline = getNetworkStatus();
  if (isOnline) {
    try {
      return await runOnlineQuery();
    } catch {
      return await runOfflineQuery();
    }
  } else {
    return await runOfflineQuery();
  }
}

/**
 * Page data structure for hybrid infinite queries
 */
interface HybridPageData<T> {
  data: T[];
  nextCursor?: number | undefined;
  hasMore?: boolean;
  totalCount?: number;
}

/**
 * Extract parameter types from useInfiniteQuery
 */
type GetInfiniteQueryParam<T> = Parameters<
  typeof useInfiniteQuery<HybridPageData<T>>
>[0];

interface InfiniteQueryContext<T>
  extends QueryFunctionContext<GetQueryParam<T>['queryKey'], number> {
  pageSize: number;
}

/**
 * Configuration for hybrid infinite queries
 */
type HybridSupabaseInfiniteQueryOptions<T> = Omit<
  GetInfiniteQueryParam<T>,
  'queryFn' | 'initialPageParam' | 'getNextPageParam' | 'getPreviousPageParam'
> &
  (
    | {
        onlineFn: (context: InfiniteQueryContext<T>) => Promise<T[]>;
        offlineQuery: (
          context: InfiniteQueryContext<T>
        ) => Parameters<typeof toCompilableQuery<T>>[0];
        query?: never;
        offlineFn?: never;
      }
    | {
        onlineFn: (context: InfiniteQueryContext<T>) => Promise<T[]>;
        offlineFn: (context: InfiniteQueryContext<T>) => Promise<T[]>;
        query?: never;
        offlineQuery?: never;
      }
    | {
        query: (
          context: InfiniteQueryContext<T>
        ) => Parameters<typeof toCompilableQuery<T>>[0] | string;
        onlineFn?: never;
        offlineQuery?: never;
        offlineFn?: never;
      }
  ) & {
    pageSize: number;
    getId?: (record: T | Partial<T>) => string | number;
  };

/**
 * useHybridSupabaseInfiniteQuery
 *
 * A hook that provides infinite scrolling with automatic online/offline switching for Supabase.
 *
 * @example
 * // Using unified query
 * const { data, fetchNextPage, hasNextPage } = useHybridSupabaseInfiniteQuery({
 *   queryKey: ['assets', 'paginated', questId],
 *   query: (pageParam, pageSize) => db.select().from(assetTable).limit(pageSize).offset(pageParam * pageSize),
 *   pageSize: 20
 * });
 *
 * // Using separate queries
 * const { data, fetchNextPage, hasNextPage } = useHybridSupabaseInfiniteQuery({
 *   queryKey: ['assets', 'paginated', questId],
 *   onlineFn: async (pageParam, pageSize) => {
 *     const response = await supabase
 *       .from('asset')
 *       .select('*')
 *       .range(pageParam * pageSize, (pageParam + 1) * pageSize - 1);
 *     return response.data || [];
 *   },
 *   offlineQuery: (pageParam, pageSize) => db.select().from(assetTable).limit(pageSize).offset(pageParam * pageSize),
 *   pageSize: 20
 * });
 */
export function useHybridSupabaseInfiniteQuery<T>(
  options: HybridSupabaseInfiniteQueryOptions<T>
) {
  const timestamp = performance.now();

  const { queryKey, pageSize = 10, ...restOptions } = options;

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
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    getPreviousPageParam: (firstPage) => firstPage.nextCursor,
    initialDataUpdatedAt: oppositeCachedQueryState?.dataUpdatedAt,
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
    networkMode: 'always',
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    ...restOptions
  } satisfies GetInfiniteQueryParam<T>;

  return useInfiniteQuery({
    ...sharedOptions,
    queryFn: async (context) => {
      let results: T[] = [];

      const completeContext = {
        ...context,
        pageSize,
        pageParam: context.pageParam as number
      } satisfies InfiniteQueryContext<T>;

      if (isOnline) {
        // Handle online query
        if (options.onlineFn) {
          results = await options.onlineFn(completeContext);
        } else if ('query' in options) {
          const sqlQuery = options.query(completeContext);
          const data =
            typeof sqlQuery === 'string' ? sqlQuery : sqlQuery.toSQL();
          const finalSql =
            typeof data === 'string'
              ? data
              : substituteParams(data.sql, data.params);
          const response = await fetch(
            `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/sqltr`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ sql: finalSql })
            }
          );
          if (!response.ok) {
            const err = `${JSON.stringify(hybridQueryKey)} ${await response.text()} ${finalSql}`;
            console.error(err);
            throw new Error(err);
          }
          results = (await response.json()) as T[];
        } else {
          throw new Error('Either query or onlineFn must be provided');
        }
      } else {
        // Handle offline query
        if (options.offlineFn) {
          results = await options.offlineFn(completeContext);
        } else if (options.offlineQuery) {
          const sqlQuery = options.offlineQuery(completeContext);
          const compiledQuery = toCompilableQuery(sqlQuery);
          results = await compiledQuery.execute();
        } else if ('query' in options) {
          const sqlQuery = options.query(completeContext);
          if (typeof sqlQuery === 'string') {
            results = (await system.powersync.execute(
              sqlQuery
            )) as unknown as T[];
          } else {
            const compiledQuery = toCompilableQuery(sqlQuery);
            results = await compiledQuery.execute();
          }
        } else {
          throw new Error(
            'Either query, offlineQuery, or offlineFn must be provided'
          );
        }
      }

      // console.log(`data ${JSON.stringify(results)}`);
      // console.log(
      //   `[${performance.now() - timestamp}ms] useHybridSupabaseInfiniteQuery (${isOnline ? 'online' : 'offline'}) ${JSON.stringify(hybridQueryKey)}`
      // );
      return {
        data: results,
        nextCursor:
          results.length === pageSize
            ? completeContext.pageParam + 1
            : undefined,
        hasMore: results.length === pageSize
      } satisfies HybridPageData<T>;
    }
  });
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

/**
 * Helper function to create hybrid infinite query config
 */
export function createHybridSupabaseInfiniteQueryConfig<
  T extends Record<string, unknown>
>(options: HybridSupabaseInfiniteQueryOptions<T>) {
  return options;
}

/**
 * Combined options for hybrid infinite realtime query
 */
type HybridSupabaseInfiniteRealtimeQueryOptions<
  T extends Record<string, unknown>
> = HybridSupabaseInfiniteQueryOptions<T> & RealtimeSubscriptionOptions<T>;

/**
 * useHybridSupabaseInfiniteRealtimeQuery
 *
 * Combines infinite scrolling with realtime subscriptions for Supabase.
 * Automatically handles cache updates for paginated data when realtime events occur.
 *
 * @example
 * const {
 *   data,
 *   fetchNextPage,
 *   hasNextPage
 * } = useHybridSupabaseInfiniteRealtimeQuery({
 *   queryKey: ['assets', 'paginated', questId],
 *   query: (pageParam) => db.select().from(assetTable).limit(20).offset(pageParam * 20),
 *   pageSize: 20,
 *   subscribeRealtime: (onChange) => {
 *     const channel = system.supabaseConnector.client
 *       .channel('public:asset')
 *       .on('postgres_changes', { event: '*', schema: 'public', table: 'asset' }, onChange);
 *     channel.subscribe();
 *     return () => system.supabaseConnector.client.removeChannel(channel)
 *   },
 *   getId: (asset) => asset.id,
 * });
 */
export function useHybridSupabaseInfiniteRealtimeQuery<
  T extends Record<string, unknown>
>({
  queryKey,
  subscribeRealtime,
  getId = (record: T | Partial<T>) =>
    (record as unknown as { id: string | number }).id,
  ...restOptions
}: HybridSupabaseInfiniteRealtimeQueryOptions<T>) {
  const queryClient = useQueryClient();
  const realtimeChannelRef = useRef<ReturnType<
    typeof subscribeRealtime
  > | null>(null);

  const isOnline = useNetworkStatus();

  // Use the base hybrid infinite query
  const result = useHybridSupabaseInfiniteQuery<T>({
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

    // Subscribe with automatic cache management for infinite queries
    const subscription = subscribeRealtime((payload) => {
      const { eventType, new: newRow, old: oldRow } = payload;

      // Build the cache key for infinite queries
      const hasInfinite = queryKey.includes('infinite');
      const baseKey = hasInfinite ? queryKey : [...queryKey, 'infinite'];
      const cleanBaseKey = baseKey.filter(
        (key: unknown) => key !== undefined && key !== null
      );
      const cacheKey = [...cleanBaseKey, 'online'];

      queryClient.setQueryData<{
        pages: HybridPageData<T>[];
        pageParams: number[];
      }>(cacheKey, (prev) => {
        if (!prev) return prev;

        const newPages = [...prev.pages];

        switch (eventType) {
          case 'INSERT': {
            const recordId = getId(newRow);

            // Check if record already exists in any page to avoid duplicates
            const existsInPages = newPages.some((page) =>
              page.data.some((record) => getId(record) === recordId)
            );

            if (!existsInPages && newPages.length > 0) {
              // Add to the first page (most recent data)
              newPages[0] = {
                ...newPages[0],
                data: [newRow, ...newPages[0]!.data]
              };
            }
            break;
          }

          case 'UPDATE': {
            const recordId = getId(newRow);

            // Find and update the record in whichever page it exists
            for (let i = 0; i < newPages.length; i++) {
              const page = newPages[i];
              if (page) {
                const recordIndex = page.data.findIndex(
                  (record) => getId(record) === recordId
                );

                if (recordIndex !== -1) {
                  const newPageData = [...page.data];
                  newPageData[recordIndex] = newRow;
                  newPages[i] = {
                    ...page,
                    data: newPageData
                  };
                  break;
                }
              }
            }
            break;
          }

          case 'DELETE': {
            const recordId = getId(oldRow);

            // Find and remove the record from whichever page it exists
            for (let i = 0; i < newPages.length; i++) {
              const page = newPages[i];
              if (page) {
                const recordIndex = page.data.findIndex(
                  (record) => getId(record) === recordId
                );

                if (recordIndex !== -1) {
                  const newPageData = page.data.filter(
                    (record) => getId(record) !== recordId
                  );
                  newPages[i] = {
                    ...page,
                    data: newPageData
                  };
                  break;
                }
              }
            }
            break;
          }

          default: {
            console.warn(
              'useHybridSupabaseInfiniteRealtimeQuery: Unhandled event type',
              eventType
            );
            break;
          }
        }

        return {
          ...prev,
          pages: newPages
        };
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
