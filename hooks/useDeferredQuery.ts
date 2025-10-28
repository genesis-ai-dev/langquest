/**
 * Deferred query hooks for non-blocking navigation
 *
 * These hooks defer data fetching until after animations/interactions complete,
 * allowing instant view transitions with progressive data loading.
 */

import {
  useQuery,
  type UseQueryOptions,
  type UseQueryResult
} from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';

/**
 * Defers query execution until after interactions complete
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useDeferredQuery({
 *   queryKey: ['assets', assetId],
 *   queryFn: () => fetchAsset(assetId),
 *   // Query won't run until animations complete
 * });
 * ```
 */
export function useDeferredQuery<
  TQueryFnData = unknown,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends ReadonlyArray<unknown> = ReadonlyArray<unknown>
>(
  options: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>
): UseQueryResult<TData, TError> {
  const [shouldFetch, setShouldFetch] = useState(false);

  // Wait for interactions to complete before enabling query
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setShouldFetch(true);
    });

    return () => task.cancel();
  }, []);

  // Run query only after interactions complete
  return useQuery({
    ...options,
    enabled: shouldFetch && options.enabled !== false
  });
}

/**
 * Optimistically shows cached data immediately, then refreshes after interactions
 *
 * This provides instant feedback for navigation while ensuring data freshness
 */
export function useOptimisticQuery<
  TQueryFnData = unknown,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends ReadonlyArray<unknown> = ReadonlyArray<unknown>
>(
  options: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>
): UseQueryResult<TData, TError> {
  const [shouldRefetch, setShouldRefetch] = useState(false);

  // Allow initial cache hit immediately, but defer refetch
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setShouldRefetch(true);
    });

    return () => task.cancel();
  }, []);

  return useQuery({
    ...options,
    // Let cache hit immediately
    enabled: options.enabled !== false,
    // But don't refetch until interactions complete
    refetchOnMount: shouldRefetch && options.refetchOnMount !== false,
    // Keep stale data visible during refetch
    placeholderData: (previousData) => previousData
  });
}
