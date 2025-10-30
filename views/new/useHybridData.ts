import { sourceOptions } from '@/db/constants';
import { system } from '@/db/powersync/system';
import { getNetworkStatus, useNetworkStatus } from '@/hooks/useNetworkStatus';

import type { WithSource } from '@/utils/dbUtils';
// import { normalizeUuid } from '@/utils/uuidUtils';
// Import from native SDK - will be empty on web
import type { CompilableQuery as CompilableQueryNative } from '@powersync/react-native';
// Import from web SDK - will be empty on native
import { useQuery as usePowerSyncQuery } from '@powersync/tanstack-react-query';
import type {
  UseInfiniteQueryOptions,
  UseQueryOptions
} from '@tanstack/react-query';
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  useQuery as useTanstackQuery
} from '@tanstack/react-query';
import React from 'react';

// Use the correct type based on platform
type CompilableQuery<T = unknown> = CompilableQueryNative<T>;

type QueryKeyParam = string | number | boolean | null | undefined;

export const offlineDataSourceOptions = {
  local: sourceOptions[0],
  synced: sourceOptions[1]
} as const;

export const hybridDataSourceOptions = {
  ...offlineDataSourceOptions,
  cloud: sourceOptions[2]
} as const;

export type HybridDataSource = keyof typeof hybridDataSourceOptions;
export type OfflineDataSource = keyof typeof offlineDataSourceOptions;

export interface HybridDataOptions<TOfflineData, TCloudData = TOfflineData> {
  // Unique key for this data type (e.g., 'assets', 'quests', 'translations')
  dataType: string;

  // Additional query key elements (e.g., projectId, assetId)
  queryKeyParams: QueryKeyParam[];

  // PowerSync query definition - either SQL string or Drizzle query
  // For SQL strings, embed parameters directly in the query
  // e.g., `SELECT * FROM users WHERE id = '${userId}'`
  offlineQuery: string | CompilableQuery<TOfflineData>;

  // Function to fetch cloud data from Supabase (optional)
  cloudQueryFn?: () => Promise<TCloudData[]>;

  // Function to get unique ID from an item (defaults to 'id' property)
  getItemId?: (item: WithSource<TOfflineData | TCloudData>) => string;

  // Transform function to convert cloud data to offline format (if different types)
  transformCloudData?: (data: TCloudData) => TOfflineData;

  // Additional options for offline query
  offlineQueryOptions?: Omit<
    UseQueryOptions<TOfflineData[]>,
    'queryKey' | 'queryFn' | 'query' | 'parameters'
  >;

  // Additional options for cloud query
  cloudQueryOptions?: Omit<
    UseQueryOptions<TCloudData[]>,
    'queryKey' | 'queryFn' | 'enabled'
  >;

  // Whether to fetch cloud data (defaults to isOnline)
  enableCloudQuery?: boolean;

  // Whether to fetch offline data (defaults to true)
  enableOfflineQuery?: boolean;

  // Whether to lazy load cloud data (wait for offline to finish first)
  // Improves perceived performance by showing local data immediately
  lazyLoadCloud?: boolean;

  enabled?: boolean;
}

export interface HybridDataResult<T> {
  // Combined data with source tracking
  data: WithSource<T>[];

  // Loading states
  isOfflineLoading: boolean;
  isCloudLoading: boolean;
  isLoading: boolean;
  isError: boolean;

  // Error states
  offlineError: Error | null;
  cloudError: Error | null;

  // Network status
  isOnline: boolean;

  refetch: () => void;
}

export function useHybridData<TOfflineData, TCloudData = TOfflineData>(
  options: HybridDataOptions<TOfflineData, TCloudData>
): HybridDataResult<TOfflineData> {
  const {
    dataType,
    queryKeyParams,
    offlineQuery,
    cloudQueryFn,
    getItemId: getItemIdProp,
    transformCloudData,
    offlineQueryOptions = {},
    cloudQueryOptions = {},
    enableCloudQuery,
    enableOfflineQuery = true,
    lazyLoadCloud = false,
    enabled = true
  } = options;

  // Stabilize getItemId to prevent render loops
  // Use a ref-based approach to maintain function stability
  const defaultGetItemId = React.useCallback(
    (item: WithSource<TOfflineData | TCloudData>) =>
      (item as unknown as { id: string }).id,
    []
  );
  const getItemId = getItemIdProp || defaultGetItemId;

  const isOnline = useNetworkStatus();

  // Fetch offline data using PowerSync's useQuery
  const {
    data: rawOfflineData,
    isLoading: isOfflineLoading,
    error: offlineError,
    refetch: offlineRefetch
  } = usePowerSyncQuery<TOfflineData>({
    queryKey: [dataType, 'offline', ...queryKeyParams],
    query: offlineQuery,
    enabled: enableOfflineQuery && enabled,
    ...offlineQueryOptions
  });

  // Determine when to fetch cloud data
  // If lazy loading, wait for offline query to finish first
  const shouldFetchCloud = (enableCloudQuery ?? isOnline) && enabled;
  const cloudEnabled = lazyLoadCloud
    ? shouldFetchCloud && !!cloudQueryFn && !isOfflineLoading
    : shouldFetchCloud && !!cloudQueryFn;

  // Fetch cloud data using standard TanStack Query
  const {
    data: rawCloudData,
    isLoading: isCloudLoading,
    error: cloudError,
    refetch: cloudRefetch
  } = useTanstackQuery({
    queryKey: [dataType, 'cloud', ...queryKeyParams],
    queryFn:
      cloudQueryFn ||
      (() => {
        throw new Error(
          'No cloud query function provided, please provide a cloud query function or disable the cloud query by setting enableCloudQuery to false.'
        );
      }),
    enabled: cloudEnabled,
    ...cloudQueryOptions
  });

  // [["receiver-profiles","cloud"]]: No queryFn was passed as an option, and no default queryFn was found. The queryFn parameter is only optional when using a default queryFn. More info here: https://tanstack.com/query/latest/docs/framework/react/guides/default-query-function Component Stack:

  // console.log('localOnlyData', dataType, localOnlyData);

  // Add source tracking to data
  const offlineData = React.useMemo(() => {
    // Ensure we always have an array
    const dataArray = Array.isArray(rawOfflineData) ? rawOfflineData : [];
    return dataArray.filter(Boolean).map((item) => {
      const typedItem = item as unknown as TOfflineData & {
        source?: OfflineDataSource;
      };
      return {
        ...typedItem,
        source: typedItem.source ?? 'synced' // don't override the source if it comes in from merge query - praise God!
      } as WithSource<TOfflineData>;
    }) as WithSource<TOfflineData>[];
  }, [rawOfflineData]);

  const cloudData = React.useMemo(() => {
    // Ensure we always have an array
    const dataArray = Array.isArray(rawCloudData) ? rawCloudData : [];
    return dataArray.map((item) => {
      const transformedItem = transformCloudData
        ? transformCloudData(item)
        : (item as unknown as TCloudData);

      return {
        ...transformedItem,
        source: 'cloud' as const
      } as WithSource<typeof transformedItem>;
    });
  }, [rawCloudData, transformCloudData]);

  // Combine data with offline taking precedence
  // TODO: we should leverage the lastUpdated field to allow fresh cloud data to override offline data
  const combinedData = React.useMemo(() => {
    const offlineArray = offlineData;
    const cloudArray = cloudData;

    // Create a map of offline items by normalized ID for quick lookup
    // IMPORTANT: Normalize IDs when comparing (local *may* have no dashes, cloud has dashes)
    const offlineMap = new Map(
      offlineArray.map((item) => [getItemId(item), item])
    );

    // Add cloud items that don't exist in offline (using normalized IDs)
    const uniqueCloudItems = cloudArray.filter(
      (item) => !offlineMap.has(getItemId(item))
    );

    // Return offline items first, then unique cloud items
    return [...offlineArray, ...uniqueCloudItems] as WithSource<TOfflineData>[];
  }, [offlineData, cloudData, getItemId]);

  return {
    data: combinedData,
    isOfflineLoading,
    isCloudLoading,
    isLoading: isOfflineLoading && isCloudLoading,
    isError: !!offlineError || !!cloudError,
    offlineError,
    cloudError,
    isOnline,
    refetch: () => {
      void offlineRefetch();
      if (shouldFetchCloud) void cloudRefetch();
    }
  };
}

// Helper hook for simple cases where offline and cloud data have the same shape
export function useSimpleHybridData<T extends { id: string }>(
  dataType: string,
  queryKeyParams: QueryKeyParam[],
  offlineQuery: string | CompilableQuery<T>,
  cloudQueryFn?: () => Promise<T[]>
): HybridDataResult<T> {
  return useHybridData({
    dataType,
    queryKeyParams,
    offlineQuery,
    cloudQueryFn
  });
}

// ============== Infinite Query Support ==============

export interface InfiniteQueryContext {
  pageParam: number;
  pageSize: number;
}

export interface HybridPageData<T> {
  data: T[];
  nextCursor?: number;
  hasMore: boolean;
}

export interface HybridInfiniteDataOptions<
  TOfflineData,
  TCloudData = TOfflineData
> {
  // Unique key for this data type (e.g., 'assets', 'quests', 'translations')
  dataType: string;

  // Additional query key elements (e.g., projectId, assetId)
  queryKeyParams: QueryKeyParam[];

  // Function to fetch offline data from SQLite
  offlineQueryFn: (context: InfiniteQueryContext) => Promise<TOfflineData[]>;

  // Function to fetch cloud data from Supabase
  cloudQueryFn: (context: InfiniteQueryContext) => Promise<TCloudData[]>;

  // Page size for pagination
  pageSize?: number;

  // Function to get unique ID from an item (defaults to 'id' property)
  getItemId?: (item: WithSource<TOfflineData | TCloudData>) => string | number;

  // Transform function to convert cloud data to offline format (if different types)
  transformCloudData?: (cloudData: TCloudData) => WithSource<TOfflineData>;

  // Additional options for offline query
  offlineQueryOptions?: Omit<
    UseInfiniteQueryOptions<HybridPageData<TOfflineData>>,
    'queryKey' | 'queryFn' | 'initialPageParam' | 'getNextPageParam' | 'select'
  >;

  // Additional options for cloud query
  cloudQueryOptions?: Omit<
    UseInfiniteQueryOptions<HybridPageData<TCloudData>>,
    | 'queryKey'
    | 'queryFn'
    | 'enabled'
    | 'initialPageParam'
    | 'getNextPageParam'
    | 'select'
  >;

  // Whether to fetch cloud data (defaults to isOnline)
  enableCloudQuery?: boolean;
}

export interface HybridInfiniteDataResult<T> {
  // Combined pages with source tracking
  data: {
    pages: HybridPageData<WithSource<T>>[];
    pageParams: number[];
  };

  // Functions
  fetchNextPage: () => void;
  fetchPreviousPage: () => void;
  refetch: () => void;

  // States
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

  // Errors
  error: Error | null;

  // Network status
  isOnline: boolean;

  // Status
  status: 'error' | 'pending' | 'success';
}

export function useHybridInfiniteData<TOfflineData, TCloudData = TOfflineData>(
  options: HybridInfiniteDataOptions<TOfflineData, TCloudData>
): HybridInfiniteDataResult<TOfflineData> {
  const {
    dataType,
    queryKeyParams,
    offlineQueryFn,
    cloudQueryFn,
    pageSize = 10,
    getItemId: getItemIdProp,
    transformCloudData,
    offlineQueryOptions: _offlineQueryOptions = {},
    cloudQueryOptions: _cloudQueryOptions = {},
    enableCloudQuery
  } = options;

  // Stabilize getItemId to prevent render loops
  const defaultGetItemId = React.useCallback(
    (item: WithSource<TOfflineData | TCloudData>) =>
      (item as unknown as { id: string | number }).id,
    []
  );
  const getItemId = getItemIdProp || defaultGetItemId;

  const isOnline = useNetworkStatus();
  const shouldFetchCloud = enableCloudQuery ?? isOnline;

  // Create query keys
  const baseKey = [dataType, 'infinite', ...queryKeyParams];
  const offlineQueryKey = [...baseKey, 'offline'];
  const cloudQueryKey = [...baseKey, 'cloud'];

  // Offline infinite query
  const offlineQuery = useInfiniteQuery({
    queryKey: offlineQueryKey,
    initialPageParam: 0,
    getNextPageParam: (lastPage: HybridPageData<TOfflineData>) =>
      lastPage.nextCursor,
    queryFn: async ({ pageParam }: { pageParam: number }) => {
      const context: InfiniteQueryContext = {
        pageParam: pageParam,
        pageSize
      };

      const results = await offlineQueryFn(context);

      return {
        data: results,
        nextCursor: results.length === pageSize ? pageParam + 1 : undefined,
        hasMore: results.length === pageSize
      } satisfies HybridPageData<TOfflineData>;
    }
  });

  // Cloud infinite query
  const cloudQuery = useInfiniteQuery({
    queryKey: cloudQueryKey,
    initialPageParam: 0,
    getNextPageParam: (lastPage: HybridPageData<TCloudData>) =>
      lastPage.nextCursor,
    enabled: shouldFetchCloud,
    queryFn: async ({ pageParam }: { pageParam: number }) => {
      const context: InfiniteQueryContext = {
        pageParam: pageParam,
        pageSize
      };

      const results = await cloudQueryFn(context);

      return {
        data: results,
        nextCursor: results.length === pageSize ? pageParam + 1 : undefined,
        hasMore: results.length === pageSize
      } satisfies HybridPageData<TCloudData>;
    }
  });

  // Merge pages with local priority
  const mergedData = React.useMemo(() => {
    const offlinePages = offlineQuery.data?.pages || [];
    const cloudPages = cloudQuery.data?.pages || [];

    // Merge pages at the same level
    const maxPages = Math.max(offlinePages.length, cloudPages.length);
    const mergedPages: HybridPageData<WithSource<TOfflineData | TCloudData>>[] =
      [];

    for (let i = 0; i < maxPages; i++) {
      const offlinePage = offlinePages[i];
      const cloudPage = cloudPages[i];

      if (offlinePage || cloudPage) {
        const offlineDataWithSource = offlinePage
          ? offlinePage.data.map((item) => {
              return {
                ...item,
                source:
                  (item as unknown as { source?: OfflineDataSource }).source ??
                  'synced'
              } as WithSource<TOfflineData>;
            })
          : [];

        const cloudDataTransformed = cloudPage
          ? cloudPage.data.map((item: TCloudData) => {
              const transformedItem = transformCloudData
                ? (transformCloudData(item) as TOfflineData)
                : (item as unknown as TCloudData);

              return {
                ...transformedItem,
                source: 'cloud' as const
              } as WithSource<typeof transformedItem>;
            })
          : [];

        // IMPORTANT: Normalize IDs when comparing (local *may* have no dashes, cloud has dashes)
        const offlineMap = new Map(
          offlineDataWithSource.map((item) => [getItemId(item), item])
        );

        const uniqueCloudItems = cloudDataTransformed.filter((item) => {
          const id = getItemId(item);
          return !offlineMap.has(id);
        });

        mergedPages.push({
          data: [...offlineDataWithSource, ...uniqueCloudItems],
          nextCursor: offlinePage?.nextCursor || cloudPage?.nextCursor,
          hasMore: Boolean(offlinePage?.hasMore) || Boolean(cloudPage?.hasMore)
        });
      }
    }

    const pageParams = (offlineQuery.data?.pageParams ||
      cloudQuery.data?.pageParams ||
      []) as number[];

    return {
      pages: mergedPages,
      pageParams
    };
  }, [offlineQuery, cloudQuery, getItemId, transformCloudData]);

  // Stabilize callback functions to prevent dependency array size changes
  // Use the stable functions from React Query directly
  const fetchNextPage = React.useCallback(() => {
    void offlineQuery.fetchNextPage();
    if (shouldFetchCloud) void cloudQuery.fetchNextPage();
  }, [shouldFetchCloud, cloudQuery, offlineQuery]);

  const fetchPreviousPage = React.useCallback(() => {
    void offlineQuery.fetchPreviousPage();
    if (shouldFetchCloud) void cloudQuery.fetchPreviousPage();
  }, [shouldFetchCloud, cloudQuery, offlineQuery]);

  const refetch = React.useCallback(() => {
    void offlineQuery.refetch();
    if (shouldFetchCloud) void cloudQuery.refetch();
  }, [shouldFetchCloud, cloudQuery, offlineQuery]);

  return {
    data: mergedData as unknown as {
      pages: HybridPageData<WithSource<TOfflineData>>[];
      pageParams: number[];
    },
    fetchNextPage,
    fetchPreviousPage,
    refetch,
    hasNextPage: offlineQuery.hasNextPage || cloudQuery.hasNextPage,
    hasPreviousPage: offlineQuery.hasPreviousPage || cloudQuery.hasPreviousPage,
    isFetchingNextPage:
      offlineQuery.isFetchingNextPage || cloudQuery.isFetchingNextPage,
    isFetchingPreviousPage:
      offlineQuery.isFetchingPreviousPage || cloudQuery.isFetchingPreviousPage,
    isLoading: offlineQuery.isLoading, // Only block on offline loading
    isOfflineLoading: offlineQuery.isLoading,
    isCloudLoading: shouldFetchCloud && cloudQuery.isLoading,
    isFetching: offlineQuery.isFetching || cloudQuery.isFetching,
    isError: offlineQuery.isError || cloudQuery.isError,
    isSuccess: offlineQuery.isSuccess || cloudQuery.isSuccess,
    error: offlineQuery.error || cloudQuery.error,
    isOnline,
    status:
      offlineQuery.isError || cloudQuery.isError
        ? 'error'
        : offlineQuery.isLoading
          ? 'pending'
          : 'success'
  };
}

// Helper hook for simple infinite cases
export function useSimpleHybridInfiniteData<T extends { id: string }>(
  dataType: string,
  queryKeyParams: QueryKeyParam[],
  offlineQueryFn: (context: InfiniteQueryContext) => Promise<T[]>,
  cloudQueryFn: (context: InfiniteQueryContext) => Promise<T[]>,
  pageSize?: number
): HybridInfiniteDataResult<T> {
  return useHybridInfiniteData({
    dataType,
    queryKeyParams,
    offlineQueryFn,
    cloudQueryFn,
    pageSize
  });
}

/**
 * Lightweight hook to check if an item is downloaded for the current user
 * by checking if user ID is in the download_profiles array
 */
export function useItemDownloadStatus(
  item: { download_profiles?: string[] | null } | undefined,
  userId: string | undefined
): boolean {
  return React.useMemo(() => {
    if (!item || !userId || !item.download_profiles) return false;
    return item.download_profiles.includes(userId);
  }, [userId, item]);
}

/**
 * Configuration for hybridFetch function
 */
export interface HybridFetchOptions<TOfflineData, TCloudData = TOfflineData> {
  // PowerSync query definition - either SQL string or Drizzle query
  offlineQuery: string | CompilableQuery<TOfflineData>;

  // Function to fetch cloud data from Supabase
  cloudQueryFn: () => Promise<TCloudData[]>;

  // Function to get unique ID from an item (defaults to 'id' property)
  getItemId?: (item: TOfflineData | TCloudData) => string;

  // Transform function to convert cloud data to offline format (if different types)
  transformCloudData?: (cloudData: TCloudData) => TOfflineData;
}

/**
 * Standalone function to fetch data with offline-first approach
 * Merges local and cloud data with local taking priority (unless cloud is newer)
 * Can be used outside of React components
 */
export async function hybridFetch<TOfflineData, TCloudData = TOfflineData>(
  options: HybridFetchOptions<TOfflineData, TCloudData>
): Promise<TOfflineData[]> {
  const {
    offlineQuery,
    cloudQueryFn,
    getItemId = (item) => (item as { id: string }).id,
    transformCloudData
  } = options;

  // Fetch offline data
  let offlineData: TOfflineData[] = [];

  try {
    if (typeof offlineQuery === 'string') {
      // For SQL strings, execute directly with system.powersync
      const result = await system.powersync.execute(offlineQuery);
      const rows: TOfflineData[] = [];
      if (result.rows) {
        for (let i = 0; i < result.rows.length; i++) {
          const item = result.rows.item(i) as TOfflineData;
          if (item) {
            rows.push(item);
          }
        }
      }
      offlineData = rows;
    } else {
      // For CompilableQuery, execute directly
      offlineData = await offlineQuery.execute();
    }
  } catch (error) {
    console.error('hybridFetch: Error fetching offline data:', error);
    // Continue with empty offline data
  }

  // Try to fetch cloud data if online
  const isOnline = getNetworkStatus();
  let cloudData: TCloudData[] = [];

  if (isOnline) {
    try {
      cloudData = await cloudQueryFn();
    } catch (error) {
      console.warn(
        'hybridFetch: Cloud query failed, using local data only',
        error
      );
    }
  }

  // Transform cloud data if needed
  const transformedCloudData: TOfflineData[] = cloudData.map((item) => {
    return transformCloudData
      ? transformCloudData(item)
      : (item as unknown as TOfflineData);
  });

  // Merge data with local priority
  const offlineMap = new Map(
    offlineData.map((item) => [getItemId(item), item])
  );
  const mergedMap = new Map<string, TOfflineData>();

  // Add all offline data first
  offlineData.forEach((item) => {
    mergedMap.set(getItemId(item), item);
  });

  // Process cloud data
  transformedCloudData.forEach((cloudItem) => {
    const id = getItemId(cloudItem);
    const localItem = offlineMap.get(id);

    if (!localItem) {
      // Cloud item doesn't exist locally, add it
      mergedMap.set(id, cloudItem);
    } else {
      // Item exists in both - compare last_updated timestamps if available
      const localLastUpdated = (
        localItem as TOfflineData & { last_updated?: string }
      ).last_updated;
      const cloudLastUpdated = (
        cloudItem as TOfflineData & { last_updated?: string }
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

  // Convert map back to array
  return Array.from(mergedMap.values());
}

/**
 * Hook for downloading items using the appropriate RPC based on type
 */
export function useItemDownload(
  itemType: 'project' | 'quest' | 'asset',
  itemId: string
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      download
    }: {
      userId: string;
      download: boolean;
    }) => {
      if (itemType === 'quest') {
        // Use efficient quest_closure system for quests
        if (download) {
          const result = await system.supabaseConnector.client.rpc(
            'download_quest_closure',
            {
              quest_id_param: itemId,
              profile_id_param: userId
            }
          );
          if (result.error) throw result.error;
          return result.data as boolean;
        } else {
          // TODO: Implement undownload when available
          console.warn('Undownload not yet implemented for quest_closure');
          return null;
        }
      } else {
        // Use legacy download_record RPC for other types
        const operation = download ? 'add' : 'remove';
        const { error } = await system.supabaseConnector.client.rpc(
          'download_record',
          {
            p_table_name: itemType,
            p_record_id: itemId,
            p_operation: operation
          }
        );
        if (error) throw error;
        return true;
      }
    },
    onSuccess: () => {
      // Invalidate relevant queries to refresh download status
      void queryClient.invalidateQueries({ queryKey: [itemType + 's'] });
      void queryClient.invalidateQueries({ queryKey: ['download-status'] });

      // Invalidate assets queries if downloading a quest to refresh assets list
      if (itemType === 'quest') {
        void queryClient.invalidateQueries({ queryKey: ['assets'] });
      }
    }
  });
}
