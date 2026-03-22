import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { ReactNode } from 'react';
import { useMemo } from 'react';

import {
  FIA_BIBLE_API_QUERY_CACHE_MS,
  FIA_BIBLE_QUERY_ASYNC_STORAGE_KEY,
  FIA_BIBLE_QUERY_PERSIST_BUSTER,
  shouldDehydrateFiaBibleApiQuery
} from '@/utils/fiaBibleQueryCache';

export function QueryProvider({ children }: { children: ReactNode }) {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Cache data for 30 days
            gcTime: 1000 * 60 * 60 * 24 * 30,
            // Keep data fresh for 30 seconds
            staleTime: 30 * 1000,
            // Automatically refetch queries every 30 seconds
            refetchInterval: 30 * 1000,
            // Don't refetch on mount - use cached data for instant navigation
            refetchOnMount: true,
            // Don't refetch on window focus
            refetchOnWindowFocus: false,
            // Don't refetch on reconnect
            refetchOnReconnect: true,
            // Retry failed queries once
            retry: 1,
            // Show cached data while refetching
            placeholderData: (previousData: unknown) => previousData
          }
        }
      }),
    []
  );

  const persister = useMemo(
    () =>
      createAsyncStoragePersister({
        storage: AsyncStorage,
        key: FIA_BIBLE_QUERY_ASYNC_STORAGE_KEY,
        throttleTime: 3000
      }),
    []
  );

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: FIA_BIBLE_API_QUERY_CACHE_MS,
        buster: FIA_BIBLE_QUERY_PERSIST_BUSTER,
        dehydrateOptions: {
          shouldDehydrateQuery: shouldDehydrateFiaBibleApiQuery
        }
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
