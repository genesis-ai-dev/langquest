import { system } from '@/db/powersync/system';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { QueryFunctionContext } from '@tanstack/react-query';
import {
  useInfiniteQuery,
  useQueryClient,
  useQuery as useTanStackQuery
} from '@tanstack/react-query';
import React, { useEffect } from 'react';
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
 * A hook that always queries local/offline data first, then cloud data when available,
 * and merges them with local data taking priority. Follows the offline-first pattern.
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

  // Filter out undefined/null values from the query key
  const cleanQueryKey = queryKey.filter(
    (key) => key !== undefined && key !== null
  );

  // Always query local data
  const localQueryKey = [...cleanQueryKey, 'local'];
  const cloudQueryKey = [...cleanQueryKey, 'cloud'];

  // Determine local query function
  const getLocalQueryFn = () => {
    if ('offlineFn' in options && options.offlineFn) {
      return options.offlineFn;
    } else if (options.offlineQuery) {
      return async () => {
        const offlineQuery = options.offlineQuery;
        if (typeof offlineQuery === 'string') {
          const result = await system.powersync.execute(offlineQuery);
          const rows: T[] = [];
          if (result.rows) {
            for (let i = 0; i < result.rows.length; i++) {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              const item = result.rows.item(i);
              if (item) {
                rows.push(item as T);
              }
            }
          }
          return rows;
        }
        return await toCompilableQuery<T>(offlineQuery).execute();
      };
    } else if ('query' in options && options.query) {
      return async () => {
        const query = options.query;
        if (typeof query === 'string') {
          const result = await system.powersync.execute(query);
          const rows: T[] = [];
          if (result.rows) {
            for (let i = 0; i < result.rows.length; i++) {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              const item = result.rows.item(i);
              if (item) {
                rows.push(item as T);
              }
            }
          }
          return rows;
        }
        return await toCompilableQuery<T>(query).execute();
      };
    }
    throw new Error(
      'Either query, offlineQuery, or offlineFn must be provided'
    );
  };

  // Determine cloud query function
  const getCloudQueryFn = () => {
    if ('onlineFn' in options && options.onlineFn) {
      return options.onlineFn;
    } else if ('query' in options && options.query) {
      return async () => {
        const query = options.query;
        if (typeof query === 'string') {
          const result = await system.powersync.execute(query);
          const rows: T[] = [];
          if (result.rows) {
            for (let i = 0; i < result.rows.length; i++) {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              const item = result.rows.item(i);
              if (item) {
                rows.push(item as T);
              }
            }
          }
          return rows;
        }
        const data = query.toSQL();
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
      };
    }
    throw new Error('Either query or onlineFn must be provided');
  };

  // Query local data (always enabled)
  const localQuery = useTanStackQuery({
    queryKey: localQueryKey,
    queryFn: getLocalQueryFn(),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    ...restOptions
  });

  // Query cloud data (only when online)
  const cloudQuery = useTanStackQuery({
    queryKey: cloudQueryKey,
    queryFn: getCloudQueryFn(),
    enabled: isOnline,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    networkMode: 'always',
    ...restOptions
  });

  // Merge data with local priority
  const mergedData = React.useMemo(() => {
    // Ensure we have arrays to work with, handling undefined/null cases
    const localData = Array.isArray(localQuery.data) ? localQuery.data : [];
    const cloudData = Array.isArray(cloudQuery.data) ? cloudQuery.data : [];

    // If no data available yet, return empty array
    if (localData.length === 0 && cloudData.length === 0) {
      return [];
    }

    // Create map for local data for quick lookup
    const localDataMap = new Map(localData.map((item) => [getId(item), item]));

    // Start with a map to hold the merged results
    const mergedMap = new Map<string | number, T>();

    // Add all local data first
    localData.forEach((item) => {
      mergedMap.set(getId(item), item);
    });

    // Process cloud data
    cloudData.forEach((cloudItem) => {
      const id = getId(cloudItem);
      const localItem = localDataMap.get(id);

      if (!localItem) {
        // Cloud item doesn't exist locally, add it
        mergedMap.set(id, cloudItem);
      } else {
        // Item exists in both - compare last_updated timestamps
        const localLastUpdated = (localItem as T & { last_updated?: string })
          .last_updated;
        const cloudLastUpdated = (cloudItem as T & { last_updated?: string })
          .last_updated;

        // If cloud version is newer, use it
        if (
          cloudLastUpdated &&
          localLastUpdated &&
          new Date(cloudLastUpdated).getTime() >
            new Date(localLastUpdated).getTime()
        ) {
          mergedMap.set(id, cloudItem);
        }
        // Otherwise keep the local version (already in mergedMap)
      }
    });

    // Convert map back to array
    return Array.from(mergedMap.values());
  }, [localQuery.data, cloudQuery.data, getId]);

  // Apply user's select function if provided
  const finalData = React.useMemo(() => {
    return select ? select(mergedData) : mergedData;
  }, [mergedData, select]);

  return {
    data: finalData,
    isLoading: localQuery.isLoading || (isOnline && cloudQuery.isLoading),
    error: localQuery.error || cloudQuery.error,
    isError: localQuery.isError || cloudQuery.isError,
    isFetching: localQuery.isFetching || cloudQuery.isFetching,
    isSuccess: localQuery.isSuccess,
    refetch: () => {
      void localQuery.refetch();
      if (isOnline) void cloudQuery.refetch();
    },
    // Include other query result properties
    dataUpdatedAt: Math.max(
      localQuery.dataUpdatedAt,
      cloudQuery.dataUpdatedAt || 0
    ),
    errorUpdatedAt: Math.max(
      localQuery.errorUpdatedAt,
      cloudQuery.errorUpdatedAt || 0
    ),
    failureCount: localQuery.failureCount + cloudQuery.failureCount,
    failureReason: localQuery.failureReason || cloudQuery.failureReason,
    fetchStatus: localQuery.fetchStatus,
    isInitialLoading:
      localQuery.isInitialLoading || (isOnline && cloudQuery.isInitialLoading),
    isLoadingError: localQuery.isLoadingError || cloudQuery.isLoadingError,
    isPaused: localQuery.isPaused || cloudQuery.isPaused,
    isPlaceholderData:
      localQuery.isPlaceholderData || cloudQuery.isPlaceholderData,
    isRefetchError: localQuery.isRefetchError || cloudQuery.isRefetchError,
    isRefetching: localQuery.isRefetching || cloudQuery.isRefetching,
    isStale: localQuery.isStale || cloudQuery.isStale,
    status: localQuery.isError
      ? 'error'
      : localQuery.isLoading
        ? 'pending'
        : 'success'
  };
}
/**
 * Options for the realtime subscription
 */
interface RealtimeSubscriptionOptions<T extends Record<string, unknown>> {
  channelName: string;
  subscriptionConfig: {
    table: string;
    schema: string;
    filter?: string;
  };
  /**
   * Function to get the ID of a record. Defaults to (record) => record.id
   */
  getId?: (record: T | Partial<T>) => string | number;
}

/**
 * Combined options for hybrid realtime query
 */
type HybridSupabaseRealtimeQueryOptions<T extends Record<string, unknown>> =
  HybridSupabaseQueryOptions<T> & RealtimeSubscriptionOptions<T>;

/**
 * useHybridSupabaseRealtimeQuery
 *
 * Always queries local data first, then cloud data when available, merges with local priority,
 * and sets up realtime subscriptions to keep cloud data updated.
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
  channelName,
  subscriptionConfig,
  getId = (record: T | Partial<T>) =>
    (record as unknown as { id: string | number }).id,
  ...restOptions
}: HybridSupabaseRealtimeQueryOptions<T>) {
  const queryClient = useQueryClient();

  const isOnline = useNetworkStatus();

  // Use the base hybrid query with offline-first pattern
  const result = useHybridSupabaseQuery<T>({
    queryKey,
    ...restOptions
  });

  useEffect(() => {
    if (!isOnline) return;

    const channel = system.supabaseConnector.client
      .channel(channelName)
      .on(
        'postgres_changes',
        { ...subscriptionConfig, event: '*' },
        (payload: RealtimePostgresChangesPayload<T>) => {
          {
            const { eventType, new: newRow, old: oldRow } = payload;
            const cloudCacheKey = [...queryKey, 'cloud'];

            queryClient.setQueryData<T[]>(cloudCacheKey, (prev = []) => {
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
          }
        }
      );
    channel.subscribe();

    return () => {
      void channel.unsubscribe().then((value) => {
        if (value === 'error' || value === 'timed out')
          throw new Error(
            `There was an issue unsubscribing from a realtime channel with queryKey ${JSON.stringify(queryKey)}`
          );
      });
    };
  }, [
    isOnline,
    channelName,
    subscriptionConfig,
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
 * A standalone function that always fetches local data first, then cloud data when available,
 * and merges with local priority. Can be used outside of React components.
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

  const runLocalQuery = async () => {
    if (restConfig.offlineFn) {
      return await restConfig.offlineFn();
    } else if (restConfig.offlineQuery) {
      if (typeof restConfig.offlineQuery === 'string') {
        const result = await system.powersync.execute(restConfig.offlineQuery);
        const rows: T[] = [];
        if (result.rows) {
          for (let i = 0; i < result.rows.length; i++) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const item = result.rows.item(i);
            if (item) {
              rows.push(item as T);
            }
          }
        }
        return rows;
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

  const runCloudQuery = async () => {
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

  // Always fetch local data first
  const localData = await runLocalQuery();

  // Try to fetch cloud data if online
  const isOnline = getNetworkStatus();
  let cloudData: T[] = [];

  if (isOnline) {
    try {
      cloudData = await runCloudQuery();
    } catch (error) {
      console.warn(
        'hybridSupabaseFetch: Cloud query failed, using local data only',
        error
      );
    }
  }

  // Merge with local priority
  const localDataArray = Array.isArray(localData) ? localData : [];
  const cloudDataArray = Array.isArray(cloudData) ? cloudData : [];

  // Create map for local data for quick lookup
  const localDataMap = new Map(
    localDataArray.map((item) => [
      (item as unknown as { id: string | number }).id,
      item
    ])
  );

  // Start with a map to hold the merged results
  const mergedMap = new Map<string | number, T>();

  // Add all local data first
  localDataArray.forEach((item) => {
    mergedMap.set((item as unknown as { id: string | number }).id, item);
  });

  // Process cloud data
  cloudDataArray.forEach((cloudItem) => {
    const id = (cloudItem as unknown as { id: string | number }).id;
    const localItem = localDataMap.get(id);

    if (!localItem) {
      // Cloud item doesn't exist locally, add it
      mergedMap.set(id, cloudItem);
    } else {
      // Item exists in both - compare last_updated timestamps
      const localLastUpdated = (localItem as T & { last_updated?: string })
        .last_updated;
      const cloudLastUpdated = (cloudItem as T & { last_updated?: string })
        .last_updated;

      // If cloud version is newer, use it
      if (
        cloudLastUpdated &&
        localLastUpdated &&
        new Date(cloudLastUpdated).getTime() >
          new Date(localLastUpdated).getTime()
      ) {
        mergedMap.set(id, cloudItem);
      }
      // Otherwise keep the local version (already in mergedMap)
    }
  });

  // Convert map back to array
  return Array.from(mergedMap.values());
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
 * A hook that provides infinite scrolling with offline-first pattern.
 * Always queries local data first, then cloud data when available, and merges with local priority.
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
  const {
    queryKey,
    pageSize = 10,
    getId = (record: T | Partial<T>) =>
      (record as unknown as { id: string | number }).id,
    ...restOptions
  } = options;
  const isOnline = useNetworkStatus();

  // Filter out undefined/null values from the query key
  const cleanQueryKey = queryKey.filter(
    (key: unknown) => key !== undefined && key !== null
  );

  // Create separate query keys for local and cloud data
  const hasInfinite = cleanQueryKey.includes('infinite');
  const baseKey = hasInfinite ? cleanQueryKey : [...cleanQueryKey, 'infinite'];
  const localQueryKey = [...baseKey, 'local'];
  const cloudQueryKey = [...baseKey, 'cloud'];

  // Local infinite query (always enabled)
  const localQuery = useInfiniteQuery({
    queryKey: localQueryKey,
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    getPreviousPageParam: (firstPage) => firstPage.nextCursor,
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    ...restOptions,
    queryFn: async (context) => {
      const completeContext = {
        ...context,
        pageSize,
        pageParam: context.pageParam as number
      } satisfies InfiniteQueryContext<T>;

      let results: T[] = [];

      // Handle local query
      if (options.offlineFn) {
        results = await options.offlineFn(completeContext);
      } else if (options.offlineQuery) {
        const sqlQuery = options.offlineQuery(completeContext);
        const compiledQuery = toCompilableQuery(sqlQuery);
        results = await compiledQuery.execute();
      } else if ('query' in options) {
        const sqlQuery = options.query(completeContext);
        if (typeof sqlQuery === 'string') {
          const result = await system.powersync.execute(sqlQuery);
          const rows: T[] = [];
          if (result.rows) {
            for (let i = 0; i < result.rows.length; i++) {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              const item = result.rows.item(i);
              if (item) {
                rows.push(item as T);
              }
            }
          }
          results = rows;
        } else {
          const compiledQuery = toCompilableQuery(sqlQuery);
          results = await compiledQuery.execute();
        }
      } else {
        throw new Error(
          'Either query, offlineQuery, or offlineFn must be provided'
        );
      }

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

  // Cloud infinite query (only when online)
  const cloudQuery = useInfiniteQuery({
    queryKey: cloudQueryKey,
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    getPreviousPageParam: (firstPage) => firstPage.nextCursor,
    enabled: isOnline,
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    networkMode: 'always',
    ...restOptions,
    queryFn: async (context) => {
      const completeContext = {
        ...context,
        pageSize,
        pageParam: context.pageParam as number
      } satisfies InfiniteQueryContext<T>;

      let results: T[] = [];

      // Handle cloud query
      if (options.onlineFn) {
        results = await options.onlineFn(completeContext);
      } else if ('query' in options) {
        const sqlQuery = options.query(completeContext);
        const data = typeof sqlQuery === 'string' ? sqlQuery : sqlQuery.toSQL();
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
          const err = `${JSON.stringify(cloudQueryKey)} ${await response.text()} ${finalSql}`;
          console.error(err);
          throw new Error(err);
        }
        results = (await response.json()) as T[];
      } else {
        throw new Error('Either query or onlineFn must be provided');
      }

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

  // Merge pages with local priority
  const mergedData = React.useMemo(() => {
    const localPages = localQuery.data?.pages || [];
    const cloudPages = cloudQuery.data?.pages || [];

    // Merge pages at the same level
    const maxPages = Math.max(localPages.length, cloudPages.length);
    const mergedPages: HybridPageData<T>[] = [];

    for (let i = 0; i < maxPages; i++) {
      const localPage = localPages[i];
      const cloudPage = cloudPages[i];

      if (localPage && cloudPage) {
        // Merge page data with local priority
        const localData = Array.isArray(localPage.data) ? localPage.data : [];
        const cloudData = Array.isArray(cloudPage.data) ? cloudPage.data : [];

        // Create map for local data for quick lookup
        const localDataMap = new Map(
          localData.map((item) => [getId(item), item])
        );

        // Start with a map to hold the merged results
        const mergedMap = new Map<string | number, T>();

        // Add all local data first
        localData.forEach((item) => {
          mergedMap.set(getId(item), item);
        });

        // Process cloud data
        cloudData.forEach((cloudItem) => {
          const id = getId(cloudItem);
          const localItem = localDataMap.get(id);

          if (!localItem) {
            // Cloud item doesn't exist locally, add it
            mergedMap.set(id, cloudItem);
          } else {
            // Item exists in both - compare last_updated timestamps
            const localLastUpdated = (
              localItem as T & { last_updated?: string }
            ).last_updated;
            const cloudLastUpdated = (
              cloudItem as T & { last_updated?: string }
            ).last_updated;

            // If cloud version is newer, use it
            if (
              cloudLastUpdated &&
              localLastUpdated &&
              new Date(cloudLastUpdated).getTime() >
                new Date(localLastUpdated).getTime()
            ) {
              mergedMap.set(id, cloudItem);
            }
            // Otherwise keep the local version (already in mergedMap)
          }
        });

        mergedPages.push({
          ...localPage,
          data: Array.from(mergedMap.values())
        });
      } else if (localPage) {
        mergedPages.push(localPage);
      } else if (cloudPage) {
        mergedPages.push(cloudPage);
      }
    }

    return {
      pages: mergedPages,
      pageParams:
        localQuery.data?.pageParams || cloudQuery.data?.pageParams || []
    };
  }, [localQuery.data, cloudQuery.data, getId]);

  return {
    data: mergedData,
    fetchNextPage: () => {
      void localQuery.fetchNextPage();
      if (isOnline) void cloudQuery.fetchNextPage();
    },
    fetchPreviousPage: () => {
      void localQuery.fetchPreviousPage();
      if (isOnline) void cloudQuery.fetchPreviousPage();
    },
    hasNextPage: localQuery.hasNextPage || cloudQuery.hasNextPage,
    hasPreviousPage: localQuery.hasPreviousPage || cloudQuery.hasPreviousPage,
    isFetchingNextPage:
      localQuery.isFetchingNextPage || cloudQuery.isFetchingNextPage,
    isFetchingPreviousPage:
      localQuery.isFetchingPreviousPage || cloudQuery.isFetchingPreviousPage,
    isLoading: localQuery.isLoading || (isOnline && cloudQuery.isLoading),
    isError: localQuery.isError || cloudQuery.isError,
    error: localQuery.error || cloudQuery.error,
    isFetching: localQuery.isFetching || cloudQuery.isFetching,
    isSuccess: localQuery.isSuccess,
    refetch: () => {
      void localQuery.refetch();
      if (isOnline) void cloudQuery.refetch();
    },
    status: localQuery.isError
      ? 'error'
      : localQuery.isLoading
        ? 'pending'
        : 'success'
  };
}

/**
 * Traditional paginated hybrid query with offline-first priority
 * Always queries local data first, then cloud data when available, and merges with local priority.
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
    queryKey: [...hybridOptions.queryKey, 'paginated', page, pageSize]
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
 * Combines infinite scrolling with realtime subscriptions using offline-first pattern.
 * Always queries local data first, then cloud data when available, merges with local priority,
 * and automatically handles cache updates for cloud data when realtime events occur.
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
 *   channelName: 'public:asset',
 *   subscriptionConfig: {
 *     table: 'asset',
 *     schema: 'public'
 *   },
 *   getId: (asset) => asset.id,
 * });
 */
export function useHybridSupabaseInfiniteRealtimeQuery<
  T extends Record<string, unknown>
>({
  queryKey,
  channelName,
  subscriptionConfig,
  getId = (record: T | Partial<T>) =>
    (record as unknown as { id: string | number }).id,
  ...restOptions
}: HybridSupabaseInfiniteRealtimeQueryOptions<T>) {
  const queryClient = useQueryClient();
  const isOnline = useNetworkStatus();

  // Use the base hybrid infinite query with offline-first pattern
  const result = useHybridSupabaseInfiniteQuery<T>({
    queryKey,
    getId,
    ...restOptions
  });

  useEffect(() => {
    if (!isOnline) return;

    const channel = system.supabaseConnector.client
      .channel(channelName)
      .on(
        'postgres_changes',
        { ...subscriptionConfig, event: '*' },
        (payload: RealtimePostgresChangesPayload<T>) => {
          const { eventType, new: newRow, old: oldRow } = payload;

          // Build the cache key for cloud infinite queries
          const cleanQueryKey = queryKey.filter(
            (key: unknown) => key !== undefined && key !== null
          );
          const hasInfinite = cleanQueryKey.includes('infinite');
          const baseKey = hasInfinite
            ? cleanQueryKey
            : [...cleanQueryKey, 'infinite'];
          const cloudCacheKey = [...baseKey, 'cloud'];

          queryClient.setQueryData<{
            pages: HybridPageData<T>[];
            pageParams: number[];
          }>(cloudCacheKey, (prev) => {
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
                    ...newPages[0]!,
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
        }
      );
    channel.subscribe();

    return () => {
      void channel.unsubscribe().then((value) => {
        if (value === 'error' || value === 'timed out')
          throw new Error(
            `There was an issue unsubscribing from a realtime channel with queryKey ${JSON.stringify(queryKey)}`
          );
      });
    };
  }, [
    isOnline,
    channelName,
    subscriptionConfig,
    queryClient,
    getId,
    JSON.stringify(queryKey)
  ]);

  return result;
}
