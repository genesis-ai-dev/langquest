import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ReactNode } from 'react';
import { useMemo } from 'react';

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'bible-brain-cache'
});

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

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            const queryKey = query.queryKey;
            if (!Array.isArray(queryKey) || typeof queryKey[0] !== 'string')
              return false;
            const key = queryKey[0];
            return key.startsWith('bible-brain-') || key === 'fia-books';
          }
        }
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
