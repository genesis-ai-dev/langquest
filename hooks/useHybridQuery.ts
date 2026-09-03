import { system } from '@/db/powersync/system';
import type { CompilableQuery } from '@powersync/react-native';
import { useQuery } from '@powersync/tanstack-react-query';
import React from 'react';
import { useNetworkStatus } from './useNetworkStatus';

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
 * A hook that always queries local data first, then cloud data when available,
 * and merges them with local data taking priority. Compatible with PowerSync/Drizzle/React Query stack.
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
    } else if ('offlineQuery' in options && options.offlineQuery) {
      return async () => {
        const offlineQuery = options.offlineQuery;
        if (typeof offlineQuery === 'string') {
          // For string queries, execute directly with system.powersync
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
        return await offlineQuery.execute();
      };
    } else {
      throw new Error('Either offlineFn or offlineQuery must be provided');
    }
  };

  // Query local data (always enabled)
  const localQuery = useQuery({
    queryKey: localQueryKey,
    queryFn: getLocalQueryFn(),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    ...restOptions
  });

  // Query cloud data (only when online)
  const cloudQuery = useQuery({
    queryKey: cloudQueryKey,
    queryFn: onlineFn,
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

export function createHybridQueryConfig<T extends Record<string, unknown>>(
  options: HybridQueryOptions<T>
) {
  return options;
}
