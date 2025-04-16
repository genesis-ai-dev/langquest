import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PowerSyncContext } from '@powersync/react';
import { ReactNode, useMemo } from 'react';
import { system } from '@/db/powersync/system';

const queryClient = new QueryClient();

export function QueryProvider({ children }: { children: ReactNode }) {
  const powerSync = useMemo(() => system.powersync, []);

  return (
    <PowerSyncContext.Provider value={powerSync}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </PowerSyncContext.Provider>
  );
}
