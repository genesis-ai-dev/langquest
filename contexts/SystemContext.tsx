import type { System } from '@/db/powersync/system';
import { system } from '@/db/powersync/system';
import { PowerSyncContext } from '@powersync/react';
import { createContext, useContext, useEffect } from 'react';

export const SystemContext = createContext<System | undefined>(undefined);

export function SystemProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    async function bootstrap() {
      // 1) init the database & Powersync connection
      await system.init();
      // 2) wire up both attachment queues *before* any loadAssetAttachments calls
      await system.tempAttachmentQueue?.init();
      await system.permAttachmentQueue?.init();
    }
    void bootstrap();
  }, []);

  return (
    <SystemContext.Provider value={system}>
      <PowerSyncContext.Provider value={system.powersync}>
        {children}
      </PowerSyncContext.Provider>
    </SystemContext.Provider>
  );
}

export function useSystem() {
  const context = useContext(SystemContext);
  if (context === undefined) {
    throw new Error('useSystemContext must be used within a SystemProvider');
  }
  return context;
}
