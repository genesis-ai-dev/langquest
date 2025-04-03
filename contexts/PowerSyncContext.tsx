import { useSystem } from '@/db/powersync/system';
import { PowerSyncContext } from '@powersync/react';
import { useMemo } from 'react';

export function PowerSyncProvider({ children }: { children: React.ReactNode }) {
  const { powersync } = useSystem();

  const db = useMemo(() => powersync, [powersync]);

  return (
    <PowerSyncContext.Provider value={db}>{children}</PowerSyncContext.Provider>
  );
}
