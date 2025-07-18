import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import type { UseQueryOptions } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
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