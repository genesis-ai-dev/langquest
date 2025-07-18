import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import type { UseInfiniteQueryOptions, UseQueryOptions } from '@tanstack/react-query';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import React from 'react';

type QueryKeyParam = string | number | boolean | null | undefined;

export interface HybridDataOptions<TOfflineData, TCloudData = TOfflineData> {
    // Unique key for this data type (e.g., 'assets', 'quests', 'translations')
    dataType: string;

    // Additional query key elements (e.g., projectId, assetId)
    queryKeyParams: QueryKeyParam[];

    // Function to fetch offline data from SQLite
    offlineQueryFn: () => Promise<TOfflineData[]>;

    // Function to fetch cloud data from Supabase
    cloudQueryFn: () => Promise<TCloudData[]>;

    // Function to get unique ID from an item (defaults to 'id' property)
    getItemId?: (item: TOfflineData | TCloudData) => string;

    // Transform function to convert cloud data to offline format (if different types)
    transformCloudData?: (cloudData: TCloudData) => TOfflineData;

    // Additional options for offline query
    offlineQueryOptions?: Omit<UseQueryOptions<TOfflineData[]>, 'queryKey' | 'queryFn'>;

    // Additional options for cloud query
    cloudQueryOptions?: Omit<UseQueryOptions<TCloudData[]>, 'queryKey' | 'queryFn' | 'enabled'>;

    // Whether to fetch cloud data (defaults to isOnline)
    enableCloudQuery?: boolean;
}

export interface HybridDataResult<T> {
    // Combined data with source tracking
    data: (T & { source: 'localSqlite' | 'cloudSupabase' })[];

    // Loading states
    isOfflineLoading: boolean;
    isCloudLoading: boolean;
    isLoading: boolean;

    // Error states
    offlineError: Error | null;
    cloudError: Error | null;

    // Raw data from each source
    offlineData: (T & { source: 'localSqlite' })[] | undefined;
    cloudData: (T & { source: 'cloudSupabase' })[] | undefined;

    // Network status
    isOnline: boolean;
}

export function useHybridData<TOfflineData, TCloudData = TOfflineData>(
    options: HybridDataOptions<TOfflineData, TCloudData>
): HybridDataResult<TOfflineData> {
    const {
        dataType,
        queryKeyParams,
        offlineQueryFn,
        cloudQueryFn,
        getItemId = (item) => (item as { id: string }).id,
        transformCloudData,
        offlineQueryOptions = {},
        cloudQueryOptions = {},
        enableCloudQuery
    } = options;

    const isOnline = useNetworkStatus();
    const shouldFetchCloud = enableCloudQuery ?? isOnline;

    // Fetch offline data
    const {
        data: rawOfflineData,
        isLoading: isOfflineLoading,
        error: offlineError
    } = useQuery({
        queryKey: [dataType, 'offline', ...queryKeyParams],
        queryFn: offlineQueryFn,
        ...offlineQueryOptions
    });

    // Fetch cloud data
    const {
        data: rawCloudData,
        isLoading: isCloudLoading,
        error: cloudError
    } = useQuery({
        queryKey: [dataType, 'cloud', ...queryKeyParams],
        queryFn: cloudQueryFn,
        enabled: shouldFetchCloud,
        ...cloudQueryOptions
    });

    // Add source tracking to data
    const offlineData = React.useMemo(() => {
        if (!rawOfflineData) return undefined;
        return rawOfflineData.map(item => ({
            ...item,
            source: 'localSqlite' as const
        }));
    }, [rawOfflineData]);

    const cloudData = React.useMemo(() => {
        if (!rawCloudData) return undefined;
        return rawCloudData.map(item => {
            const transformedItem = transformCloudData ? transformCloudData(item) : item as unknown as TOfflineData;
            return {
                ...transformedItem,
                source: 'cloudSupabase' as const
            };
        });
    }, [rawCloudData, transformCloudData]);

    // Combine data with offline taking precedence
    const combinedData = React.useMemo(() => {
        const offlineArray = offlineData || [];
        const cloudArray = cloudData || [];

        // Create a map of offline items by ID for quick lookup
        const offlineMap = new Map(
            offlineArray.map(item => [getItemId(item), item])
        );

        // Add cloud items that don't exist in offline
        const uniqueCloudItems = cloudArray.filter(
            item => !offlineMap.has(getItemId(item))
        );

        // Return offline items first, then unique cloud items
        return [...offlineArray, ...uniqueCloudItems];
    }, [offlineData, cloudData, getItemId]);

    return {
        data: combinedData,
        isOfflineLoading,
        isCloudLoading,
        isLoading: isOfflineLoading || isCloudLoading,
        offlineError,
        cloudError,
        offlineData,
        cloudData,
        isOnline
    };
}

// Helper hook for simple cases where offline and cloud data have the same shape
export function useSimpleHybridData<T extends { id: string }>(
    dataType: string,
    queryKeyParams: QueryKeyParam[],
    offlineQueryFn: () => Promise<T[]>,
    cloudQueryFn: () => Promise<T[]>
): HybridDataResult<T> {
    return useHybridData({
        dataType,
        queryKeyParams,
        offlineQueryFn,
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

export interface HybridInfiniteDataOptions<TOfflineData, TCloudData = TOfflineData> {
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
    getItemId?: (item: TOfflineData | TCloudData) => string | number;

    // Transform function to convert cloud data to offline format (if different types)
    transformCloudData?: (cloudData: TCloudData) => TOfflineData;

    // Additional options for offline query
    offlineQueryOptions?: Omit<UseInfiniteQueryOptions<HybridPageData<TOfflineData>>, 'queryKey' | 'queryFn' | 'initialPageParam' | 'getNextPageParam' | 'select'>;

    // Additional options for cloud query  
    cloudQueryOptions?: Omit<UseInfiniteQueryOptions<HybridPageData<TCloudData>>, 'queryKey' | 'queryFn' | 'enabled' | 'initialPageParam' | 'getNextPageParam' | 'select'>;

    // Whether to fetch cloud data (defaults to isOnline)
    enableCloudQuery?: boolean;
}

export interface HybridInfiniteDataResult<T> {
    // Combined pages with source tracking
    data: {
        pages: HybridPageData<T & { source: 'localSqlite' | 'cloudSupabase' }>[];
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
        getItemId = (item) => (item as { id: string }).id,
        transformCloudData,
        offlineQueryOptions = {},
        cloudQueryOptions = {},
        enableCloudQuery
    } = options;

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
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        staleTime: offlineQueryOptions?.staleTime,
        gcTime: offlineQueryOptions?.gcTime,
        refetchOnWindowFocus: offlineQueryOptions?.refetchOnWindowFocus,
        refetchOnMount: offlineQueryOptions?.refetchOnMount,
        queryFn: async ({ pageParam }) => {
            const context: InfiniteQueryContext = {
                pageParam: pageParam,
                pageSize
            };

            const results = await offlineQueryFn(context);

            return {
                data: results,
                nextCursor: results.length === pageSize ? (pageParam) + 1 : undefined,
                hasMore: results.length === pageSize
            } satisfies HybridPageData<TOfflineData>;
        }
    });

    // Cloud infinite query
    const cloudQuery = useInfiniteQuery({
        queryKey: cloudQueryKey,
        initialPageParam: 0,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        enabled: shouldFetchCloud,
        staleTime: cloudQueryOptions?.staleTime,
        gcTime: cloudQueryOptions?.gcTime,
        refetchOnWindowFocus: cloudQueryOptions?.refetchOnWindowFocus,
        refetchOnMount: cloudQueryOptions?.refetchOnMount,
        queryFn: async ({ pageParam }) => {
            const context: InfiniteQueryContext = {
                pageParam: pageParam,
                pageSize
            };

            const results = await cloudQueryFn(context);

            return {
                data: results,
                nextCursor: results.length === pageSize ? (pageParam) + 1 : undefined,
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
        const mergedPages: HybridPageData<TOfflineData & { source: 'localSqlite' | 'cloudSupabase' }>[] = [];

        for (let i = 0; i < maxPages; i++) {
            const offlinePage = offlinePages[i];
            const cloudPage = cloudPages[i];

            if (offlinePage && cloudPage) {
                // Both pages exist - merge with offline priority
                const offlineDataWithSource = offlinePage.data.map((item: TOfflineData) => ({
                    ...item,
                    source: 'localSqlite' as const
                }));

                const cloudDataTransformed = cloudPage.data.map((item: TCloudData) => {
                    const transformedItem = transformCloudData ? transformCloudData(item) : item as unknown as TOfflineData;
                    return {
                        ...transformedItem,
                        source: 'cloudSupabase' as const
                    };
                });

                // Create map for offline data for quick lookup
                const offlineMap = new Map(
                    offlineDataWithSource.map((item: TOfflineData & { source: 'localSqlite' }) => [getItemId(item), item])
                );

                // Add cloud items that don't exist in offline
                const uniqueCloudItems = cloudDataTransformed.filter(
                    (item: TOfflineData & { source: 'cloudSupabase' }) => !offlineMap.has(getItemId(item))
                );

                mergedPages.push({
                    data: [...offlineDataWithSource, ...uniqueCloudItems],
                    nextCursor: offlinePage.nextCursor || cloudPage.nextCursor,
                    hasMore: offlinePage.hasMore || cloudPage.hasMore
                });
            } else if (offlinePage) {
                // Only offline page exists
                mergedPages.push({
                    data: offlinePage.data.map((item: TOfflineData) => ({
                        ...item,
                        source: 'localSqlite' as const
                    })),
                    nextCursor: offlinePage.nextCursor,
                    hasMore: offlinePage.hasMore
                });
            } else if (cloudPage) {
                // Only cloud page exists
                mergedPages.push({
                    data: cloudPage.data.map((item: TCloudData) => {
                        const transformedItem = transformCloudData ? transformCloudData(item) : item as unknown as TOfflineData;
                        return {
                            ...transformedItem,
                            source: 'cloudSupabase' as const
                        };
                    }),
                    nextCursor: cloudPage.nextCursor,
                    hasMore: cloudPage.hasMore
                });
            }
        }

        const pageParams = (offlineQuery.data?.pageParams || cloudQuery.data?.pageParams || []) as number[];

        return {
            pages: mergedPages,
            pageParams
        };
    }, [offlineQuery.data, cloudQuery.data, getItemId, transformCloudData]);

    return {
        data: mergedData,
        fetchNextPage: () => {
            void offlineQuery.fetchNextPage();
            if (shouldFetchCloud) void cloudQuery.fetchNextPage();
        },
        fetchPreviousPage: () => {
            void offlineQuery.fetchPreviousPage();
            if (shouldFetchCloud) void cloudQuery.fetchPreviousPage();
        },
        refetch: () => {
            void offlineQuery.refetch();
            if (shouldFetchCloud) void cloudQuery.refetch();
        },
        hasNextPage: offlineQuery.hasNextPage || cloudQuery.hasNextPage,
        hasPreviousPage: offlineQuery.hasPreviousPage || cloudQuery.hasPreviousPage,
        isFetchingNextPage: offlineQuery.isFetchingNextPage || cloudQuery.isFetchingNextPage,
        isFetchingPreviousPage: offlineQuery.isFetchingPreviousPage || cloudQuery.isFetchingPreviousPage,
        isLoading: offlineQuery.isLoading || (shouldFetchCloud && cloudQuery.isLoading),
        isFetching: offlineQuery.isFetching || cloudQuery.isFetching,
        isError: offlineQuery.isError || cloudQuery.isError,
        isSuccess: offlineQuery.isSuccess,
        error: offlineQuery.error || cloudQuery.error,
        isOnline,
        status: offlineQuery.isError ? 'error' : offlineQuery.isLoading ? 'pending' : 'success'
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