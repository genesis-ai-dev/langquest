import type { System } from '@/db/powersync/system';
import { system } from '@/db/powersync/system';
import { PowerSyncContext } from '@powersync/react';
import { createContext, useContext, useEffect, useRef } from 'react';

export const SystemContext = createContext<System | undefined>(undefined);

export function SystemProvider({ children }: { children: React.ReactNode }) {
  const initStarted = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    // Prevent multiple init calls
    if (!initStarted.current) {
      initStarted.current = true;
      void system.init().catch((error) => {
        console.error('SystemProvider init error:', error);
        initStarted.current = false; // Allow retry on error
      });
    }

    return () => {
      mounted.current = false;
      // Note: We don't disconnect here because the system is a singleton
      // that should persist across component lifecycles
    };
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
