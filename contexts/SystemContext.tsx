import { System, system } from '@/db/powersync/system';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { PowerSyncContext } from '@powersync/react';
import { ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/styles/theme';

export const SystemContext = createContext<System | undefined>(undefined);

export function SystemProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    system.init();
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
