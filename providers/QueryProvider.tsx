import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useMemo } from 'react';

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
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
