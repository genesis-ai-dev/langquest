import { AuthContext } from '@/contexts/AuthContext';
import { sourceOptions } from '@/db/constants';
import { system } from '@/db/powersync/system';
import { getNetworkStatus, useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useContext } from 'react';

import type { WithSource } from '@/utils/dbUtils';
import type { CompilableQuery as CompilableQueryNative } from '@powersync/react-native';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
// Import from web SDK - will be empty on native
import { useQuery as usePowerSyncQuery } from '@powersync/tanstack-react-query';
import type {
  UseInfiniteQueryOptions,
  UseQueryOptions
} from '@tanstack/react-query';
import {
  keepPreviousData,
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
  // Use useContext directly to avoid throwing if AuthProvider isn't ready yet
  const authContext = useContext(AuthContext);
  const isAuthenticated = authContext?.isAuthenticated ?? false;
  // Use reactive isSystemReady from AuthContext - this updates when PowerSync initializes
  // Previously used a non-reactive useMemo with empty deps which never updated after mount
  const isPowerSyncReady = authContext?.isSystemReady ?? false;

  // Disable offline queries for anonymous users (cloud-only browsing)
  // Anonymous users should only use cloud queries with TanStack Query caching
  const shouldEnableOfflineQuery =
    enableOfflineQuery && enabled && isAuthenticated;

  // For anonymous users, use a safe SQL string that won't access system.db
  // The warning is suppressed, but we still want to avoid any potential issues
  const safePlaceholderQuery =
    'SELECT 1 WHERE 1=0' as unknown as typeof offlineQuery;
  const queryToUse =
    isAuthenticated && isPowerSyncReady ? offlineQuery : safePlaceholderQuery;
  const queryEnabled =
    isAuthenticated && isPowerSyncReady && shouldEnableOfflineQuery;

  // Always call usePowerSyncQuery (React hooks rules require consistent hook calls)
  // For anonymous users, it will use safe query and be disabled, and warning is suppressed
  const powerSyncQueryResult = usePowerSyncQuery<TOfflineData>({
    queryKey: [dataType, 'offline', ...queryKeyParams],
    query: queryToUse,
    enabled: queryEnabled,
    ...offlineQueryOptions
  });

  // Extract results - return empty data for anonymous users
  const rawOfflineData = React.useMemo(() => {
    if (!isAuthenticated) {
      return [] as TOfflineData[];
    }
    return powerSyncQueryResult.data ?? ([] as TOfflineData[]);
  }, [isAuthenticated, powerSyncQueryResult.data]);
  const isOfflineLoading = isAuthenticated
    ? powerSyncQueryResult.isLoading
    : false;
  const offlineError = isAuthenticated
    ? (powerSyncQueryResult.error ?? null)
    : null;

  const offlineRefetch = React.useCallback(() => {
    if (!isAuthenticated) {
      return Promise.resolve([]);
    }
    return powerSyncQueryResult.refetch();
  }, [isAuthenticated, powerSyncQueryResult]);

  // Determine when to fetch cloud data
  // If lazy loading, wait for offline query to finish first
  // Always respect isOnline - even if enableCloudQuery is true, don't fetch when offline
  // IMPORTANT: For anonymous users, don't wait for offline loading since offline is disabled
  // Always enable cloud query immediately for anonymous users
  const shouldFetchCloud = enableCloudQuery !== false && isOnline && enabled;
  const cloudEnabled =
    lazyLoadCloud && isAuthenticated && isPowerSyncReady
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
    // For anonymous users, only cloud loading matters (offline is disabled)
    // For authenticated users, show loading if either is loading
    isLoading: shouldEnableOfflineQuery
      ? isOfflineLoading || isCloudLoading
      : isCloudLoading,
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
  // Use useContext directly to avoid throwing if AuthProvider isn't ready yet
  const authContext = useContext(AuthContext);
  const isAuthenticated = authContext?.isAuthenticated ?? false;
  // Always respect isOnline - even if enableCloudQuery is true, don't fetch when offline
  const shouldFetchCloud = enableCloudQuery !== false && isOnline;

  // Disable offline queries for anonymous users (cloud-only browsing)
  const shouldEnableOfflineQuery = isAuthenticated;

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
    enabled: shouldEnableOfflineQuery,
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
    // For anonymous users, only cloud loading matters (offline is disabled)
    // For authenticated users, show loading if either is loading
    isLoading: shouldEnableOfflineQuery
      ? offlineQuery.isLoading || cloudQuery.isLoading
      : cloudQuery.isLoading,
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
        : shouldEnableOfflineQuery
          ? offlineQuery.isLoading || cloudQuery.isLoading
            ? 'pending'
            : 'success'
          : cloudQuery.isLoading
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

// ============== Paginated Query Support ==============

export interface PaginatedQueryContext {
  page: number;
  pageSize: number;
}

export interface HybridPaginatedDataOptions<
  TOfflineData,
  TCloudData = TOfflineData
> {
  // Unique key for this data type (e.g., 'assets', 'quests', 'translations')
  dataType: string;

  // Additional query key elements (e.g., projectId, assetId)
  queryKeyParams: QueryKeyParam[];

  // Current page number (0-indexed)
  page: number;

  // Page size for pagination
  pageSize: number;

  // PowerSync query definition - function that takes pagination context and returns SQL string or Drizzle query
  // For SQL strings, embed parameters directly in the query
  // e.g., (context) => `SELECT * FROM assets LIMIT ${context.pageSize} OFFSET ${context.page * context.pageSize}`
  offlineQuery: (
    context: PaginatedQueryContext
  ) => string | CompilableQuery<TOfflineData>;

  // Function to fetch cloud data from Supabase
  cloudQueryFn?: (context: PaginatedQueryContext) => Promise<TCloudData[]>;

  // Function to get unique ID from an item (defaults to 'id' property)
  getItemId?: (item: WithSource<TOfflineData | TCloudData>) => string;

  // Transform function to convert cloud data to offline format (if different types)
  transformCloudData?: (cloudData: TCloudData) => TOfflineData;

  // Function to determine if there are more pages (based on returned data)
  // If not provided, will check if returned data length equals pageSize
  hasMore?: (data: TOfflineData[], page: number, pageSize: number) => boolean;

  // Additional options for offline query (PowerSync useQuery options)
  offlineQueryOptions?: Omit<
    UseQueryOptions<TOfflineData[]>,
    'queryKey' | 'query' | 'placeholderData'
  >;

  // Additional options for cloud query
  cloudQueryOptions?: Omit<
    UseQueryOptions<TCloudData[]>,
    'queryKey' | 'queryFn' | 'enabled' | 'placeholderData'
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

export interface HybridPaginatedDataResult<T> {
  // Combined data with source tracking
  data: WithSource<T>[];

  // Pagination metadata
  hasMore: boolean;
  isPlaceholderData: boolean;

  // Loading states
  isOfflineLoading: boolean;
  isCloudLoading: boolean;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;

  // Error states
  offlineError: Error | null;
  cloudError: Error | null;

  // Network status
  isOnline: boolean;

  // Current page info
  page: number;
  pageSize: number;

  refetch: () => void;
}

export function useHybridPaginatedData<TOfflineData, TCloudData = TOfflineData>(
  options: HybridPaginatedDataOptions<TOfflineData, TCloudData>
): HybridPaginatedDataResult<TOfflineData> {
  const {
    dataType,
    queryKeyParams,
    page,
    pageSize,
    offlineQuery,
    cloudQueryFn,
    getItemId: getItemIdProp,
    transformCloudData,
    hasMore: hasMoreFn,
    offlineQueryOptions = {},
    cloudQueryOptions = {},
    enableCloudQuery,
    enableOfflineQuery = true,
    lazyLoadCloud = false,
    enabled = true
  } = options;

  // Stabilize getItemId to prevent render loops
  const defaultGetItemId = React.useCallback(
    (item: WithSource<TOfflineData | TCloudData>) =>
      (item as unknown as { id: string }).id,
    []
  );
  const getItemId = getItemIdProp || defaultGetItemId;

  const isOnline = useNetworkStatus();
  // Use useContext directly to avoid throwing if AuthProvider isn't ready yet
  const authContext = useContext(AuthContext);
  const isAuthenticated = authContext?.isAuthenticated ?? false;
  // Use reactive isSystemReady from AuthContext
  const isPowerSyncReady = authContext?.isSystemReady ?? false;

  // Disable offline queries for anonymous users (cloud-only browsing)
  const shouldEnableOfflineQuery =
    enableOfflineQuery && enabled && isAuthenticated;

  // Create query context
  const queryContext: PaginatedQueryContext = React.useMemo(
    () => ({
      page,
      pageSize
    }),
    [page, pageSize]
  );

  // Generate the offline query based on pagination context
  // For anonymous users, use a safe SQL string that won't access system.db
  const offlineQueryValue = React.useMemo(() => {
    if (isAuthenticated && isPowerSyncReady) {
      return offlineQuery(queryContext);
    }
    return 'SELECT 1 WHERE 1=0' as string | CompilableQuery<TOfflineData>;
  }, [offlineQuery, queryContext, isAuthenticated, isPowerSyncReady]);

  const queryEnabled =
    isAuthenticated && isPowerSyncReady && shouldEnableOfflineQuery;

  // Fetch offline data using PowerSync's useQuery
  const {
    data: rawOfflineData,
    isLoading: isOfflineLoading,
    isFetching: isOfflineFetching,
    error: offlineError,
    refetch: offlineRefetch,
    isPlaceholderData: isOfflinePlaceholderData
  } = usePowerSyncQuery<TOfflineData>({
    queryKey: [
      dataType,
      'paginated',
      'offline',
      ...queryKeyParams,
      page,
      pageSize
    ],
    query: offlineQueryValue,
    enabled: queryEnabled,
    placeholderData: keepPreviousData,
    ...offlineQueryOptions
  });

  // Extract results - return empty data for anonymous users
  const processedOfflineData = React.useMemo(() => {
    if (!isAuthenticated) {
      return [] as TOfflineData[];
    }
    return rawOfflineData ?? ([] as TOfflineData[]);
  }, [isAuthenticated, rawOfflineData]);

  const processedOfflineError = isAuthenticated ? (offlineError ?? null) : null;

  const processedOfflineRefetch = React.useCallback(() => {
    if (!isAuthenticated) {
      return Promise.resolve([]);
    }
    return offlineRefetch();
  }, [isAuthenticated, offlineRefetch]);

  // Determine when to fetch cloud data
  // If cloudQueryFn is not provided, automatically disable cloud query
  // If lazy loading, wait for offline query to finish first
  // Always respect isOnline - even if enableCloudQuery is true, don't fetch when offline
  const effectiveEnableCloudQuery =
    enableCloudQuery ?? (cloudQueryFn ? undefined : false);
  const shouldFetchCloud =
    effectiveEnableCloudQuery !== false && isOnline && enabled;
  const cloudEnabled = lazyLoadCloud
    ? shouldFetchCloud && !!cloudQueryFn && !isOfflineLoading
    : shouldFetchCloud && !!cloudQueryFn;

  // Fetch cloud data using standard TanStack Query
  const {
    data: rawCloudData,
    isLoading: isCloudLoading,
    isFetching: isCloudFetching,
    error: cloudError,
    refetch: cloudRefetch,
    isPlaceholderData: isCloudPlaceholderData
  } = useTanstackQuery({
    queryKey: [
      dataType,
      'paginated',
      'cloud',
      ...queryKeyParams,
      page,
      pageSize
    ],
    queryFn: () => {
      if (!cloudQueryFn) {
        throw new Error(
          'cloudQueryFn is required when enableCloudQuery is true'
        );
      }
      return cloudQueryFn(queryContext);
    },
    enabled: cloudEnabled,
    placeholderData: keepPreviousData,
    ...cloudQueryOptions
  });

  // Add source tracking to data
  const offlineData = React.useMemo(() => {
    // Ensure we always have an array
    const dataArray = Array.isArray(processedOfflineData)
      ? processedOfflineData
      : [];
    return dataArray.filter(Boolean).map((item) => {
      const typedItem = item as unknown as TOfflineData & {
        source?: OfflineDataSource;
      };
      return {
        ...typedItem,
        source: typedItem.source ?? 'synced' // don't override the source if it comes in from merge query
      } as WithSource<TOfflineData>;
    }) as WithSource<TOfflineData>[];
  }, [processedOfflineData]);

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

  // Determine if there are more pages
  const hasMore = React.useMemo(() => {
    if (hasMoreFn) {
      // Extract data without source wrapper for hasMoreFn
      const dataWithoutSource = combinedData.map((item) => {
        const { source: _source, ...data } =
          item as WithSource<TOfflineData> & {
            source: string;
          };
        return data as TOfflineData;
      });
      return hasMoreFn(dataWithoutSource, page, pageSize);
    }
    // Default: if we got a full page from either source, assume there might be more
    // Check raw data lengths, not combinedData, since combinedData may have duplicates removed
    const offlineFullPage = offlineData.length === pageSize;
    const cloudFullPage = cloudData.length === pageSize;
    return offlineFullPage || cloudFullPage;
  }, [combinedData, offlineData, cloudData, page, pageSize, hasMoreFn]);

  // Check if we're showing placeholder data
  const isPlaceholderData = isOfflinePlaceholderData || isCloudPlaceholderData;

  return {
    data: combinedData,
    hasMore,
    isPlaceholderData,
    isOfflineLoading: isAuthenticated ? isOfflineLoading : false,
    isCloudLoading,
    isLoading: shouldEnableOfflineQuery
      ? isOfflineLoading && isCloudLoading
      : isCloudLoading,
    // Use OR because if one query is disabled, we still want to know if the other is fetching
    isFetching:
      (isAuthenticated ? isOfflineFetching : false) || isCloudFetching,
    isError: !!processedOfflineError || (!!cloudError && isOnline),
    offlineError: processedOfflineError,
    cloudError: isOnline ? cloudError : null,
    isOnline,
    page,
    pageSize,
    refetch: () => {
      void processedOfflineRefetch();
      if (shouldFetchCloud) void cloudRefetch();
    }
  };
}

// ============== Infinite-Compatible API using Paginated Queries ==============

export interface HybridPaginatedInfiniteDataOptions<
  TOfflineData,
  TCloudData = TOfflineData
> {
  // Unique key for this data type (e.g., 'assets', 'quests', 'translations')
  dataType: string;

  // Additional query key elements (e.g., projectId, assetId)
  queryKeyParams: QueryKeyParam[];

  // Page size for pagination
  pageSize?: number;

  // PowerSync query definition - function that takes pagination context and returns SQL string or Drizzle query
  offlineQuery: (
    context: PaginatedQueryContext
  ) => string | CompilableQuery<TOfflineData>;

  // Function to fetch cloud data from Supabase
  cloudQueryFn?: (context: PaginatedQueryContext) => Promise<TCloudData[]>;

  // Function to get unique ID from an item (defaults to 'id' property)
  getItemId?: (item: WithSource<TOfflineData | TCloudData>) => string;

  // Transform function to convert cloud data to offline format (if different types)
  transformCloudData?: (cloudData: TCloudData) => TOfflineData;

  // Function to determine if there are more pages (based on returned data)
  // If not provided, will check if returned data length equals pageSize
  hasMore?: (data: TOfflineData[], page: number, pageSize: number) => boolean;

  // Additional options for offline query (PowerSync useQuery options)
  offlineQueryOptions?: Omit<
    UseQueryOptions<TOfflineData[]>,
    'queryKey' | 'query' | 'placeholderData'
  >;

  // Additional options for cloud query
  cloudQueryOptions?: Omit<
    UseQueryOptions<TCloudData[]>,
    'queryKey' | 'queryFn' | 'enabled' | 'placeholderData'
  >;

  // Whether to fetch cloud data (defaults to isOnline)
  enableCloudQuery?: boolean;

  // Whether to fetch offline data (defaults to true)
  enableOfflineQuery?: boolean;

  // Whether to lazy load cloud data (wait for offline to finish first)
  lazyLoadCloud?: boolean;

  enabled?: boolean;

  // Realtime subscription options
  subscribeRealtime?: {
    channelName: string;
    subscriptionConfig: {
      table: string;
      schema: string;
      filter?: string;
    };
  };
}

export interface HybridPaginatedInfiniteDataResult<T> {
  // Combined pages with source tracking (infinite query format)
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
  offlineError: Error | null;
  cloudError: Error | null;

  // Network status
  isOnline: boolean;

  // Status
  status: 'error' | 'pending' | 'success';
}

export function useHybridPaginatedInfiniteData<
  TOfflineData,
  TCloudData = TOfflineData
>(
  options: HybridPaginatedInfiniteDataOptions<TOfflineData, TCloudData>
): HybridPaginatedInfiniteDataResult<TOfflineData> {
  const {
    dataType,
    queryKeyParams,
    pageSize = 20,
    offlineQuery,
    cloudQueryFn,
    getItemId: getItemIdProp,
    transformCloudData,
    hasMore: hasMoreFn,
    offlineQueryOptions = {},
    cloudQueryOptions = {},
    enableCloudQuery,
    enableOfflineQuery = true,
    lazyLoadCloud = false,
    enabled = true,
    subscribeRealtime
  } = options;

  const queryClient = useQueryClient();
  const [page, setPage] = React.useState(0);
  const [accumulatedPages, setAccumulatedPages] = React.useState<
    WithSource<TOfflineData>[]
  >([]);

  // Reset page and accumulated data when query key params change (e.g., search query)
  const queryKeyString = React.useMemo(
    () => JSON.stringify([dataType, ...queryKeyParams]),
    [dataType, queryKeyParams]
  );

  React.useEffect(() => {
    setPage(0);
    setAccumulatedPages([]);
  }, [queryKeyString]);

  // Use the paginated query hook
  const paginatedQuery = useHybridPaginatedData({
    dataType,
    queryKeyParams,
    page,
    pageSize,
    offlineQuery,
    cloudQueryFn,
    getItemId: getItemIdProp,
    transformCloudData,
    hasMore: hasMoreFn,
    offlineQueryOptions,
    cloudQueryOptions,
    enableCloudQuery,
    enableOfflineQuery,
    lazyLoadCloud,
    enabled
  });

  // Accumulate pages automatically following TanStack Query pagination pattern
  // With keepPreviousData, we only accumulate when we have new (non-placeholder) data
  React.useEffect(() => {
    // Only accumulate when we have actual data (not placeholder data)
    // This prevents accumulating stale/placeholder data when switching pages
    if (!paginatedQuery.isPlaceholderData && paginatedQuery.data.length > 0) {
      if (page === 0) {
        // First page - replace accumulated data
        setAccumulatedPages(paginatedQuery.data);
      } else {
        // Subsequent pages - append to accumulated data
        // Only append items that don't already exist to prevent duplicates
        setAccumulatedPages((prev) => {
          const getItemId =
            getItemIdProp || ((item) => (item as unknown as { id: string }).id);
          const existingIds = new Set(prev.map((item) => getItemId(item)));
          const newItems = paginatedQuery.data.filter(
            (item) => !existingIds.has(getItemId(item))
          );
          // Append new items to maintain correct order (new pages go after previous pages)
          return [...prev, ...newItems];
        });
      }
    }
  }, [
    paginatedQuery.data,
    paginatedQuery.isPlaceholderData,
    page,
    getItemIdProp
  ]);

  // Convert accumulated data to infinite query format
  // Only depend on accumulatedPages to ensure correct ordering
  const infiniteData = React.useMemo(() => {
    const pageSize = options.pageSize || 20;
    const pages: HybridPageData<WithSource<TOfflineData>>[] = [];
    const pageParams: number[] = [];

    // Split accumulated data into pages
    // Only use accumulatedPages as the source of truth to ensure correct ordering
    for (let i = 0; i < accumulatedPages.length; i += pageSize) {
      const pageData = accumulatedPages.slice(i, i + pageSize);
      const pageNum = i / pageSize;
      const isLastAccumulatedPage = i + pageSize >= accumulatedPages.length;

      pages.push({
        data: pageData,
        nextCursor: pageNum + 1,
        hasMore: isLastAccumulatedPage ? paginatedQuery.hasMore : true
      });
      pageParams.push(pageNum);
    }

    return {
      pages,
      pageParams
    };
  }, [accumulatedPages, paginatedQuery.hasMore, options.pageSize]);

  // Determine if we're fetching next/previous page
  // We're fetching next page if we're currently fetching AND we're not on page 0
  const isFetchingNextPage = React.useMemo(() => {
    return paginatedQuery.isFetching && page > 0;
  }, [paginatedQuery.isFetching, page]);

  const isFetchingPreviousPage = React.useMemo(() => {
    return (
      paginatedQuery.isFetching &&
      page < accumulatedPages.length / (options.pageSize || 20) - 1
    );
  }, [
    paginatedQuery.isFetching,
    page,
    accumulatedPages.length,
    options.pageSize
  ]);

  // Calculate hasNextPage based on current query state
  const hasNextPage = React.useMemo(() => {
    return paginatedQuery.hasMore;
  }, [paginatedQuery.hasMore]);

  const hasPreviousPage = React.useMemo(() => {
    return page > 0;
  }, [page]);

  // Callbacks for infinite query interface
  // We allow fetching even when showing placeholder data (keepPreviousData behavior)
  // The accumulation logic checks isPlaceholderData to only accumulate real data
  const fetchNextPage = React.useCallback(() => {
    if (hasNextPage && !paginatedQuery.isFetching) {
      setPage((prev) => prev + 1);
    }
  }, [hasNextPage, paginatedQuery.isFetching]);

  const fetchPreviousPage = React.useCallback(() => {
    if (hasPreviousPage && !paginatedQuery.isFetching) {
      setPage((prev) => Math.max(0, prev - 1));
    }
  }, [hasPreviousPage, paginatedQuery.isFetching]);

  // Set up realtime subscription for cloud data updates (infinite query format)
  React.useEffect(() => {
    // If cloudQueryFn is not provided, automatically disable cloud query
    const effectiveEnableCloudQuery =
      enableCloudQuery ?? (cloudQueryFn ? undefined : false);
    if (
      !subscribeRealtime ||
      !paginatedQuery.isOnline ||
      effectiveEnableCloudQuery === false
    )
      return;

    const cloudCacheKey = [
      dataType,
      'paginated',
      'cloud',
      ...queryKeyParams,
      page,
      pageSize
    ];
    const channel = system.supabaseConnector.client
      .channel(subscribeRealtime.channelName)
      .on(
        'postgres_changes',
        { ...subscribeRealtime.subscriptionConfig, event: '*' },
        (
          payload: RealtimePostgresChangesPayload<
            TCloudData & Record<string, unknown>
          >
        ) => {
          const { eventType, new: newRow, old: oldRow } = payload;

          queryClient.setQueryData<TCloudData[]>(cloudCacheKey, (prev = []) => {
            switch (eventType) {
              case 'INSERT': {
                const recordId = getItemIdProp
                  ? getItemIdProp({
                      ...newRow,
                      source: 'cloud' as const
                    } as WithSource<TCloudData>)
                  : (newRow as unknown as { id: string }).id;
                // Avoid duplicates
                if (
                  prev.some((record) => {
                    const id = getItemIdProp
                      ? getItemIdProp({
                          ...record,
                          source: 'cloud' as const
                        } as WithSource<TCloudData>)
                      : (record as unknown as { id: string }).id;
                    return id === recordId;
                  })
                ) {
                  return prev;
                }
                return [...prev, newRow];
              }
              case 'UPDATE': {
                const recordId = getItemIdProp
                  ? getItemIdProp({
                      ...newRow,
                      source: 'cloud' as const
                    } as WithSource<TCloudData>)
                  : (newRow as unknown as { id: string }).id;
                return prev.map((record) => {
                  const id = getItemIdProp
                    ? getItemIdProp({
                        ...record,
                        source: 'cloud' as const
                      } as WithSource<TCloudData>)
                    : (record as unknown as { id: string }).id;
                  return id === recordId ? newRow : record;
                });
              }
              case 'DELETE': {
                const recordId = getItemIdProp
                  ? getItemIdProp({
                      ...oldRow,
                      source: 'cloud' as const
                    } as WithSource<TCloudData>)
                  : (oldRow as unknown as { id: string }).id;
                return prev.filter((record) => {
                  const id = getItemIdProp
                    ? getItemIdProp({
                        ...record,
                        source: 'cloud' as const
                      } as WithSource<TCloudData>)
                    : (record as unknown as { id: string }).id;
                  return id !== recordId;
                });
              }
              default: {
                console.warn(
                  'useHybridPaginatedInfiniteData: Unhandled realtime event type',
                  eventType
                );
                return prev;
              }
            }
          });
        }
      );
    channel.subscribe();

    return () => {
      void channel.unsubscribe();
    };
  }, [
    subscribeRealtime,
    paginatedQuery.isOnline,
    enableCloudQuery,
    dataType,
    queryKeyParams,
    page,
    pageSize,
    queryClient,
    getItemIdProp,
    cloudQueryFn
  ]);

  return {
    data: infiniteData,
    fetchNextPage,
    fetchPreviousPage,
    refetch: paginatedQuery.refetch,
    hasNextPage,
    hasPreviousPage,
    isFetchingNextPage,
    isFetchingPreviousPage,
    isLoading: paginatedQuery.isLoading,
    isOfflineLoading: paginatedQuery.isOfflineLoading,
    isCloudLoading: paginatedQuery.isCloudLoading,
    isFetching: paginatedQuery.isFetching,
    isError: paginatedQuery.isError,
    isSuccess: !paginatedQuery.isError && !paginatedQuery.isLoading,
    error: paginatedQuery.offlineError || paginatedQuery.cloudError,
    offlineError: paginatedQuery.offlineError,
    cloudError: paginatedQuery.cloudError,
    isOnline: paginatedQuery.isOnline,
    status: paginatedQuery.isError
      ? 'error'
      : paginatedQuery.isLoading
        ? 'pending'
        : 'success'
  };
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
